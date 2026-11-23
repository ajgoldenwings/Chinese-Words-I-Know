import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const OUT = process.argv[2];
const map = JSON.parse(fs.readFileSync(new URL('./map.json', import.meta.url)));
const BASE = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/svg/';
const S = '#3b3b3b';
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;
const custom = {
  tofu: wrap(`<g stroke="${S}" stroke-width="4"><polygon points="24,56 64,40 104,56 64,72" fill="#FFFFFF"/><polygon points="24,56 64,72 64,106 24,90" fill="#EFE6CF"/><polygon points="104,56 64,72 64,106 104,90" fill="#FFF6DD"/></g>`),
  table: wrap(`<g stroke="${S}" stroke-width="4"><rect x="22" y="58" width="12" height="44" rx="3" fill="#A0682D"/><rect x="94" y="58" width="12" height="44" rx="3" fill="#A0682D"/><rect x="10" y="40" width="108" height="20" rx="6" fill="#D9955A"/></g>`),
  cup: wrap(`<g stroke="${S}" stroke-width="4"><path d="M88 50h8a14 14 0 0 1 0 28h-8" fill="none" stroke-width="9"/><path d="M88 50h8a14 14 0 0 1 0 28h-8" fill="none" stroke="#4FC3F7" stroke-width="3"/><path d="M28 38h60v44a14 14 0 0 1-14 14H42a14 14 0 0 1-14-14z" fill="#4FC3F7"/><path d="M38 50v28" stroke="#fff" stroke-width="5" opacity=".6" fill="none"/></g>`),
  belly: wrap(`<g stroke="${S}" stroke-width="4"><ellipse cx="20" cy="64" rx="11" ry="20" fill="#FFCC80" transform="rotate(12 20 64)"/><ellipse cx="108" cy="64" rx="11" ry="20" fill="#FFCC80" transform="rotate(-12 108 64)"/><path d="M44 14h40c8 0 14 6 16 14 4 20 10 40 4 62-3 12-12 18-24 18H48c-12 0-21-6-24-18-6-22 0-42 4-62 2-8 8-14 16-14z" fill="#FFCC80"/><path d="M30 92c10 6 58 6 68 0l2 14c-2 6-8 10-14 10H42c-6 0-12-4-14-10z" fill="#5C9BE0"/><path d="M64 68c-4 0-4 6 0 6s4-8-3-8" fill="none"/><circle cx="64" cy="74" r="3.5" fill="${S}"/><path d="M44 52c4 12 8 16 14 18" fill="none" stroke="#fff" stroke-width="5" opacity=".5"/></g>`),
  river: wrap(`<rect x="8" y="8" width="112" height="112" rx="18" fill="#A5D6A7" stroke="${S}" stroke-width="4"/><path d="M40 10C100 34 24 58 66 84S60 112 90 118" fill="none" stroke="${S}" stroke-width="34"/><path d="M40 10C100 34 24 58 66 84S60 112 90 118" fill="none" stroke="#4FC3F7" stroke-width="26"/><path d="M44 22C80 38 46 56 70 74" fill="none" stroke="#fff" stroke-width="5" opacity=".6"/>`),
};
const colorSvg = (c) => wrap(`<circle cx="64" cy="64" r="48" fill="${c}" stroke="${S}" stroke-width="5"/><path d="M38 52a30 30 0 0 1 22-18" fill="none" stroke="#fff" stroke-width="7" opacity=".55"/>`);

async function getSvg(code) {
  const tries = [code, code.replace(/_/g, '_fe0f_').replace(/^([0-9a-f]+)_fe0f_/, '$1_fe0f_')];
  const parts = code.split('_');
  const cands = [parts.join('_'), parts[0] + '_fe0f' + (parts.length > 1 ? '_' + parts.slice(1).join('_') : '')];
  for (const c of cands) {
    const r = await fetch(`${BASE}emoji_u${c}.svg`);
    if (r.ok) return await r.text();
  }
  return null;
}
function render(svg, file) {
  const s = svg.replace(/viewBox="0 0 128 128"/, 'viewBox="-14 -14 156 156"');
  const png = new Resvg(s, { fitTo: { mode: 'width', value: 800 } }).render().asPng();
  fs.writeFileSync(file, png);
}
const missing = [];
for (const [group, dir] of [['words', 'words'], ['categories', 'categories']]) {
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const [slug, code] of Object.entries(map[group])) {
    let svg;
    if (code.startsWith('custom:color:')) svg = colorSvg(code.slice(13));
    else if (code.startsWith('custom:')) svg = custom[code.slice(7)];
    else svg = await getSvg(code);
    if (!svg) { missing.push(`${dir}/${slug} (${code})`); continue; }
    render(svg, path.join(OUT, dir, `${slug}.png`));
  }
}
console.log('missing:', missing);
