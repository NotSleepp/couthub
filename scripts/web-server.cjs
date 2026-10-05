const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createApiBridge } = require('../electron/api-server');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.ACCOUNT_HUB_WEB_PORT || 4173);
const mime = {
  '.css':'text/css; charset=utf-8', '.html':'text/html; charset=utf-8', '.ico':'image/x-icon',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8', '.webp':'image/webp',
};
const bridge = createApiBridge();

function send(res, status, message, extra = {}) {
  res.writeHead(status, { 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store', ...extra });
  res.end(message);
}

function isLocalRequest(req) {
  const address = req.socket.remoteAddress || '';
  const host = req.headers.host || '';
  return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)
    && /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host);
}

async function serve(req, res) {
  if (req.url?.startsWith('/api/')) return bridge.handleApiRequest(req, res);
  if (!isLocalRequest(req)) return send(res, 403, 'Acceso local requerido.');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Método no permitido.', { Allow:'GET, HEAD' });

  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return send(res, 400, 'Ruta inválida.'); }
  if (pathname.includes('\0')) return send(res, 400, 'Ruta inválida.');

  let filename = path.resolve(dist, '.' + pathname);
  if (filename !== dist && !filename.startsWith(dist + path.sep)) return send(res, 403, 'Ruta no permitida.');
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    const isAsset = path.extname(pathname) !== '';
    if (isAsset) return send(res, 404, 'Archivo no encontrado.');
    filename = path.join(dist, 'index.html');
  }

  let stat;
  try { stat = fs.statSync(filename); }
  catch { return send(res, 503, 'Primero generá la aplicación web con npm run web:build.'); }
  const isIndex = filename === path.join(dist, 'index.html');
  const headers = {
    'Content-Type':mime[path.extname(filename).toLowerCase()] || 'application/octet-stream',
    'Content-Length':stat.size,
    'Cache-Control':isIndex ? 'no-store' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filename).on('error', () => { if (!res.headersSent) send(res, 500, 'Error al leer la aplicación.'); else res.destroy(); }).pipe(res);
}

function close() {
  server.close(() => { bridge.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
}

const server = http.createServer((req, res) => { serve(req, res).catch(err => { if (!res.headersSent) send(res, 500, 'Error en Account Hub.'); console.error(err.message); }); });
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('ACCOUNT_HUB_WEB_PORT debe ser un puerto entre 1024 y 65535.');
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Falta dist/index.html. Ejecutá npm run web:build primero.');
server.on('error', err => { bridge.close(); console.error(err.code === 'EADDRINUSE' ? `El puerto ${port} ya está ocupado.` : err.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Account Hub listo en http://127.0.0.1:${port} (solo en esta PC).`));
process.on('SIGINT', close);
process.on('SIGTERM', close);
