# Extracts sign images from "The Highway Code - Traffic signs" PDF (OGL v3.0).
# Usage: pdftotext -bbox-layout hc.pdf bbox.html
#        python3 scripts/extract-signs.py hc.pdf bbox.html <workdir> public/signs
import re, html, sys, subprocess, os
from PIL import Image
pdf, bbox, workdir, outdir = sys.argv[1:5]
DPI = 600; S = DPI / 72
# --- caption positions
s = open(bbox).read()
lines = {}
for pi, p in enumerate(s.split('<page ')[1:], 1):
    for m in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', p, re.S):
        t = html.unescape(' '.join(re.findall(r'>([^<]*)</word>', m.group(5))))
        lines.setdefault(pi, []).append((t, float(m.group(1)), float(m.group(2)), float(m.group(3))))
def cap(page, text, near_x=None):
    c = [l for l in lines[page] if l[0] == text or l[0].startswith(text)]
    if near_x is not None: c.sort(key=lambda l: abs(l[1] - near_x))
    if not c: raise SystemExit(f'caption not found: {page} {text}')
    t, x0, y0, x1 = c[0]
    return (x0 + x1) / 2, y0
# id, page, caption, near_x, H, half-width, mode
SPEC = [
 ('stop',1,'Stop and',None,50,27,'full'), ('give-way',1,'Give way to',None,50,27,'full'),
 ('no-entry',1,'No entry for',None,50,27,'full'), ('national',1,'National speed',None,45,27,'full'),
 ('speed-40',1,'Maximum',None,45,27,'full'), ('no-cycling',1,'No cycling',None,45,27,'full'),
 ('no-motor',1,'No motor',None,45,27,'full'), ('no-overtaking',1,'No',265,45,27,'full'),
 ('no-right',1,'No right turn',None,45,27,'full'), ('no-left',1,'No left turn',None,45,27,'full'),
 ('no-uturn',1,'No',217,45,27,'full'), ('give-priority',1,'Give priority to',None,78,27,'full'),
 ('no-vehicles',1,'No vehicles',31,75,27,'full'),
 ('no-waiting',2,'No waiting',None,45,27,'full'), ('no-stopping',2,'No stopping',175,45,27,'full'),
 ('ahead-only',2,'Ahead only',None,45,27,'full'), ('turn-left-ahead',2,'Turn left ahead',None,45,27,'full'),
 ('turn-left',2,'Turn left',149,45,27,'full'), ('keep-left',2,'Keep left',None,45,27,'full'),
 ('pass-either',2,'Vehicles',258,45,27,'full'), ('mini-roundabout',2,'Mini-roundabout',None,45,27,'full'),
 ('cycles-only',2,'Route to be',None,45,27,'full'), ('min-30',2,'Minimum speed',None,45,27,'full'),
 ('end-min',2,'End of minimum',None,45,27,'full'), ('one-way',2,'One-way traffic',None,50,27,'full'),
 ('dual-ends',3,'Dual',None,45,27,'full'), ('narrows-right',3,'Road narrows',None,45,27,'full'),
 ('narrows',3,'Road',207,45,27,'full'), ('crossroads',3,'Crossroads',None,45,27,'full'),
 ('t-junction',3,'T-junction with',None,45,27,'full'), ('staggered',3,'Staggered',None,45,27,'full'),
 ('double-bend',3,'Double bend first',None,45,27,'full'), ('bend-right',3,'Bend to right',None,45,27,'full'),
 ('roundabout',3,'Roundabout',None,45,27,'full'), ('uneven',3,'Uneven road',None,45,27,'full'),
 ('two-way-crosses',3,'Two-way',38,45,27,'full'), ('two-way',3,'Two-way traffic',None,45,27,'full'),
 ('falling-rocks',3,'Falling or',None,45,27,'full'), ('signals',3,'Traffic signals',87,45,27,'full'),
 ('slippery',3,'Slippery road',None,45,27,'full'), ('hill-down',3,'Steep hill',203,45,27,'full'),
 ('hill-up',3,'Steep hill',257,45,27,'full'), ('tunnel',3,'Tunnel ahead',None,45,27,'full'),
 ('level-barrier',3,'Level crossing',141,45,27,'full'), ('level-no-barrier',3,'Level crossing',196,45,27,'full'),
 ('level-crossbar',3,'Level crossing',251,45,30,'full'),
 ('children',4,'School crossing',None,78,27,'top'), ('elderly',4,'Frail (or blind',None,45,27,'full'),
 ('pedestrians',4,'Pedestrians',None,78,27,'top'), ('zebra',4,'Zebra',None,45,27,'full'),
 ('cattle',4,'Cattle',None,45,27,'full'), ('wild-animals',4,'Wild animals',None,45,27,'full'),
 ('wild-horses',4,'Wild horses',None,45,27,'full'), ('horses',4,'Accompanied',None,45,27,'full'),
 ('cycle-route',4,'Cycle route',None,45,27,'full'), ('ice',4,'Risk of ice',None,75,27,'full'),
 ('queues',4,'Traffic queues',None,75,27,'full'), ('humps',4,'Distance over',None,75,27,'full'),
 ('danger',4,'Other danger;',None,75,27,'top'), ('side-winds',4,'Side winds',None,45,27,'full'),
 ('hump-bridge',4,'Hump bridge',None,45,27,'full'), ('quayside',4,'Quayside or',None,45,27,'full'),
 ('motorway',5,'Route confirmatory',236,60,36,'full'), ('primary',5,'Route confirmatory',136,62,36,'full'),
 ('local',6,'At the junction',None,36,34,'full'), ('tourist',6,'Tourist attraction',None,32,34,'full'),
 ('end-motorway',7,'End of motorway',None,50,27,'full'), ('start-motorway',7,'Start of motorway',None,40,36,'full'),
 ('parking',7,'Parking place for',None,85,27,'top'),
 ('dead-end',8,'No through road',None,50,27,'full'), ('hospital',8,'Hospital ahead with',None,58,30,'full'),
 ('priority-over',8,'Traffic has priority over',None,78,27,'full'), ('roadworks',8,'Road works',46,45,27,'full'),
]
MANUAL = {'countdown': (7, 35, 455, 82, 513)}
pages = {}
def page_img(n):
    if n not in pages:
        base = os.path.join(workdir, f'hi-{n}')
        if not os.path.exists(base + '.png'):
            subprocess.run(['pdftocairo', '-png', '-r', str(DPI), '-f', str(n), '-l', str(n), '-singlefile', pdf, base], check=True)
        pages[n] = Image.open(base + '.png').convert('RGB')
    return pages[n]
