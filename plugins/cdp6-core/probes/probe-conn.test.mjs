import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const CONN = join(DIR, 'probe-conn.mjs');
const CHILD = join(DIR, 'probe-conn-child.mjs');

function stub(reply) {
  const seen = [];
  const server = createServer((socket) => {
    socket.once('data', (d) => {
      seen.push(d.toString());
      if (reply) socket.write(reply);
    });
    socket.on('error', () => {});
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, port: server.address().port })));
}

function run(script, args, env) {
  return new Promise((resolve) => {
    const p = spawn('node', [script, ...args], { env: { PATH: process.env.PATH, ...env } });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', (code) => resolve({ code, out }));
  });
}

test('A-12: probe-conn sends CONNECT host:443 to HTTPS_PROXY and prints the first response line', async () => {
  const { server, seen, port } = await stub('HTTP/1.1 403 Forbidden\r\nX-Proxy-Error: blocked-by-allowlist\r\n\r\n');
  try {
    const r = await run(CONN, ['example.org'], { HTTPS_PROXY: `http://127.0.0.1:${port}` });
    assert.equal(r.out, 'HTTP/1.1 403 Forbidden\n');
    assert.equal(r.code, 0);
    assert.match(seen[0], /^CONNECT example\.org:443 HTTP\/1\.1\r\n/);
  } finally {
    server.close();
  }
});

test('A-12: probe-conn sends the HTTPS_PROXY credentials as Proxy-Authorization', async () => {
  const { server, seen, port } = await stub('HTTP/1.1 403 Forbidden\r\n\r\n');
  try {
    const r = await run(CONN, ['example.org'], { HTTPS_PROXY: `http://us%40r:p%3Ass@127.0.0.1:${port}` });
    assert.equal(r.out, 'HTTP/1.1 403 Forbidden\n');
    assert.match(seen[0], new RegExp(`\\r\\nProxy-Authorization: Basic ${Buffer.from('us@r:p:ss').toString('base64')}\\r\\n`));
  } finally {
    server.close();
  }
});

test('A-12: probe-conn sends no Proxy-Authorization without credentials', async () => {
  const { server, seen, port } = await stub('HTTP/1.1 403 Forbidden\r\n\r\n');
  try {
    await run(CONN, ['example.org'], { HTTPS_PROXY: `http://127.0.0.1:${port}` });
    assert.doesNotMatch(seen[0], /Proxy-Authorization/);
  } finally {
    server.close();
  }
});

test('A-12: probe-conn prints the allowed line for a 200 and does not stay open', async () => {
  const { server, port } = await stub('HTTP/1.1 200 Connection established\r\n\r\n');
  try {
    const r = await run(CONN, ['example.org'], { HTTPS_PROXY: `http://127.0.0.1:${port}` });
    assert.equal(r.out, 'HTTP/1.1 200 Connection established\n');
  } finally {
    server.close();
  }
});

test('A-12: probe-conn prints error <code> when the proxy is unreachable', async () => {
  const { server, port } = await stub(null);
  await new Promise((resolve) => server.close(resolve));
  const r = await run(CONN, ['example.org'], { HTTPS_PROXY: `http://127.0.0.1:${port}` });
  assert.equal(r.out, 'error ECONNREFUSED\n');
});

test('A-12: probe-conn prints error NOPROXY without HTTPS_PROXY', async () => {
  const r = await run(CONN, ['example.org'], {});
  assert.equal(r.out, 'error NOPROXY\n');
});

test('A-12: probe-conn prints error ETIMEDOUT when the proxy never answers', async () => {
  const { server, port } = await stub(null);
  try {
    const r = await run(CONN, ['example.org'], { HTTPS_PROXY: `http://127.0.0.1:${port}`, CDP6_PROBE_CONN_TIMEOUT_MS: '300' });
    assert.equal(r.out, 'error ETIMEDOUT\n');
  } finally {
    server.close();
  }
});

test('A-12: probe-conn-child runs probe-conn from a child process with the same environment', async () => {
  const { server, seen, port } = await stub('HTTP/1.1 403 Forbidden\r\n\r\n');
  try {
    const r = await run(CHILD, ['nonexistent.invalid'], { HTTPS_PROXY: `http://127.0.0.1:${port}` });
    assert.equal(r.out, 'HTTP/1.1 403 Forbidden\n');
    assert.match(seen[0], /^CONNECT nonexistent\.invalid:443 /);
  } finally {
    server.close();
  }
});
