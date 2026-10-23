// Server-owned DEV command definitions. Never imported by browser modules or served as a static asset.
function handleDevCheat(request, response) {
  const finish = (status, data) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(data));
  };
  let origin;
  try { origin = new URL(request.headers.origin); } catch { finish(403, {}); return; }
  if (origin.protocol !== 'http:' || origin.host !== request.headers.host) { finish(403, {}); return; }
  if (request.method !== 'POST') { finish(405, {}); return; }
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') { finish(415, {}); return; }
  let body = '', bytes = 0, rejected = false;
  request.on('data', chunk => {
    bytes += chunk.length;
    if (bytes > 256) { if (!rejected) finish(413, {}); rejected = true; return; }
    body += chunk;
  });
  request.on('end', () => {
    if (rejected) return;
    try {
      const { candidate } = JSON.parse(body);
      const valid = typeof candidate === 'string' && /^[a-z]{1,32}$/.test(candidate);
      finish(200, { action: valid && candidate.endsWith('hesoyam') ? 'openDevTools' : null });
    } catch { finish(400, {}); }
  });
}
module.exports = { handleDevCheat };
