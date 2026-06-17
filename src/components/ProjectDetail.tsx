import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDb } from "../lib/cloudbase";
import {
  streamGenerate,
  parseGeneratedFiles,
  type GeneratedFile,
} from "../lib/generate";

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
  const outputRef = useRef<HTMLPreElement>(null);

  // Save version to DB
  const saveVersion = useCallback(
    async (filesData: GeneratedFile[], desc: string) => {
      try {
        const db = getDb();
        await db.collection("versions").add({
          projectId: id,
          description: desc,
          files: filesData,
          prompt,
          createdAt: Date.now(),
        });
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

    await streamGenerate(
      prompt,
      {
        onToken: (text) => {
          fullText += text;
          setRawOutput(fullText);
          // Parse incrementally
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
          saveVersion(f, `generate: ${prompt.slice(0, 50)}`);
        },
        onError: (err) => {
          setGenerating(false);
          setError(err.message);
        },
      }
    );
  }, [prompt, generating, activeTab, saveVersion]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [rawOutput]);

  const currentFile = files.find((f) => f.path === activeTab);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => navigate("/projects")}>
          &larr; 返回项目列表
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <textarea
          placeholder="描述你想创建的应用..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleGenerate();
            }
          }}
          rows={3}
          style={{ flex: 1, padding: "0.75rem", resize: "vertical", fontSize: "1rem" }}
          disabled={generating}
        />
        <button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          style={{ alignSelf: "flex-end", minWidth: 80 }}
        >
          {generating ? "生成中..." : "生成"}
        </button>
      </div>
      <p style={{ color: "#999", fontSize: "0.8rem", marginTop: "-0.5rem", marginBottom: "1rem" }}>
        Ctrl / Cmd + Enter 发送
      </p>

      {error && (
        <div style={{ color: "red", background: "#fff0f0", padding: "0.75rem", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {generating && !rawOutput && (
        <p>AI 正在分析需求...</p>
      )}

      {rawOutput && (
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
                  background: activeTab === f.path ? "#e8e0ff" : "transparent",
                  borderRadius: 4,
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  fontWeight: activeTab === f.path ? 600 : 400,
                }}
              >
                {f.path.split("/").pop()}
                <div style={{ fontSize: "0.7rem", color: "#999" }}>{f.path}</div>
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

            {/* Raw output for debugging */}
            {generating && (
              <details style={{ marginTop: "1rem" }}>
                <summary style={{ cursor: "pointer", fontSize: "0.8rem", color: "#999" }}>
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
      )}

      {!rawOutput && !generating && !error && (
        <p style={{ color: "#999", textAlign: "center", marginTop: "3rem" }}>
          输入描述，AI 将为你生成完整应用
        </p>
      )}
    </div>
  );
}
