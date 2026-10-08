// Exports every stage-plot symbol in index.html to symbols/<type>.svg
// Usage: node tools/export-symbols.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const block = (name) => {
  const m = html.match(new RegExp(`/\\* ${name}:BEGIN \\*/([\\s\\S]*?)/\\* ${name}:END \\*/`));
  if (!m) throw new Error(`Missing ${name} block in index.html`);
  return m[1];
};
const { CAT, SYM, SYM_CSS } = new Function(`${block('CAT')}\n${block('SYMBOLS')}\nreturn { CAT, SYM, SYM_CSS };`)();

const PX_PER_FT = 48;
const outDir = join(root, 'symbols');
mkdirSync(outDir, { recursive: true });
const rows = [];
for (const [type, art] of Object.entries(SYM)) {
  const c = CAT[type];
  const m = Math.max(c.w, c.d) / 2 + 0.4;
  const size = Math.round(2 * m * PX_PER_FT);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${2 * m} ${2 * m}" width="${size}" height="${size}">
<title>${c.name}</title>
<style>${SYM_CSS.replace(/\s*\n\s*/g, '')}</style>
<rect x="${-m}" y="${-m}" width="${2 * m}" height="${2 * m}" rx="${(m * 0.12).toFixed(3)}" fill="#20272d"/>
${art}
</svg>
`;
  writeFileSync(join(outDir, `${type}.svg`), svg);
  rows.push(`| ![${c.name}](${type}.svg) | \`${type}\` | ${c.name} | ${(c.w * 0.3048).toFixed(2)} × ${(c.d * 0.3048).toFixed(2)} m |`);
}
writeFileSync(join(outDir, 'README.md'), `# Stage-plot symbols

Top-down symbols used on the Stageplot plot, drawn to real size (feet internally, metres shown).
Downstage (toward the audience) is the bottom of each drawing. Regenerate with \`node tools/export-symbols.mjs\`.

| Symbol | Key | Item | Footprint |
|---|---|---|---|
${rows.join('\n')}
`);
console.log(`Wrote ${rows.length} symbols to ${outDir}`);
