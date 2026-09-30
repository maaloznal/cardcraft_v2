import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve } from 'node:path';

const host = '127.0.0.1';
const port = 4173;
const outputRoot = resolve('out');
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '/cardcraft_v2').replace(/\/$/, '');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveRequestPath(pathname) {
  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return null;

  const requestPath = decodeURIComponent(pathname.slice(basePath.length) || '/');
  const normalizedPath = normalize(requestPath).replace(/^[/\\]+/, '');
  const candidate = resolve(outputRoot, normalizedPath);
  const candidateRelativePath = relative(outputRoot, candidate);

  if (candidateRelativePath.startsWith('..')) return null;
  return candidate;
}

async function findFile(candidate) {
  const candidates = [candidate];
  if (!extname(candidate)) {
    candidates.push(join(candidate, 'index.html'), `${candidate}.html`);
  }

  for (const filePath of candidates) {
    try {
      if ((await stat(filePath)).isFile()) return filePath;
    } catch {
      // Try the next static-export path form.
    }
  }

  return null;
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${host}:${port}`);
    const candidate = resolveRequestPath(url.pathname);
    const filePath = candidate ? await findFile(candidate) : null;

    if (!filePath) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': contentTypes[extname(filePath)] || 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : 'Static server error');
  }
}).listen(port, host, () => {
  console.log(`Serving ${outputRoot} at http://${host}:${port}${basePath}/`);
});
