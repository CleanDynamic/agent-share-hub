# CA-21 P8: the share of pixels that differ between design/audits/composer/ca-21/before and after (a channel off by more than 8).
from PIL import Image, ImageChops
import os, sys
base = os.path.join(os.path.dirname(__file__), "..", "design", "audits", "composer", "ca-21")
worst = 0.0
for n in ["rest-dusk-1440", "rest-dusk-390", "rest-noon-1440", "rest-noon-390"]:
    a = Image.open(os.path.join(base, "before", n + ".png")).convert("RGB")
    b = Image.open(os.path.join(base, "after", n + ".png")).convert("RGB")
    if a.size != b.size:
        print(n, "size differs", a.size, b.size); worst = 100; continue
    d = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > 8 else 0)
    c = sum(1 for v in d.getdata() if v)
    pct = c / (a.size[0] * a.size[1]) * 100
    worst = max(worst, pct)
    print(n, c, "%.4f%%" % pct)
sys.exit(1 if worst > 0.1 else 0)
