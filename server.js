import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const TOKEN = process.env.TOKEN || 'secret123';
const PTOKEN = process.env.PANEL_TOKEN || 'panel123';
const PORT = +(process.env.PORT || 8080);
const dir = path.dirname(fileURLToPath(import.meta.url));

const agents = new Map();
const panels = new Set();
const meta = new Map();

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/p')) {
    if (u.searchParams.get('token') !== PTOKEN) { res.writeHead(401); return res.end('no'); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(dir, 'panel.html')));
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('ok');
});

const wssA = new WebSocketServer({ server: srv, path: '/agent' });
wssA.on('connection', (ws, req) => {
  const u = new URL(req.url, 'http://x');
  if (u.searchParams.get('token') !== TOKEN) return ws.close();
  const id = u.searchParams.get('id') || Math.random().toString(36).slice(2, 10);
  agents.set(id, ws);
  ws.on('message', m => {
    let o; try { o = JSON.parse(m.toString()); } catch { return; }
    if (o.c === 'hello') {
      meta.set(id, o);
      panels.forEach(p => p.send(JSON.stringify({ c: 'dev', id, m: o, on: true })));
    }
    if (o.c === 'f') {
      panels.forEach(p => p.send(JSON.stringify({ c: 'f', id, d: o.d, w: o.w, h: o.h })));
      return;
    }
    panels.forEach(p => p.send(JSON.stringify({ c: 'ev', id, m: o })));
  });
  ws.on('close', () => {
    agents.delete(id);
    panels.forEach(p => p.send(JSON.stringify({ c: 'dev', id, m: meta.get(id) || {}, on: false })));
  });
  panels.forEach(p => p.send(JSON.stringify({ c: 'dev', id, m: meta.get(id) || {}, on: true })));
});

const wssP = new WebSocketServer({ server: srv, path: '/panel' });
wssP.on('connection', (ws, req) => {
  const u = new URL(req.url, 'http://x');
  if (u.searchParams.get('token') !== PTOKEN) return ws.close();
  panels.add(ws);
  for (const [id, m] of meta) ws.send(JSON.stringify({ c: 'dev', id, m, on: agents.has(id) }));
  ws.on('message', m => {
    let o; try { o = JSON.parse(m.toString()); } catch { return; }
    if (o.c === 'cmd') agents.get(o.id)?.send(JSON.stringify(o.m));
  });
  ws.on('close', () => panels.delete(ws));
});

srv.listen(PORT, () => console.log('listening on ' + PORT));
