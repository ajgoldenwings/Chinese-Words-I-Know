import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_SETTINGS } from '@shared/entities';
import { SETTING_ROWS } from '../../src/web/app/screens/settings/settings-panel.component';
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');
/** Every file with color classes. A new one must be added here, which keeps it under these checks. */
const TEMPLATES = [
  'src/web/app/screens/home/home.component.html',
  'src/web/app/screens/flashcard/flashcard.component.html',
  'src/web/app/screens/listen/listen.component.html',
  'src/web/app/screens/my-words/my-words.component.html',
  'src/web/app/screens/settings/settings-panel.component.ts',
  'src/web/app/screens/account/account-panel.component.ts',
  'src/web/app/components/modal.component.ts',
  'src/web/app/components/error-state.component.ts',
  'src/web/app/components/toast.component.ts',
  'src/web/app/components/field-error.component.ts',
];
/** Light colors that need a dark partner, and the partner's prefix. */
const NEEDS_DARK: Record<string, string> = {
  'bg-white': 'dark:bg-',
  'bg-amber-50': 'dark:bg-',
  'bg-slate-50': 'dark:bg-',
  'bg-slate-100': 'dark:bg-',
  'bg-slate-800': 'dark:bg-',
  'bg-slate-900': 'dark:bg-',
  'text-slate-900': 'dark:text-',
  'text-slate-700': 'dark:text-',
  'text-slate-600': 'dark:text-',
  'border-slate-900': 'dark:border-',
  'border-slate-700': 'dark:border-',
  'border-slate-200': 'dark:border-',
  'bg-red-50': 'dark:bg-',
  'text-red-900': 'dark:text-',
  'text-red-800': 'dark:text-',
};
describe('dark theme', () => {
  it('has no theme toggle or theme setting', () => {
    const keys = Object.keys(DEFAULT_USER_SETTINGS).join(' ').toLowerCase();
    expect(keys).not.toMatch(/dark|theme/);
    expect(SETTING_ROWS.map((r) => r.label.toLowerCase()).join(' ')).not.toMatch(/dark|theme/);
  });
  it('follows prefers-color-scheme only, not a class or stored choice', () => {
    const css = read('src/web/styles.css');
    expect(css).not.toContain('@custom-variant dark');
    expect(css).toContain('color-scheme: light dark');
    const html = read('src/web/index.html');
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toMatch(/theme-color[^>]+media="\(prefers-color-scheme: dark\)"/);
    expect(html).toMatch(/@media \(prefers-color-scheme: dark\) \{ \.boot/);
  });
  it('every light color class in a template has a dark partner in the same class list', () => {
    const missing: string[] = [];
    for (const file of TEMPLATES) {
      const src = read(file);
      const lists = [...src.matchAll(/class="([^"]*)"/g), ...src.matchAll(/= [`']([^`']*(?:bg-|text-|border-)[^`']*)[`']/g)].map(
        (m) => m[1].split(/\s+/),
      );
      for (const tokens of lists) {
        for (const t of tokens) {
          const prefix = NEEDS_DARK[t];
          if (prefix && !tokens.some((x) => x.startsWith(prefix))) missing.push(`${file}: ${t}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
  it('word images get the dark-mode outline class', () => {
    for (const file of TEMPLATES.filter((f) => f.endsWith('.html'))) {
      for (const img of read(file).match(/<img\b[^>]*>/g) ?? []) expect(img).toContain('word-image');
    }
    expect(read('src/web/styles.css')).toMatch(/prefers-color-scheme: dark\)[\s\S]*\.word-image[\s\S]*drop-shadow/);
  });
});
