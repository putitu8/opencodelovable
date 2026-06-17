import { useState, useEffect, useCallback } from "react";
import { getDb } from "../lib/cloudbase";
import type { GeneratedFile } from "../lib/generate";

export interface Version {
  _id: string;
  projectId: string;
  description: string;
  prompt: string;
  files: GeneratedFile[];
  createdAt: number;
}

interface Props {
  projectId: string;
  activeVersionId: string | null;
  onSelect: (version: Version) => void;
  onRollback: (version: Version) => void;
  refreshKey: number;
}

export default function VersionList({
  projectId,
  activeVersionId,
  onSelect,
  onRollback,
  refreshKey,
}: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const db = getDb();
      const res = await db
        .collection("versions")
        .where({ projectId })
        .orderBy("createdAt", "desc")
        .get();
      setVersions(res.data as Version[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions, refreshKey]);

  if (loading) return <p style={{ fontSize: "0.85rem", color: "#999" }}>加载版本...</p>;
  if (versions.length === 0) return null;

  return (
    <div>
      <h4 style={{ marginBottom: "0.5rem" }}>版本历史</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {versions.map((v, i) => (
          <div
            key={v._id}
            style={{
              padding: "0.5rem",
              border: "1px solid #eee",
              borderRadius: 6,
              background: v._id === activeVersionId ? "#e8e0ff" : "transparent",
            }}
          >
            <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
              {i === 0 ? "📌 " : ""}v{versions.length - i}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem" }}>
              {v.description}
            </div>
            <div style={{ fontSize: "0.7rem", color: "#999", marginBottom: "0.5rem" }}>
              {new Date(v.createdAt).toLocaleString()} · {v.files?.length || 0} 个文件
            </div>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <button
                onClick={() => onSelect(v)}
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              >
                查看
              </button>
              {i !== 0 && (
                <button
                  onClick={() => onRollback(v)}
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                >
                  回滚到此
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
