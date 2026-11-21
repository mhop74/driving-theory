# Crops every sign found by segment.py that the curated SPEC list (extract-signs.py) does not already cover,
# and writes a TypeScript manifest of the extra signs.
import json, re, sys, os, subprocess, importlib.util
from PIL import Image
pdf, bbox, workdir, outdir, ts_out, extract_py = sys.argv[1:7]
# Load caption lookup + SPEC from the curated script without running its main loop.
src = open(extract_py).read().split('MANUAL =')[0]
ns = {'__name__': 'spec'}
sys.argv = ['x', pdf, bbox, workdir, outdir]
exec(compile(src, extract_py, 'exec'), ns)
ns['caption_boxes'] = {p: [(l[1], l[2], l[3], l[2] + 7.5) for l in ls] for p, ls in ns['lines'].items()}
known = []
for id_, page, text, nx, H, hw, mode in ns['SPEC']:
    cx, top = ns['cap'](page, text, nx)
    known.append((id_, page, cx, top - min(H, 45) / 2))
known.append(('countdown', 7, 55, 490))
comps = json.load(open(os.path.join(workdir, 'components.json')))
MERGE = ('Manually operated', '‘Countdown’', 'Symbols showing emergency', 'Signs used on the back')
merged = {}
out = []
for c in comps:
    key = next((m for m in MERGE if c['caption'].startswith(m)), None)
    if key:
        k = (c['page'], key)
        if k in merged:
            b = merged[k]['box']; nb = c['box']
            merged[k]['box'] = [min(b[0], nb[0]), min(b[1], nb[1]), max(b[2], nb[2]), max(b[3], nb[3])]
            continue
        merged[k] = c
    out.append(c)
DPI = 600; S = DPI / 72
imgs = {}
def trim(im):
    g = im.convert('L').point(lambda v: 255 if v < 240 else 0)
    return im.crop(g.getbbox())
def page(n):
    if n not in imgs:
        base = os.path.join(workdir, f'hi-{n}')
        if not os.path.exists(base + '.png'):
            subprocess.run(['pdftocairo', '-png', '-r', str(DPI), '-f', str(n), '-l', str(n), '-singlefile', pdf, base], check=True)
        im = Image.open(base + '.png').convert('RGB')
        from PIL import ImageDraw
        d = ImageDraw.Draw(im)
        for x0, y0, x1, y1 in ns['caption_boxes'].get(n, []):  # remove caption text that sits inside a sign's area
            d.rectangle([x0 * S - 4, y0 * S - 4, x1 * S + 4, y1 * S + 4], fill='white')
        imgs[n] = im
    return imgs[n]
def slug(t):
    t = re.sub(r'\(.*?\)', '', t.lower()).replace('’', '').replace('‘', '')
    w = re.findall(r'[a-z0-9]+', t)
    return '-'.join(w[:6])
def group(pg, y):
    if pg <= 2: return 'Orders'
    if pg <= 4: return 'Warnings'
    if pg <= 6: return 'Direction'
    if pg == 8 and y > 249: return 'Road works'
    return 'Information'
def meaning(pg, y, cap):
    cap = re.sub(r'\s+', ' ', cap).strip()
    if pg == 5 and y < 300 and not cap.startswith(('Downward', 'The panel')): return 'Motorway sign: ' + cap[0].lower() + cap[1:]
    if (pg == 5 and y > 300) or (pg == 6 and y < 150 and not cap.startswith('Primary route')): return 'Primary route sign: ' + cap[0].lower() + cap[1:]
    if pg == 6 and 150 < y < 300 and not cap.startswith('Direction'): return 'Local route sign: ' + cap[0].lower() + cap[1:]
    return cap
OVERRIDES = {
    'plate-below-some-signs': 'Plate below some signs: REDUCE SPEED NOW',
    'worded-warning-sign': 'Worded warning sign (ford)',
    'downward-pointing-arrows-mean-get-in': 'Motorway gantry: downward pointing arrows mean ‘Get in lane’. The left-hand lane leads to a different destination from the other lanes.',
    'the-panel-with-the-inclined-arrow': 'Motorway gantry: the panel with the inclined arrow shows destinations reached by leaving at the next junction',
    'manually-operated-temporary-stop-and-go': 'Manually operated temporary STOP and GO signs (road works)',
    'school-crossing-patrol': 'School crossing patrol – you must stop',
    'signs-used-on-the-back-of': 'Signs on the back of slow-moving or stationary works vehicles warning of a lane closed ahead',
    'symbols-showing-emergency-diversion-route-for': 'Symbols showing an emergency diversion route for motorway and other main road traffic',
}
cards, used = [], set(k[0] for k in known)
for c in out:
    x0, y0, x1, y1 = c['box']
    if any(p == c['page'] and x0 - 1 <= cx <= x1 + 1 and y0 - 1 <= cy <= y1 + 1 for _, p, cx, cy in known):
        continue
    base = slug(c['caption']) or f"sign-p{c['page']}"
    id_ = base; n = 2
    while id_ in used: id_ = f'{base}-{n}'; n += 1
    used.add(id_)
    im = trim(page(c['page']).crop([int((x0 - 1) * S), int((y0 - 1) * S), int((x1 + 1) * S), int((y1 + 1) * S)]))
    w, h = im.size
    target = max(240, min(560, round(max(x1 - x0, y1 - y0) * 5.5)))
    k = target / max(w, h)
    im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS).convert('RGBA')
    im.putdata([(r, g, b, 0 if r > 247 and g > 247 and b > 247 else a) for r, g, b, a in im.get_flattened_data()])
    im.quantize(colors=128, method=Image.Quantize.FASTOCTREE).save(os.path.join(outdir, f'{id_}.png'), optimize=True)
    cards.append({'id': id_, 'meaning': OVERRIDES.get(id_) or meaning(c['page'], y0, c['caption']), 'group': group(c['page'], y0)})
with open(ts_out, 'w') as f:
    f.write('// Generated by scripts/extract-signs-rest.py from "The Highway Code – Traffic signs" (OGL v3.0).\n')
    f.write("import type { SignCard } from '../components/Sign';\n\nexport const EXTRA_SIGNS: SignCard[] = [\n")
    for c in cards: f.write(f"  {json.dumps(c, ensure_ascii=False)},\n")
    f.write('];\n')
print(len(cards), 'extra signs')
