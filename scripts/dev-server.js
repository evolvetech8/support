import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function handleApi(req, res, pathname) {
  try {
    let modPath = null;
    if (pathname === '/api/auth/login') modPath = '../api/auth/login.js';
    else if (pathname === '/api/auth/logout') modPath = '../api/auth/logout.js';
    else if (pathname === '/api/auth/me') modPath = '../api/auth/me.js';
    else if (pathname === '/api/metrics') modPath = '../api/metrics.js';
    else if (pathname === '/api/sync') modPath = '../api/sync.js';

    if (modPath) {
      const { default: handler } = await import(modPath);
      return handler(req, res);
    }
  } catch (err) {
    console.error('API Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'not_found' }));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // API routing
  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname);
  }

  // Rewrite clean URLs
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  else if (pathname === '/dashboard') pathname = '/dashboard.html';
  else if (pathname === '/privacy') pathname = '/privacy.html';
  else if (pathname === '/terms') pathname = '/terms.html';
  else if (pathname === '/support') pathname = '/index.html';

  const filePath = path.join(rootDir, pathname);

  if (!filePath.startsWith(rootDir)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      return res.end('Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Archonic Studio dev server running at http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
});
