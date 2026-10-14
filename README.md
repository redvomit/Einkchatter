# eink-chat

Text-only Claude chat for NetSurf on a reMarkable (or any e-ink / lightweight browser).
No JavaScript is sent to the browser. The page is plain HTML forms; a Cloudflare Worker
(free tier) holds your API key and talks to Claude.

GitHub Pages can't do this on its own: it only serves static files, and an API key
placed in a static page is public. So GitHub holds the code, Cloudflare runs it.

## Deploy

1. Put these files in a GitHub repo.
2. In Cloudflare: Workers & Pages -> Create -> connect that GitHub repo.
   (Or from a computer with Node: `npx wrangler deploy`.)
3. Add two secrets to the Worker (dashboard settings, or `npx wrangler secret put NAME`):
   - `ANTHROPIC_API_KEY`: your key
   - `SECRET_PATH`: a long random string, e.g. `k7f2x9qmw4ztb8`
4. Optional variable: `CLAUDE_MODEL` (default `claude-sonnet-5-5`).
5. On the reMarkable, open `https://<your-worker>.workers.dev/<SECRET_PATH>` in NetSurf and bookmark it.

## Notes

- The secret path is the only lock. Anyone who has the URL can spend your credits,
  so don't share it, and set a monthly spend limit in the Anthropic console.
- Chat history lives in the page itself (last 6 exchanges); nothing is stored on the server.
- Don't reload after sending, or the browser will resend your last question.
- This uses HTTPS. If NetSurf on your tablet shows a certificate error, its CA
  bundle is likely missing or outdated; see the NetSurf-reMarkable docs.
