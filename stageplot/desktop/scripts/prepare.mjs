// Copies the web app (one HTML file, its manifest and icons) next to the desktop shell, so the installer carries the same Stageplot the browser runs.
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), web = join(here, '..', '..'), out = join(here, '..', 'app');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest']) cpSync(join(web, f), join(out, f));
cpSync(join(web, 'icons'), join(out, 'icons'), { recursive: true });
// the app icon for the installers: the 512 px web icon (electron-builder makes the .icns and .ico from it)
cpSync(join(web, 'icons', 'icon-512.png'), join(here, '..', 'build', 'icon.png'));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
writeFileSync(join(out, 'version.json'), JSON.stringify({ version: pkg.version }));
console.log(`Prepared Stageplot ${pkg.version} in ${out}`);
