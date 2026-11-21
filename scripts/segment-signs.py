import re, html, sys, os, json, subprocess
from PIL import Image, ImageDraw, ImageFilter
pdf, bbox, workdir = sys.argv[1:4]
DPI = 100; S = DPI / 72
s = open(bbox).read()
pages = {}
for pi, p in enumerate(s.split('<page ')[1:], 1):
    L = []
    for m in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', p, re.S):
        t = html.unescape(' '.join(re.findall(r'>([^<]*)</word>', m.group(5))))
        L.append([float(m.group(i)) for i in range(1, 5)] + [t])
    pages[pi] = L
def blocks(lines):
    """Group caption lines into blocks (consecutive lines, overlapping x, close y)."""
    out = []
    for l in sorted(lines, key=lambda l: (l[1], l[0])):
        for b in out:
            last = b['lines'][-1]
            if 0 < l[1] - last[1] < 9 and min(l[2], b['x1']) - max(l[0], b['x0']) > -2:
                b['lines'].append(l); b['x0'] = min(b['x0'], l[0]); b['x1'] = max(b['x1'], l[2]); b['y1'] = l[3]; break
        else:
            out.append({'lines': [l], 'x0': l[0], 'x1': l[2], 'y0': l[1], 'y1': l[3]})
    for b in out: b['text'] = ' '.join(x[4] for x in b['lines'])
    return out
result = []
for pn in range(1, 9):
    base = os.path.join(workdir, f'seg-{pn}')
    if not os.path.exists(base + '.png'):
        subprocess.run(['pdftocairo', '-png', '-r', str(DPI), '-f', str(pn), '-l', str(pn), '-singlefile', pdf, base], check=True)
    im = Image.open(base + '.png').convert('L')
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1, t in pages[pn]:
        d.rectangle([x0 * S - 1, y0 * S - 1, x1 * S + 1, y1 * S + 1], fill=255)
    mask = im.point(lambda v: 255 if v < 235 else 0).filter(ImageFilter.MaxFilter(5))
    W, H = mask.size; px = mask.load()
    seen = bytearray(W * H); comps = []
    for y in range(H):
        for x in range(W):
            if px[x, y] and not seen[y * W + x]:
                st = [(x, y)]; seen[y * W + x] = 1; x0 = x1 = x; y0 = y1 = y; n = 0
                while st:
                    cx, cy = st.pop(); n += 1
                    x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
                    for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)):
                        if 0 <= nx < W and 0 <= ny < H and px[nx, ny] and not seen[ny * W + nx]:
                            seen[ny * W + nx] = 1; st.append((nx, ny))
                if (x1 - x0) / S > 12 and (y1 - y0) / S > 8:
                    comps.append([x0 / S, y0 / S, x1 / S, y1 / S])
    bl = [b for b in blocks(pages[pn]) if not re.match(r'^(Traffic signs|Signs giving orders|Warning signs|Direction signs|Information signs|Road works signs|Mostly|All rectangular|Signs (on|with)|Green background|Other direction|Plates below|The priority through|Note:)', b['text'])]
    for c in comps:
        cx = (c[0] + c[2]) / 2
        best, bd = None, 1e9
        for b in bl:
            # prefer captions just below the sign and horizontally overlapping
            dy = b['y0'] - c[3]
            ox = min(c[2], b['x1']) - max(c[0], b['x0'])
            if -4 <= dy <= 30 and ox > -6: dist = dy + abs(cx - (b['x0'] + b['x1']) / 2) * 0.3
            else: dist = 200 + abs((c[1] + c[3]) / 2 - (b['y0'] + b['y1']) / 2) + abs(cx - (b['x0'] + b['x1']) / 2)
            if dist < bd: bd, best = dist, b
        result.append({'page': pn, 'box': [round(v, 1) for v in c], 'caption': best['text'] if best else '', 'conf': round(bd, 1)})
json.dump(result, open(os.path.join(workdir, 'components.json'), 'w'), indent=1)
for r in result: print(r['page'], r['box'], r['conf'], r['caption'][:70])
print(len(result))
