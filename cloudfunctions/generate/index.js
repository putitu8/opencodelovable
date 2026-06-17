const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const SYSTEM_PROMPT = `You are an expert full-stack developer. When a user describes an application, generate complete, production-ready code.

## Output format

1. Start with "## Plan" section: a brief bullet list of what you'll build
2. Then output each file using this format:
   \`\`\`FILE:<relative-path>
   <code>
   \`\`\`

## Rules

- Auto-detect the best tech stack:
  - Simple landing/info pages → single index.html with inline CSS/JS
  - Complex apps → React + TypeScript with Vite
  - When user mentions Vue → Vue 3 + Vite
- Always generate COMPLETE files with ALL imports. No placeholders.
- Include responsive design by default.
- Use clean, modern CSS (no Tailwind unless asked).
- For React apps: include index.html, package.json, vite.config.ts, tsconfig.json alongside components.
- Output package.json with realistic version numbers.
- Keep file count manageable — merge small files when practical.`;

export async function main(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: "DEEPSEEK_API_KEY not configured" });
  }

  const { prompt, messages: contextMessages } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  if (contextMessages) {
    messages.push(...contextMessages);
  }

  messages.push({ role: "user", content: prompt });

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        stream: true,
        temperature: 0.3,
        max_tokens: 16384,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek error:", err);
      return res.status(response.status).json({ error: err });
    }

    // SSE stream to client
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ token: content })}\n\n`);
          }
        } catch {
          // skip unparseable chunks
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Stream error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Generation failed" });
    }
    res.end();
  }
}
