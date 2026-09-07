// Local dev server: serves the static files and routes POST /api/* to the
// same handler modules Vercel runs in production (api/embed.js,
// api/generate.js), so local dev exercises the real code path.
//
// Usage:
//   1. Create a .env file (copy .env.example) with your GEMINI_API_KEY.
//   2. node dev-server.cjs   (or: npm start)
//   3. Open http://localhost:3000
//
// This file is named .cjs (and loads the /api handlers via Module._compile
// rather than require()) to sidestep a Node.js module-type auto-detection
// bug that misfires on paths containing certain non-ASCII characters
// (e.g. OneDrive folders with Korean names) — it can misidentify a plain
// CommonJS file as an ES module. Vercel's own runtime is unaffected, so the
// /api files themselves stay plain .js.

const http = require('http');
const fs = require('fs');
const path = require('path');
const Module = require('module');

// Minimal .env loader (no dependency) — only sets vars not already set.
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = (match[2] || '').replace(/^["']|["']$/g, '');
    }
  }
}

// Loads a CommonJS file via Module._compile directly, bypassing Node's
// file-extension-based module-type detection (see note above).
function loadCjs(filePath) {
  const mod = new Module(filePath, module);
  mod.filename = filePath;
  mod.paths = Module._nodeModulePaths(path.dirname(filePath));
  mod._compile(fs.readFileSync(filePath, 'utf8'), filePath);
  return mod.exports;
}

const PORT = process.env.PORT || 3000;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const apiRoutes = {
  '/api/embed': loadCjs(path.join(__dirname, 'api', 'embed.js')),
  '/api/generate': loadCjs(path.join(__dirname, 'api', 'generate.js'))
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const handler = apiRoutes[req.url];
  if (handler) {
    try {
      req.body = await readJsonBody(req);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body.' }));
      return;
    }
    res.status = code => {
      res.statusCode = code;
      return res;
    };
    res.json = obj => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
    };
    await handler(req, res);
    return;
  }

  const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY is not set — create a .env file (see .env.example).');
  }
  console.log(`Knowledge Bot running at http://localhost:${PORT}`);
});
