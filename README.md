# Knowledge Bot

A lightweight RAG-based knowledge bot powered by Gemini. Add any documents, ask questions, and get answers grounded in your content.

Built as a sprint prototype demonstrating core RAG concepts: document ingestion, text chunking, semantic (embedding-based) retrieval, context injection, and source attribution.

---

## How it works

```
Documents → Chunked into paragraphs → Each chunk embedded (gemini-embedding-001)
                                              ↓
User question → Embedded → Cosine similarity vs. chunks → Top 4 chunks retrieved
                                              ↓
              Context injected into prompt → Gemini answers → Sources shown
```

The Gemini API key never reaches the browser — `script.js` calls two tiny serverless functions (`/api/embed`, `/api/generate`) that hold the key server-side and proxy the actual Gemini requests. See `api/embed.js` and `api/generate.js`.

---

## Getting started

The app needs a tiny backend to keep the Gemini API key off the client (see [How it works](#how-it-works)), so it can't just be opened as a static file anymore — run it with the included dev server.

1. Get a key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Copy `.env.example` to `.env` and paste your key in:
   ```
   GEMINI_API_KEY=your-key-here
   ```
3. Run it:
   ```bash
   npm start
   # or: node dev-server.cjs
   ```
4. Open `http://localhost:3000`.

`.env` is git-ignored — your key never gets committed.

---

## Deploying it live

This is a static frontend plus two serverless functions, which [Vercel](https://vercel.com)'s free tier hosts natively with zero config:

1. Push this repo to GitHub (rotate your API key first if it was ever hardcoded or committed anywhere — see [Security notes](#security-notes)).
2. Go to [vercel.com/new](https://vercel.com/new), import the repo, and deploy — no build settings needed.
3. In the project's **Settings → Environment Variables**, add `GEMINI_API_KEY` with your key.
4. Redeploy. Your live URL (`https://your-project.vercel.app`, or a custom domain) is ready to put on your CV.

Netlify and Cloudflare Pages work the same way (static site + `/api` functions, key set as an environment variable) if you'd rather use one of those.

---

## Security notes

- The Gemini key lives only in the server environment (`.env` locally, an env var on your host) — it is never sent to the browser.
- If you ever had a key hardcoded directly in `script.js` or `index.html` (an earlier version of this project did), treat it as compromised: rotate it at [Google AI Studio](https://aistudio.google.com/apikey) before deploying, even if it was never pushed to a public repo.

---

## Features

- Add multiple documents via a paste interface
- Automatic paragraph-based chunking
- Semantic retrieval via Gemini embeddings — finds the most relevant chunks by meaning, not just keyword overlap
- Gemini API key stays server-side behind two small proxy functions
- Source attribution shown below each answer
- Thinking indicator while Gemini processes
- Clean dark UI with Space Grotesk and Inter fonts

---

## Project structure

```
knowledge-bot/
├── index.html        # App markup
├── style.css         # Styling
├── script.js         # App logic: chunking, retrieval, chat
├── api/
│   ├── embed.js      # Serverless proxy → Gemini embeddings
│   └── generate.js   # Serverless proxy → Gemini chat
├── dev-server.cjs    # Local dev server (serves static files + /api routes)
├── package.json      # `npm start`
├── .env.example      # Copy to .env and add your GEMINI_API_KEY
├── README.md         # This file
└── .gitignore        # Ignores .env and other common files
```

---

## Production upgrade path

This prototype is intentionally simple. A production version would add:

| What | Why |
|---|---|
| Supabase + pgvector | Persist documents across sessions with real vector storage (currently in-memory, lost on refresh) |
| Hybrid search | Combine vector search with BM25 keyword search |
| Reranker | Score retrieved chunks more precisely before sending to Gemini |
| Chunk overlap + multi-turn context | Avoid losing answers split across chunk boundaries; support follow-up questions |
| Auth + rate limiting on the proxy | Stop the public `/api` routes being called outside the app |
| Eval loop | Measure and track retrieval quality over time with golden Q&A pairs |
| File upload | Support PDF, DOCX, and other formats instead of paste-only |

---

## Tech stack

- Vanilla HTML, CSS, JavaScript on the frontend (no framework, no build step)
- [Google Gemini API](https://ai.google.dev/): `gemini-2.5-flash` for answers, `gemini-embedding-001` for retrieval
- Two small Node.js serverless functions (`/api/embed`, `/api/generate`) keeping the API key off the client — deployed on [Vercel](https://vercel.com)
- [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) + [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts

---

## Built for

This was built as a sprint prototype to demonstrate RAG concepts for a junior AI integration engineering role. It covers the core pipeline end to end and is designed to be readable, explainable, and easy to hand off to an engineering team for production.
