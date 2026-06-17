import { useState, useEffect, useCallback } from "react";
import { getDb, getAuth } from "../lib/cloudbase";
import { useNavigate } from "react-router-dom";

interface Project {
  _id: string;
  name: string;
  description: string;
  createdAt: number;
}

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const db = getDb();
      const res = await db
        .collection("projects")
        .orderBy("createdAt", "desc")
        .get();
      setProjects(res.data as Project[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const db = getDb();
      const auth = getAuth();
      const state = await auth.getLoginState();
      await db.collection("projects").add({
        name: name.trim(),
        description: description.trim(),
        createdAt: Date.now(),
        uid: state?.user?.uid || "",
      });
      setName("");
      setDescription("");
      fetchProjects();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  }, [name, description, fetchProjects]);

  const logout = useCallback(async () => {
    await getAuth().signOut();
    window.location.reload();
  }, []);

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>我的项目</h1>
        <button onClick={logout}>退出</button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <input
          placeholder="项目名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: "0.5rem" }}
        />
        <input
          placeholder="描述（可选）"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ flex: 2, padding: "0.5rem" }}
        />
        <button onClick={createProject} disabled={creating || !name.trim()}>
          {creating ? "创建中..." : "创建"}
        </button>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : projects.length === 0 ? (
        <p>还没有项目，创建一个吧</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {projects.map((p) => (
            <div
              key={p._id}
              onClick={() => navigate(`/projects/${p._id}`)}
              style={{
                padding: "1rem",
                border: "1px solid #eee",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <strong>{p.name}</strong>
              <p style={{ color: "#666", margin: "0.25rem 0 0" }}>
                {p.description || "无描述"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
