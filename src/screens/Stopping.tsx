import { useState } from 'react';
import { go } from '../lib/router';

// Typical stopping distances from The Highway Code, Rule 126 (dry road, good brakes and tyres, alert driver).
const ROWS = [
  { mph: 20, think: 6, brake: 6, feet: 40, cars: 3 },
  { mph: 30, think: 9, brake: 14, feet: 75, cars: 6 },
  { mph: 40, think: 12, brake: 24, feet: 118, cars: 9 },
  { mph: 50, think: 15, brake: 38, feet: 175, cars: 13 },
  { mph: 60, think: 18, brake: 55, feet: 240, cars: 18 },
  { mph: 70, think: 21, brake: 75, feet: 315, cars: 24 },
];
const MAX = 96;

function Chart() {
  const [hover, setHover] = useState<{ row: number; part: 'think' | 'brake' } | null>(null);
  return (
    <div className="sd-chart" role="img" aria-label="Typical stopping distances by speed, split into thinking and braking distance. Full figures are in the table below.">
      <div className="sd-legend" aria-hidden>
        <span><i className="sd-think" /> Thinking distance</span>
        <span><i className="sd-brake" /> Braking distance</span>
      </div>
      {ROWS.map((r, i) => {
        const total = r.think + r.brake;
        return (
          <div key={r.mph} className="sd-row">
            <span className="sd-speed">{r.mph} mph</span>
            <div className="sd-track">
              <div className="sd-bar" style={{ width: `${(total / MAX) * 100}%` }}>
                <div className="sd-seg sd-think" style={{ flexGrow: r.think }}
                  onPointerEnter={() => setHover({ row: i, part: 'think' })} onPointerLeave={() => setHover(null)} />
                <div className="sd-seg sd-brake" style={{ flexGrow: r.brake }}
                  onPointerEnter={() => setHover({ row: i, part: 'brake' })} onPointerLeave={() => setHover(null)} />
              </div>
              <span className="sd-total">{total} m</span>
              {hover?.row === i && (
                <div className="sd-tip">
                  {hover.part === 'think' ? `Thinking: ${r.think} m` : `Braking: ${r.brake} m`} · total {total} m
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Stopping() {
  return (
    <div className="stack">
      <button className="btn ghost small back" onClick={() => go('learn')}>‹ Learn</button>
      <div className="card">
        <p className="eyebrow">Safety margins</p>
        <h2>Thinking and stopping distances</h2>
        <p className="small"><strong>Stopping distance = thinking distance + braking distance.</strong></p>
        <ul className="small sd-defs">
          <li><strong>Thinking distance:</strong> how far you travel between seeing a hazard and starting to brake.</li>
          <li><strong>Braking distance:</strong> how far you travel from starting to brake until you stop.</li>
        </ul>
        <p className="muted small">Typical figures for a car on a dry road with good brakes and tyres and an alert driver (Highway Code Rule 126).</p>
      </div>

      <div className="card">
        <h3>Typical stopping distances</h3>
        <Chart />
      </div>

      <div className="card">
        <h3>The numbers to learn</h3>
        <div className="table-wrap">
          <table className="sd-table">
            <thead>
              <tr><th>Speed</th><th>Thinking</th><th>Braking</th><th>Stopping</th><th>Car lengths</th></tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.mph}>
                  <td><strong>{r.mph} mph</strong></td>
                  <td>{r.think} m</td>
                  <td>{r.brake} m</td>
                  <td><strong>{r.think + r.brake} m</strong><div className="muted small">{r.feet} ft</div></td>
                  <td>{r.cars}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">The Highway Code bases car lengths on an average car of about 4 metres.</p>
      </div>

      <div className="card lesson">
        <h3>Memory tips</h3>
        <ul>
          <li><strong>Thinking distance</strong> goes up by 3 m for every 10 mph: 6, 9, 12, 15, 18, 21.</li>
          <li><strong>Stopping distance in feet:</strong> multiply the speed by 2, 2.5, 3, 3.5, 4, 4.5 in turn: 20 × 2 = 40 ft, 30 × 2.5 = 75 ft … 70 × 4.5 = 315 ft. 40 × 3 gives 120, which the Highway Code rounds to 118.</li>
          <li><strong>Double the speed, more than double the distance.</strong> Braking distance roughly quadruples when speed doubles: 6 m at 20 mph, 24 m at 40 mph.</li>
        </ul>
      </div>

      <div className="card lesson">
        <h3>Weather and road conditions</h3>
        <ul>
          <li>On <strong>wet</strong> roads, stopping distances are <strong>at least double</strong> (Rule 227).</li>
          <li>On <strong>icy</strong> roads, braking distances can be <strong>up to ten times</strong> greater (Rule 230).</li>
          <li>Leave at least a <strong>2-second gap</strong> behind the vehicle in front in good conditions, and at least <strong>4 seconds</strong> in the wet (Rules 126, 227).</li>
        </ul>
      </div>

      <div className="card lesson">
        <h3>What makes the distances longer</h3>
        <ul>
          <li><strong>Thinking distance:</strong> tiredness, alcohol, drugs (including some medicines), distractions such as phones, and higher speed.</li>
          <li><strong>Braking distance:</strong> higher speed, wet or icy roads, loose or uneven surfaces, worn tyres or brakes, wrong tyre pressures, a heavy load, and going downhill.</li>
        </ul>
      </div>

      <button className="btn primary full" onClick={() => go('practice/topic/safety-margins')}>Practise Safety margins questions</button>
    </div>
  );
}
