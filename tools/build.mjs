// Prepares site/ for deploy:
//  1. regenerates site/parlor/tokens.css from design/tokens.json
//  2. writes the service worker's pre-cache list and build id
//  3. writes site/version.json
// Usage: node tools/build.mjs [buildId]   (defaults to the current git short sha, or "dev")
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const site = join(root, 'site');

await import('./build-tokens.mjs');

// The installed app's name and shortcuts come from copy/en.json (app.*), like every other word.
{
  const app = JSON.parse(readFileSync(join(site, 'copy', 'en.json'), 'utf8')).app;
  const mPath = join(site, 'manifest.webmanifest');
  const m = JSON.parse(readFileSync(mPath, 'utf8'));
  Object.assign(m, { name: app.name, short_name: app.shortName, description: app.description });
  const [daily, freecell] = m.shortcuts;
  Object.assign(daily, { name: app.shortcutDaily, short_name: app.shortcutDailyShort });
  Object.assign(freecell, { name: app.shortcutFreecell });
  writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
}

let build = process.argv[2];
if (!build) { try { build = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { build = 'dev'; } }

const SKIP = new Set(['sw.js', '404.html', '.nojekyll', 'version.json', 'index.d.ts']);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    const rel = relative(site, full).split(sep).join('/');
    if (SKIP.has(name) || name.startsWith('LICENSE') || name.endsWith('.schema.json')) continue;
    files.push(rel);
  }
})(site);

// Directory URLs for each page, so "./freecell/" is served from cache.
const assets = ['./', ...files.filter((f) => f.endsWith('/index.html')).map((f) => './' + f.replace(/index\.html$/, '')), ...files.map((f) => './' + f)];

const swPath = join(site, 'sw.js');
const sw = readFileSync(swPath, 'utf8').replace(/\/\/ <build>[\s\S]*?\/\/ <\/build>/,
  `// <build>\nconst BUILD = ${JSON.stringify(build)};\nconst ASSETS = ${JSON.stringify(assets, null, 2)};\n// </build>`);
writeFileSync(swPath, sw);
writeFileSync(join(site, 'version.json'), JSON.stringify({ build, at: new Date().toISOString() }) + '\n');
console.log(`sw.js: ${assets.length} assets, build ${build}`);
