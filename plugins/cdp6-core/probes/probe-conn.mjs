import { connect } from 'node:net';

const host = process.argv[2];
const proxy = process.env.HTTPS_PROXY;
const timeout = Number(process.env.CDP6_PROBE_CONN_TIMEOUT_MS) || 10000;

function finish(text, socket) {
  console.log(text);
  if (socket) socket.destroy();
  process.exit(0);
}

if (!proxy) finish('error NOPROXY');
const url = new URL(proxy);
const socket = connect(Number(url.port) || 80, url.hostname);
socket.setTimeout(timeout, () => finish('error ETIMEDOUT', socket));
socket.on('error', (e) => finish(`error ${e.code}`, socket));
const auth = url.username ? `Proxy-Authorization: Basic ${Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString('base64')}\r\n` : '';
socket.on('connect', () => socket.write(`CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\n${auth}\r\n`));
let buffer = '';
socket.on('data', (d) => {
  buffer += d;
  const end = buffer.indexOf('\r\n');
  if (end >= 0) finish(buffer.slice(0, end), socket);
});
