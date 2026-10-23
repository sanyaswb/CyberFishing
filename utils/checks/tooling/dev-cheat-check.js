const assert = require('node:assert/strict');
const { StaticFileServer, StaticFileResolver } = require('../../dev-server.js');
const { SourceRuntime } = require('../../testing/core/source_runtime.js');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '../../..');
  const resolver = new StaticFileResolver(root);
  for (const file of ['/utils/server/dev_cheat_endpoint.js', '/specs/139-devtools-cheat/spec.md', '/.git/config', '/tasks.md']) assert.equal(resolver.resolve(file), null);
  assert(resolver.resolve('/dev.html') && resolver.resolve('/src/entrypoints/dev.entry.js'));
  const server = new StaticFileServer({ rootDir: root }).createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const command = (candidate, extra = {}) => fetch(origin + '/__dev/command', { method: 'POST', headers: {
      'Content-Type': 'application/json', Origin: origin, ...extra }, body: JSON.stringify({ candidate }) });
    assert.equal((await (await command('prefixhesoyam')).json()).action, 'openDevTools');
    assert.equal((await (await command('wrong')).json()).action, null);
    assert.equal((await command('hesoyam', { Origin: 'http://foreign.test' })).status, 403);
    assert.equal((await command('a'.repeat(300))).status, 413);
    assert.equal((await fetch(origin + '/utils/server/dev_cheat_endpoint.js')).status, 403);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

  const { DevCheatInput } = new SourceRuntime().importModule('src/dev/tools/dev_cheat_input.js');
  const listeners = new Map(), timers = new Map(), pending = []; let next = 0, opened = 0;
  const target = { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  const scheduler = { setTimeout(fn) { timers.set(++next, fn); return next; }, clearTimeout(id) { timers.delete(id); } };
  const input = new DevCheatInput({ target, scheduler, createAbortController: () => new AbortController(), open: () => opened++,
    fetchCommand: (url, options) => new Promise(resolve => pending.push({ resolve, url, options })) });
  const key = (letter, target = null) => listeners.get('keydown')({ key: letter, target });
  const flush = () => { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); };
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };
  for (const letter of 'arbitrary') key(letter);
  assert.equal(timers.size, 1); flush(); assert.equal(pending.length, 1);
  assert.equal(JSON.parse(pending[0].options.body).candidate, 'arbitrary', 'client transports candidates without a local dictionary');
  key('x'); pending[0].resolve({ ok: true, json: async () => ({ action: 'openDevTools' }) }); await settle();
  assert.equal(opened, 0, 'stale answers cannot open the panel');
  flush(); pending[1].resolve({ ok: true, json: async () => ({ action: 'openDevTools' }) }); await settle(); assert.equal(opened, 1);
  key('a', { closest: () => ({}) }); assert.equal(timers.size, 0, 'typing in a field is ignored');
  key('z'); flush(); listeners.get('blur')();
  pending[2].resolve({ ok: true, json: async () => ({ action: 'openDevTools' }) }); await settle(); assert.equal(opened, 1);
  key('q'); flush(); input.dispose();
  pending[3].resolve({ ok: true, json: async () => ({ action: 'openDevTools' }) }); await settle();
  assert.equal(opened, 1); assert.equal(listeners.size, 0); assert.equal(timers.size, 0);
  console.log('DEV cheat passed: real server verification, static-source exclusion, bounded/debounced keyboard input, stale replies and disposal.');
})().catch(error => { console.error(error); process.exitCode = 1; });
