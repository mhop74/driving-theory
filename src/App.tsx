import { useState } from 'react';
import { useRoute, go } from './lib/router';
import { isUnlocked } from './lib/auth';
import { Lock } from './screens/Lock';
import { Home } from './screens/Home';
import { LearnHome, Lesson, Signs } from './screens/Learn';
import { TestHome, QuizRoute } from './screens/Test';
import { HazardHome, HazardClip, HazardMock } from './screens/Hazard';
import { Progress, Settings } from './screens/Progress';
import type { TopicId } from './data/types';

const TABS = [
  { path: '', label: 'Home', icon: '⌂' },
  { path: 'learn', label: 'Learn', icon: '📖' },
  { path: 'test', label: 'Test', icon: '✎' },
  { path: 'hazard', label: 'Hazards', icon: '⚠' },
  { path: 'progress', label: 'Progress', icon: '📈' },
];

export function App() {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const route = useRoute();
  if (!unlocked) return <Lock onUnlock={() => setUnlocked(true)} />;

  const [a, b, c] = route;
  const immersive = a === 'practice' || a === 'mock' || (a === 'test' && b) || (a === 'hazard' && !!b);

  let page: React.ReactNode;
  switch (a) {
    case undefined: page = <Home />; break;
    case 'learn': page = b ? <Lesson topic={b as TopicId} /> : <LearnHome />; break;
    case 'signs': page = <Signs />; break;
    case 'practice': page = <QuizRoute key={route.join('/')} kind={b ?? 'quick'} arg={c} mode="practice" />; break;
    case 'mock': page = <QuizRoute key="mock" kind="mock" mode="mock" />; break;
    case 'test': page = b ? <QuizRoute key={route.join('/')} kind={b} arg={c} mode="test" /> : <TestHome />; break;
    case 'hazard':
      page = b === 'mock' ? <HazardMock /> : b === 'clip' && c ? <HazardClip key={c} id={c} /> : <HazardHome />; break;
    case 'progress': page = <Progress />; break;
    case 'settings': page = <Settings onLock={() => setUnlocked(false)} />; break;
    default: page = <Home />;
  }

  const active = a === 'signs' ? 'learn' : a === 'settings' ? 'progress' : a === 'mock' ? 'test' : (a ?? '');

  return (
    <div className={`app ${immersive ? 'immersive' : ''}`}>
      {!immersive && (
        <header className="topbar">
          <span className="brand"><img src="./icon.svg" alt="" width="24" height="24" /> Theory Trainer</span>
          <button className="btn ghost small" aria-label="Settings" onClick={() => go('settings')}>⚙</button>
        </header>
      )}
      <main>{page}</main>
      {!immersive && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <a key={t.label} href={`#/${t.path}`} className={active === t.path ? 'on' : ''}>
              <span aria-hidden>{t.icon}</span>{t.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
