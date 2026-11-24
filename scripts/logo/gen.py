"""Builds every logo size from assets/images/logo/logo-source.png.
Usage: python3 scripts/logo/gen.py   (needs Pillow). Re-run when the source image changes.
"""
import os
from PIL import Image

DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'images', 'logo')
src = Image.open(os.path.join(DIR, 'logo-source.png')).convert('RGBA')

# Theme color: average of the opaque pixels in the top quarter (the hat).
top = src.crop((0, 0, src.width, src.height // 4))
px = [p for p in top.get_flattened_data() if p[3] > 250]
THEME = tuple(sum(c[i] for c in px) // len(px) for i in range(3))
print('theme color', '#%02x%02x%02x' % THEME)

def canvas(size, fill, scale):
    """Centers the face on a square canvas. `scale` is the face height as a share of the canvas."""
    h = round(size * scale)
    w = round(src.width * h / src.height)
    face = src.resize((w, h), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), fill)
    out.alpha_composite(face, ((size - w) // 2, (size - h) // 2))
    return out

CLEAR, WHITE = (0, 0, 0, 0), (255, 255, 255, 255)
save = lambda img, name: img.save(os.path.join(DIR, name), optimize=True)

save(canvas(512, CLEAR, 0.92), 'logo.png')
save(canvas(192, CLEAR, 0.92), 'icon-192.png')
save(canvas(512, CLEAR, 0.92), 'icon-512.png')
# Maskable icons are cropped to a shape, so the face stays inside the central safe zone.
save(canvas(512, THEME + (255,), 0.60), 'icon-maskable-512.png')
# iOS fills transparency with black, so the touch icon is opaque.
save(canvas(180, WHITE, 0.86).convert('RGB'), 'apple-touch-icon.png')
for n in (16, 32, 48):
    save(canvas(n, CLEAR, 1.0), f'favicon-{n}.png')
canvas(48, CLEAR, 1.0).save(os.path.join(DIR, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
# Source for the native launch screens (Capacitor) and the in-page boot image.
save(canvas(2732, WHITE, 0.28), 'splash.png')
save(canvas(240, CLEAR, 0.92), 'boot.png')
