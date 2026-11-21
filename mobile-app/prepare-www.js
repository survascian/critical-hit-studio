'use strict';
// Copies the mobile frontend assets from ../public/ into ./www/ for Capacitor packaging.
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const pubDir = path.join(rootDir, 'public');
const wwwDir = path.join(__dirname, 'www');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

fs.rmSync(wwwDir, { recursive: true, force: true });
fs.mkdirSync(path.join(wwwDir, 'fonts'), { recursive: true });

// Render mobile.html -> index.html with version & default accent
const html = fs.readFileSync(path.join(pubDir, 'mobile.html'), 'utf8')
  .split('{{VERSION}}').join(pkg.version || '2.0.2')
  .split('{{ACCENT}}').join('#e60000');
fs.writeFileSync(path.join(wwwDir, 'index.html'), html, 'utf8');

const files = [
  'mobile.css', 'mobile.js', 'cloud.js',
  'plan.js', 'platforms.js', 'genres.js', 'awards.js',
  'icon-72.png', 'icon.png'
];
for (const f of files) {
  fs.copyFileSync(path.join(pubDir, f), path.join(wwwDir, f));
}

const fontsDir = path.join(pubDir, 'fonts');
for (const f of fs.readdirSync(fontsDir)) {
  fs.copyFileSync(path.join(fontsDir, f), path.join(wwwDir, 'fonts', f));
}

console.log(`Prepared mobile-app/www for v${pkg.version} (${files.length + 1} files + fonts)`);
