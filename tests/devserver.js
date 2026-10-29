// Local preview: serves docs/ and answers the API with the real .gs files on the made-up sheets (tests/seed.js).
// node tests/devserver.js [port]  →  http://localhost:8780  (admin: grv / admin-pass-1 · division: old@x.in / oldpassword)
const http = require('http'), fs = require('fs'), path = require('path');
const { load } = require('./mock.js'), { books: makeBooks } = require('./seed.js');
const root = path.join(__dirname, '..'), docs = path.join(root, 'docs'), port = +process.argv[2] || 8780;
const books = makeBooks();
const T = load(path.join(root, 'apps-script'), books, { SHEET_IDS: { OFF: 'OFF', FV: 'FV', CDL: 'CDL', ASDEO: 'ASDEO', HR: 'HR' },
  ACCOUNTS: { grv: { role: 'admin', name: 'PMC admin', email: 'gouravsharmaifs@gmail.com', password: 'admin-pass-1' } } });
books.CDL.getSheetByName('Users').v.push(['old@x.in', 'Hill', 'Kurseong', 'Old User', 'RO', '9876543210', 'Active', '01-10-2026', '', 'salt1', T.run("oldHash_('salt1', 'oldpassword')")]);
T.run('hrSetup()');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api') {
    let b = ''; req.on('data', c => b += c);
    req.on('end', () => { let out; try { out = T.ctx.doPost({ postData: { contents: b } }); } catch (e) { out = JSON.stringify({ ok: false, error: String(e.stack) }); }
      setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(out); }, 250); });
    return;
  }
  const url = decodeURIComponent(req.url.split('?')[0]), file = path.join(docs, url === '/' ? 'index.html' : url);
  if (!file.startsWith(docs) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  let body = fs.readFileSync(file);
  if (url === '/js/config.js') body = String(body).replace("API_URL: ''", "API_URL: '/api'");
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
}).listen(port, () => console.log('AranyaHR dev server on http://localhost:' + port + (T.mail.length ? '' : '')));
