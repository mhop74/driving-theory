// Measures, for every hazard, when its road user first becomes visible from the driver's seat
// in the 3D view, and prints WINDOWS_3D for src/data/windows3d.ts.
// Usage: npm run build && npx vite preview --port 4173 & node scripts/probe-3d-windows.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 800 } })).newPage();
  await p.goto('http://localhost:4173/'); await p.fill('input[type=password]', 'letmein'); await p.click('button.primary');
  // argv[2]: JSON list of { id, hazards, focus } (see the README for how to produce it)
  const list = JSON.parse(process.argv[2]);
  const out = {};
  for (const c of list) {
    await p.evaluate(() => { window.__hpFreeze = 0; });
    await p.goto('http://localhost:4173/#/hazard/clip/' + c.id); await p.click('text=Start clip');
    await p.waitForFunction(() => typeof window.__hpProbe === 'function', null, { timeout: 30000 });
    out[c.id] = [];
    for (let k = 0; k < c.hazards.length; k++) {
      const h = c.hazards[k], actor = c.focus[k];
      let first = null;
      for (let t = h.start - 2; t <= h.end + 2; t += 0.05) {
        const r = await p.evaluate(([t, i]) => window.__hpProbe(t, i), [t, actor]);
        if (r.visible && r.size > 0.015) { first = +t.toFixed(2); break; }
      }
      const start = Math.max(h.start, first ?? h.start);
      const shift = +(start - h.start).toFixed(2);
      out[c.id].push({ start: +start.toFixed(2), end: +(h.end + shift).toFixed(2), label: h.label, firstVisible: first });
      console.error(c.id, k, 'first visible', first, '2D start', h.start, '-> 3D start', start);
    }
  }
  console.log(JSON.stringify(out));
  await b.close();
})();
