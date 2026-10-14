// eink-chat: text-only Claude chat for NetSurf / e-ink browsers.
// Runs as a Cloudflare Worker. No JavaScript is sent to the browser.
// Conversation history travels inside the form (hidden field), so the
// worker stores nothing.

const MAX_TURNS = 6;      // Q&A pairs to remember
const MAX_TOKENS = 700;   // short answers read better on e-ink
const SYSTEM =
  "You are a chat assistant shown on a small black-and-white e-ink screen. " +
  "Reply in plain text only: no markdown, no tables, no emoji. " +
  "Keep answers short and direct unless asked for more detail.";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function cleanHistory(raw) {
  let h;
  try { h = JSON.parse(raw || "[]"); } catch { return []; }
  if (!Array.isArray(h)) return [];
  const out = [];
  for (const m of h) {
    const want = out.length % 2 === 0 ? "user" : "assistant";
    if (!m || m.role !== want || typeof m.content !== "string") break;
    out.push({ role: m.role, content: m.content.slice(0, 6000) });
  }
  if (out.length % 2) out.pop();            // must end on an assistant turn
  return out.slice(-MAX_TURNS * 2);
}

async function askClaude(messages, env) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL || "claude-sonnet-5-5",
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages,
    }),
  });
  if (!r.ok) throw new Error("API error " + r.status + ": " + (await r.text()).slice(0, 300));
  const data = await r.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  return text || "(empty reply)";
}

const paras = (t) =>
  esc(t).split("\n\n").map((p) => "<p>" + p.replace(/\n/g, "<br>") + "</p>").join("");

function page(history, note, action) {
  let log = "";
  for (let i = history.length - 2; i >= 0; i -= 2) {
    log += '<div class="you">You: ' + esc(history[i].content) + "</div>";
    log += "<div>" + paras(history[i + 1].content) + "</div>";
  }
  if (!log) log = "<p>Type a question above.</p>";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Chat</title>
<style>
body{font-family:serif;font-size:22px;line-height:1.4;margin:12px;color:#000;background:#fff}
textarea{width:98%;font-size:22px}
input{font-size:22px;padding:6px 18px}
.you{font-weight:bold;border-top:2px solid #000;padding-top:8px;margin-top:16px}
</style></head><body>
<form method="post" action="${esc(action)}">
<textarea name="q" rows="3"></textarea><br>
<input type="hidden" name="h" value="${esc(JSON.stringify(history))}">
<input type="submit" value="Send">
<input type="submit" name="new" value="New chat">
</form>
${note ? "<p><b>" + esc(note) + "</b></p>" : ""}
${log}
</body></html>`;
}

const html = (body) =>
  new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = "/" + env.SECRET_PATH;
    if (!env.SECRET_PATH || url.pathname !== path) return new Response("Not found. secret set: " + !!env.SECRET_PATH + ", key set: " + !!env.ANTHROPIC_API_KEY, { status: 404 });

    let history = [];
    let note = "";
    if (request.method === "POST") {
      const form = await request.formData();
      if (!form.get("new")) {
        history = cleanHistory(form.get("h"));
        const q = String(form.get("q") || "").trim().slice(0, 2000);
        if (q) {
          try {
            const reply = await askClaude([...history, { role: "user", content: q }], env);
            history = [...history, { role: "user", content: q }, { role: "assistant", content: reply }]
              .slice(-MAX_TURNS * 2);
          } catch (e) {
            note = String(e.message || e);
          }
        }
      }
    }
    return html(page(history, note, path));
  },
};
