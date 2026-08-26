import { createServer } from 'node:http';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
const DIR = process.argv[2];
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.end();
  const name = decodeURIComponent((req.url || '/').slice(1).split('?')[0]).replace(/[^\w.-]/g, '_');
  if (req.method === 'GET') {
    const p = DIR + '/' + name;
    if (!existsSync(p)) { res.statusCode = 404; return res.end('missing'); }
    return res.end(readFileSync(p, 'utf8'));
  }
  let b = '';
  req.on('data', c => (b += c));
  req.on('end', () => { writeFileSync(DIR + '/' + name, b); res.end('ok ' + b.length); });
}).listen(5399, () => console.log('sink on 5399 ->', DIR));