def trim(im):
    g = im.convert('L').point(lambda v: 255 if v < 240 else 0)
    return im.crop(g.getbbox())
def main_band(im):
    """Keep the tallest block of rows separated by blank rows (drops stray caption text)."""
    im = trim(im)
    g = im.convert('L').point(lambda v: 1 if v < 240 else 0)
    w, h = g.size
    data = g.load()
    rows = [any(data[x, y] for x in range(0, w, 2)) for y in range(h)]
    bands, start, gap = [], None, 0
    for y, r in enumerate(rows + [False] * 12):
        if r:
            if start is None: start = y
            gap = 0
        elif start is not None:
            gap += 1
            if gap > 10:
                bands.append((start, y - gap + 1)); start = None; gap = 0
    a, b = max(bands, key=lambda ab: ab[1] - ab[0])
    return trim(im.crop((0, a, w, b)))
def save(id_, im):
    w, h = im.size
    k = 240 / max(w, h)
    im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    # white background -> transparent
    im = im.convert('RGBA')
    px = [(r, g, b, 0 if r > 247 and g > 247 and b > 247 else a) for r, g, b, a in im.get_flattened_data()]
    im.putdata(px)
    im = im.quantize(colors=96, method=Image.Quantize.FASTOCTREE)
    im.save(os.path.join(outdir, f'{id_}.png'), optimize=True)
    print(id_, im.size)
for id_, page, text, nx, H, hw, mode in SPEC:
    cx, top = cap(page, text, nx)
    box = [int((cx - hw) * S), int((top - H) * S), int((cx + hw) * S), int((top - 1.5) * S)]
    im = main_band(page_img(page).crop(box))
    if mode == 'top':
        w, h = im.size
        # Cut where the sign ends and the narrow posts below it begin.
        g = im.convert('L').point(lambda v: 1 if v < 240 else 0).load()
        best, cut = 0, h
        for y in range(h):
            xs = [x for x in range(0, w, 2) if g[x, y]]
            ext = (xs[-1] - xs[0]) if xs else 0
            if ext > best: best = ext
            elif best > w * 0.3 and ext < best * 0.5:
                cut = y; break
        im = trim(im.crop((0, 0, w, cut)))
    save(id_, im)
for id_, (page, x0, y0, x1, y1) in MANUAL.items():
    save(id_, main_band(page_img(page).crop([int(x0 * S), int(y0 * S), int(x1 * S), int(y1 * S)])))
