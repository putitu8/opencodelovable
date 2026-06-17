import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDb } from "../lib/cloudbase";
import {
  streamGenerate,
  parseGeneratedFiles,
  type GeneratedFile,
} from "../lib/generate";
import VersionList, { type Version } from "./VersionList";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [rawOutput, setRawOutput] = useState("");
  const [plan, setPlan] = useState("");
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [activeTab, setActiveTab] = useState<"plan" | string>("plan");
  const [error, setError] = useState("");
  const [contextVersion, setContextVersion] = useState<Version | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [versionRefresh, setVersionRefresh] = useState(0);
  const [showVersions, setShowVersions] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  const saveVersion = useCallback(
    async (filesData: GeneratedFile[], desc: string) => {
      if (!id) return;
      try {
        const db = getDb();
        await db.collection("versions").add({
          projectId: id,
          description: desc,
          files: filesData,
          prompt,
          createdAt: Date.now(),
        });
        setVersionRefresh((k) => k + 1);
      } catch (e) {
        console.error("Failed to save version:", e);
      }
    },
    [id, prompt]
  );

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError("");
    setRawOutput("");
    setPlan("");
    setFiles([]);

    let fullText = "";
    const ctxFiles = contextVersion?.files;

    await streamGenerate(
      prompt,
      {
        onToken: (text) => {
          fullText += text;
          setRawOutput(fullText);
          const { plan: p, files: f } = parseGeneratedFiles(fullText);
          if (p) setPlan(p);
          if (f.length > 0) {
            setFiles(f);
            if (activeTab === "plan") setActiveTab(f[0].path);
          }
        },
        onDone: () => {
          setGenerating(false);
          const { plan: p, files: f } = parseGeneratedFiles(fullText);
          setPlan(p);
          setFiles(f);
          saveVersion(
            f,
            ctxFiles
              ? `modify [v?: ${contextVersion?.prompt?.slice(0, 30)}]: ${prompt.slice(0, 50)}`
              : `create: ${prompt.slice(0, 50)}`
          );
        },
        onError: (err) => {
          setGenerating(false);
          setError(err.message);
        },
      },
      ctxFiles
    );
  }, [prompt, generating, activeTab, saveVersion, contextVersion]);

  const handleSelectVersion = useCallback((v: Version) => {
    setActiveVersionId(v._id);
    setFiles(v.files || []);
    setPlan(v.description);
    setRawOutput("");
    setContextVersion(null);
    setPrompt("");
    if (v.files?.length > 0) setActiveTab(v.files[0].path);
  }, []);

  const handleRollback = useCallback(
    async (v: Version) => {
      if (!v.files?.length) return;
      await saveVersion(v.files, `rollback to version: ${v.description}`);
      setContextVersion(null);
      setActiveVersionId(null);
      setFiles(v.files);
      setPlan(v.description);
      setRawOutput("");
      setPrompt("");
      if (v.files.length > 0) setActiveTab(v.files[0].path);
    },
    [saveVersion]
  );

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [rawOutput]);

  const currentFile = files.find((f) => f.path === activeTab);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <button onClick={() => navigate("/projects")}>
          &larr; 返回项目列表
        </button>
        <button
          onClick={() => setShowVersions(!showVersions)}
          style={{
            background: showVersions ? "#e8e0ff" : undefined,
          }}
        >
          {showVersions ? "隐藏版本" : "版本历史"}
        </button>
      </div>

      {contextVersion && (
        <div
          style={{
            background: "#f0edff",
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            marginBottom: "0.75rem",
            fontSize: "0.85rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            正在修改: <strong>{contextVersion.description}</strong> ({contextVersion.files?.length || 0} 个文件)
          </span>
          <button
            onClick={() => {
              setContextVersion(null);
              setPrompt("");
            }}
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
          >
            取消
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <textarea
          placeholder={
            contextVersion
              ? "描述你想做的修改..."
              : "描述你想创建的应用..."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleGenerate();
            }
          }}
          rows={3}
          style={{
            flex: 1,
            padding: "0.75rem",
            resize: "vertical",
            fontSize: "1rem",
          }}
          disabled={generating}
        />
        <button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          style={{ alignSelf: "flex-end", minWidth: 80 }}
        >
          {generating
            ? "生成中..."
            : contextVersion
            ? "修改"
            : "生成"}
        </button>
      </div>
      <p
        style={{
          color: "#999",
          fontSize: "0.8rem",
          marginTop: "-0.5rem",
          marginBottom: "1rem",
        }}
      >
        Ctrl / Cmd + Enter 发送
      </p>

      {error && (
        <div
          style={{
            color: "red",
            background: "#fff0f0",
            padding: "0.75rem",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {generating && !rawOutput && <p>AI 正在分析需求...</p>}

      <div style={{ display: "flex", gap: "1rem" }}>
        {/* Main content area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {rawOutput ? (
            <div style={{ display: "flex", gap: "1rem", minHeight: 400 }}>
              {/* File tabs */}
              <div style={{ width: 200, flexShrink: 0 }}>
                <div
                  onClick={() => setActiveTab("plan")}
                  style={{
                    padding: "0.5rem",
                    cursor: "pointer",
                    background: activeTab === "plan" ? "#e8e0ff" : "transparent",
                    borderRadius: 4,
                    fontWeight: activeTab === "plan" ? 600 : 400,
                  }}
                >
                  Plan
                </div>
                {files.map((f) => (
                  <div
                    key={f.path}
                    onClick={() => setActiveTab(f.path)}
                    style={{
                      padding: "0.5rem",
                      cursor: "pointer",
                      background:
                        activeTab === f.path ? "#e8e0ff" : "transparent",
                      borderRadius: 4,
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                      fontWeight: activeTab === f.path ? 600 : 400,
                    }}
                  >
                    {f.path.split("/").pop()}
                    <div style={{ fontSize: "0.7rem", color: "#999" }}>
                      {f.path}
                    </div>
                  </div>
                ))}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {activeTab === "plan" ? (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#f5f5f5",
                      padding: "1rem",
                      borderRadius: 6,
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                    }}
                  >
                    {plan || "等待生成..."}
                  </pre>
                ) : currentFile ? (
                  <pre
                    ref={outputRef}
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#1e1e1e",
                      color: "#d4d4d4",
                      padding: "1rem",
                      borderRadius: 6,
                      fontSize: "0.85rem",
                      lineHeight: 1.5,
                      maxHeight: "60vh",
                      overflow: "auto",
                    }}
                  >
                    {currentFile.content}
                  </pre>
                ) : (
                  <p>选择左侧文件查看</p>
                )}

                {generating && (
                  <details style={{ marginTop: "1rem" }}>
                    <summary
                      style={{
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        color: "#999",
                      }}
                    >
                      原始输出
                    </summary>
                    <pre
                      ref={outputRef}
                      style={{
                        whiteSpace: "pre-wrap",
                        background: "#fafafa",
                        padding: "0.5rem",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        maxHeight: 200,
                        overflow: "auto",
                      }}
                    >
                      {rawOutput}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ) : files.length > 0 ? (
            // Showing a loaded version (from history)
            <div style={{ display: "flex", gap: "1rem", minHeight: 400 }}>
              <div style={{ width: 200, flexShrink: 0 }}>
                <div
                  onClick={() => setActiveTab("plan")}
                  style={{
                    padding: "0.5rem",
                    cursor: "pointer",
                    background: activeTab === "plan" ? "#e8e0ff" : "transparent",
                    borderRadius: 4,
                    fontWeight: activeTab === "plan" ? 600 : 400,
                  }}
                >
                  Plan
                </div>
                {files.map((f) => (
                  <div
                    key={f.path}
                    onClick={() => setActiveTab(f.path)}
                    style={{
                      padding: "0.5rem",
                      cursor: "pointer",
                      background:
                        activeTab === f.path ? "#e8e0ff" : "transparent",
                      borderRadius: 4,
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                      fontWeight: activeTab === f.path ? 600 : 400,
                    }}
                  >
                    {f.path.split("/").pop()}
                    <div style={{ fontSize: "0.7rem", color: "#999" }}>
                      {f.path}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {activeTab === "plan" ? (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#f5f5f5",
                      padding: "1rem",
                      borderRadius: 6,
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                    }}
                  >
                    {plan || "无描述"}
                  </pre>
                ) : currentFile ? (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#1e1e1e",
                      color: "#d4d4d4",
                      padding: "1rem",
                      borderRadius: 6,
                      fontSize: "0.85rem",
                      lineHeight: 1.5,
                      maxHeight: "60vh",
                      overflow: "auto",
                    }}
                  >
                    {currentFile.content}
                  </pre>
                ) : null}
              </div>
            </div>
          ) : !generating && !error ? (
            <p style={{ color: "#999", textAlign: "center", marginTop: "3rem" }}>
              输入描述，AI 将为你生成完整应用
            </p>
          ) : null}
        </div>

        {/* Version sidebar */}
        {showVersions && (
          <div
            style={{
              width: 240,
              flexShrink: 0,
              borderLeft: "1px solid #eee",
              paddingLeft: "1rem",
            }}
          >
            <VersionList
              projectId={id!}
              activeVersionId={activeVersionId}
              onSelect={handleSelectVersion}
              onRollback={handleRollback}
              refreshKey={versionRefresh}
            />
            {files.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <button
                  onClick={() => {
                    setContextVersion({
                      _id: "",
                      projectId: id!,
                      description: plan || "当前版本",
                      prompt: prompt || "",
                      files,
                      createdAt: Date.now(),
                    });
                    setPrompt("");
                  }}
                  style={{ width: "100%", fontSize: "0.8rem" }}
                >
                  基于此版本继续修改
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
