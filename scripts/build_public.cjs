// Reproducible allowlist: no tests, dependencies or retired modules in the public artifact.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
// Only this generated directory is rebuilt; authored files are outside it.
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const files = ['index.html', 'app.css', 'app.js', 'sw.js', 'manifest.webmanifest',
  'src/core.js', 'src/storage.js', 'src/ui.js',
  ...fs.readdirSync(path.join(root, 'data')).filter(name => /^jgp-(data|characteristics)-(meta|\d{2})\.js$/.test(name)).map(name => 'data/' + name),
  'data/nfz-coefficients.js', 'data/cost-accounting.js', 'data/cost-accounting-regulation.js', 'data/key-change.js', 'data/mz-legislation.json',
  'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
for (const file of files) {
  const destination = path.join(out, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^https?:/.test(match[1])) continue;
  if (!fs.existsSync(path.join(out, match[1]))) throw new Error('Missing asset: ' + match[1]);
}
console.log(`Public build: ${files.length} files; no retired modules or development dependencies.`);
