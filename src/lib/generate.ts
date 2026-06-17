export interface GeneratedFile {
  path: string;
  content: string;
}

export function parseGeneratedFiles(text: string): {
  plan: string;
  files: GeneratedFile[];
} {
  const files: GeneratedFile[] = [];
  let plan = "";

  // Extract plan
  const planMatch = text.match(/## Plan\n([\s\S]*?)(?=\n```|\n## |$)/);
  if (planMatch) {
    plan = planMatch[1].trim();
  }

  // Extract files: ```FILE:path\n...code...```
  const fileRegex = /```FILE:(.+?)\n([\s\S]*?)```/g;
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    files.push({
      path: match[1].trim(),
      content: match[2].trim(),
    });
  }

  // Fallback: find unnamed code blocks after plan
  if (files.length === 0) {
    const blockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let idx = 0;
    while ((match = blockRegex.exec(text)) !== null) {
      const lang = match[1] || "txt";
      const code = match[2];
      // Skip blocks that look like plan/generic text
      if (code.includes("```FILE:")) continue;
      files.push({
        path: `file_${idx}.${lang === "txt" ? "txt" : lang}`,
        content: code.trim(),
      });
      idx++;
    }
  }

  return { plan, files };
}

interface StreamCallbacks {
  onToken: (text: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export async function streamGenerate(
  prompt: string,
  callbacks: StreamCallbacks,
  contextMessages?: { role: string; content: string }[]
) {
  const url = import.meta.env.VITE_GENERATE_ENDPOINT;
  if (!url) {
    callbacks.onError(new Error("VITE_GENERATE_ENDPOINT not configured"));
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, messages: contextMessages }),
    });

    if (!response.ok) {
      const err = await response.text();
      callbacks.onError(new Error(err));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError(new Error("No response body"));
      return;
    }

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
          if (parsed.token) {
            callbacks.onToken(parsed.token);
          }
        } catch {
          // skip
        }
      }
    }

    callbacks.onDone();
  } catch (e) {
    callbacks.onError(e instanceof Error ? e : new Error(String(e)));
  }
}
