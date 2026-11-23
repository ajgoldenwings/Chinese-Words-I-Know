import sys, os, glob
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
big = []
for f in sorted(glob.glob(src + '/*/*.png')):
    rel = os.path.relpath(f, src)
    out = os.path.join(dst, rel); os.makedirs(os.path.dirname(out), exist_ok=True)
    im = Image.open(f).convert('RGBA')
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(out, optimize=True)
    sz = os.path.getsize(out)
    assert Image.open(out).size == (800, 800)
    if sz > 150*1024: big.append((rel, sz))
print('over 150KB:', big)
tot = sum(os.path.getsize(f) for f in glob.glob(dst + '/*/*.png'))
print('total KB', tot//1024, 'max KB', max(os.path.getsize(f) for f in glob.glob(dst+'/*/*.png'))//1024)
