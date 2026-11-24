import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const root = process.cwd();
const logo = (name: string) => join(root, 'assets/images/logo', name);
/** Reads width, height and color type from a PNG header. Color type 2 is RGB with no alpha. */
function png(name: string) {
  const b = readFileSync(logo(name));
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] };
}
describe('logo files', () => {
  const sizes: Record<string, number> = {
    'logo.png': 512,
    'favicon-16.png': 16,
    'favicon-32.png': 32,
    'favicon-48.png': 48,
    'apple-touch-icon.png': 180,
    'icon-192.png': 192,
    'icon-512.png': 512,
    'icon-maskable-512.png': 512,
    'boot.png': 240,
    'splash.png': 2732,
  };
  for (const [name, size] of Object.entries(sizes)) {
    it(`${name} is ${size}×${size}`, () => {
      const { width, height } = png(name);
      expect([width, height]).toEqual([size, size]);
    });
  }
  it('keeps the supplied source and a multi-size favicon.ico', () => {
    expect(existsSync(logo('logo-source.png'))).toBe(true);
    const ico = readFileSync(logo('favicon.ico'));
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    expect(ico.readUInt16LE(4)).toBe(3); // 16, 32 and 48
  });
  it('the Apple touch icon has no transparency', () => {
    expect(png('apple-touch-icon.png').colorType).toBe(2);
  });
});
describe('logo wiring', () => {
  const html = readFileSync(join(root, 'src/web/index.html'), 'utf8');
  const manifest = JSON.parse(readFileSync(join(root, 'src/web/public/manifest.webmanifest'), 'utf8'));
  const ngsw = readFileSync(join(root, 'ngsw-config.json'), 'utf8');
  it('index.html links only logo files that exist, with relative paths', () => {
    const hrefs = [...html.matchAll(/(?:href|src)="(assets\/images\/logo\/[^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(5);
    for (const h of hrefs) expect(existsSync(join(root, h))).toBe(true);
    expect(html).not.toMatch(/(?:href|src)="\/assets/);
    expect(html).toContain('rel="manifest" href="manifest.webmanifest"');
  });
  it('shows the boot image inside app-root', () => {
    expect(html).toMatch(/<app-root>[\s\S]*assets\/images\/logo\/boot\.png[\s\S]*<\/app-root>/);
  });
  it('the manifest uses relative icon paths that exist, including a maskable one', () => {
    expect(manifest.start_url).toBe('./');
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(false);
      expect(existsSync(join(root, icon.src))).toBe(true);
    }
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  });
  it('the service worker precaches the logo files and the manifest', () => {
    expect(ngsw).toContain('/assets/images/logo/**');
    expect(ngsw).toContain('/manifest.webmanifest');
  });
  it('the default favicon.ico is gone from the public folder', () => {
    expect(existsSync(join(root, 'src/web/public/favicon.ico'))).toBe(false);
  });
});
