// Föderations-Transporte (UC-06/07/11). Bisher war nur ein In-Process-Loopback getestet;
// hier die realen Transporte: HTTP (Node↔Node, dezentral) + Bundle-Adapter (docker exec → PHP).
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';

// --- HTTP-Server: exponiert exportSince (GET /export) + receiveIngest (POST /ingest) ---
export function httpServer(engine, { port = 0, host = '127.0.0.1' } = {}) {
  const server = createServer((req, res) => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method === 'GET' && req.url.startsWith('/export')) {
      const since = (() => { try { return JSON.parse(new URL(req.url, 'http://x').searchParams.get('since') ?? '{}'); } catch { return {}; } })();
      return send(200, engine.exportSince(since));
    }
    if (req.method === 'POST' && req.url === '/ingest') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 5_000_000) req.destroy(); }); // 5 MB Limit (DoS)
      req.on('end', () => { try { send(200, engine.receiveIngest(JSON.parse(body))); } catch { send(400, { error: 'BAD_REQUEST' }); } });
      return;
    }
    send(404, { error: 'NOT_FOUND' });
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve({ server, url: `http://${host}:${server.address().port}` })));
}

// --- HTTP-Client: erfüllt das Transport-Interface (exportSince/receiveIngest) ---
export function httpClient(baseUrl, { timeoutMs = 5000 } = {}) {
  const withTimeout = (p, ctrl) => { const t = setTimeout(() => ctrl.abort(), timeoutMs); return p.finally(() => clearTimeout(t)); };
  return {
    async exportSince(since = {}) {
      const ctrl = new AbortController();
      const r = await withTimeout(fetch(`${baseUrl}/export?since=${encodeURIComponent(JSON.stringify(since))}`, { signal: ctrl.signal }), ctrl);
      if (!r.ok) throw new Error(`export ${r.status}`);
      return r.json();
    },
    async receiveIngest(batch) {
      const ctrl = new AbortController();
      const r = await withTimeout(fetch(`${baseUrl}/ingest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(batch), signal: ctrl.signal }), ctrl);
      if (!r.ok) throw new Error(`ingest ${r.status}`);
      return r.json();
    },
  };
}

// --- Bundle-Adapter: docker exec → PHP-Commands (nsai:graph:export/ingest). ---
// SICHERHEIT: ausschließlich child_process.execFile mit Argument-ARRAY — kein Shell-String,
// keine Interpolation des Container-Namens/der Payload (verhindert Command-Injection, AC-Sec-7).
// Die PHP-Commands existieren noch nicht (Phase 2) → Aufrufe scheitern kontrolliert (SyncSkipped).
export function bundleAdapter({ container, php = 'php', console: consolePath = 'bin/console' } = {}) {
  if (!container || !/^[\w.\-]+$/.test(container)) throw new Error('INVALID_CONTAINER');
  const run = (args, stdin) => new Promise((resolve, reject) => {
    const child = execFile('docker', ['exec', '-i', container, php, consolePath, ...args], { timeout: 10000, maxBuffer: 16_000_000 },
      (err, stdout) => (err ? reject(Object.assign(new Error('SyncSkippedException'), { code: 'SYNC_SKIPPED', cause: err })) : resolve(stdout)));
    if (stdin !== undefined) { child.stdin.end(stdin); }
  });
  return {
    // Exponiert für Tests/Inspektion, welche Argumente konstruiert würden (ohne Shell).
    _exportArgs: (since = {}) => ['exec', '-i', container, php, consolePath, 'nsai:graph:export', '--since', JSON.stringify(since)],
    _ingestArgs: () => ['exec', '-i', container, php, consolePath, 'nsai:graph:ingest'],
    async exportSince(since = {}) { return JSON.parse(await run(['nsai:graph:export', '--since', JSON.stringify(since)])); },
    async receiveIngest(batch) { return JSON.parse(await run(['nsai:graph:ingest'], JSON.stringify(batch))); },
  };
}
