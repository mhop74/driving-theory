import { useEffect, useRef, useState } from 'react';
import { hazardsFor, type Clip } from '../data/clips';

interface Props {
  clip: Clip;
  onDone: (clicks: number[]) => void;
  review?: { clicks: number[] };
  /** Called if the video cannot be played, so the caller can show the 3D or 2D scene instead. */
  onError: () => void;
}

/**
 * Plays a clip's pre-rendered Unreal Engine video. Taps are timed from the video's own clock
 * (currentTime), so a stall while buffering doesn't shift them against the scoring windows.
 */
export default function HazardVideo({ clip, onDone, review, onError }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const clicks = useRef<number[]>([]);
  const [flags, setFlags] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [label, setLabel] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const v = video.current!;
    clicks.current = []; setFlags(0);
    const hz = hazardsFor(clip);
    let raf = 0, done = false;
    const tick = () => {
      const t = Math.min(v.currentTime, clip.duration);
      setElapsed(t);
      if (review) { const act = hz.find((h) => t >= h.start && t <= h.end); setLabel(act ? act.label : null); }
      raf = requestAnimationFrame(tick);
    };
    const finish = () => { if (!done) { done = true; cancelAnimationFrame(raf); setElapsed(clip.duration); onDone(clicks.current); } };
    const playing = () => setWaiting(false);
    const stalled = () => setWaiting(true);
    v.addEventListener('ended', finish);
    v.addEventListener('playing', playing);
    v.addEventListener('waiting', stalled);
    v.addEventListener('error', onError);
    v.currentTime = 0;
    start(v);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      v.pause();
      v.removeEventListener('ended', finish);
      v.removeEventListener('playing', playing);
      v.removeEventListener('waiting', stalled);
      v.removeEventListener('error', onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip]);

  /** AbortError just means the play was interrupted (e.g. React re-running the effect); NotAllowedError
   * means the browser wants a tap first. Anything else means the video can't be played here. */
  function start(v: HTMLVideoElement) {
    setBlocked(false);
    v.play().catch((e: DOMException) => {
      if (e.name === 'AbortError') return;
      if (e.name === 'NotAllowedError') setBlocked(true);
      else onError();
    });
  }

  function press(e: React.PointerEvent) {
    e.preventDefault();
    if (blocked) { start(video.current!); return; }
    if (review || waiting) return;
    clicks.current.push(video.current!.currentTime);
    setFlags(clicks.current.length);
  }

  return (
    <div className="hp-player">
      <div className="hp-video" onPointerDown={press}>
        <video ref={video} src={clip.video!.src} poster={clip.video!.poster} muted playsInline preload="auto"
          disablePictureInPicture controls={false} />
        {label && <div className="hp-label">Scoring window: {label}</div>}
        {blocked ? <div className="hp-loading">Tap to play</div> : waiting && <div className="hp-loading">Loading video…</div>}
      </div>
      <div className="hp-flags" aria-live="polite">
        {Array.from({ length: Math.min(flags, 15) }, (_, i) => <span key={i}>⚑</span>)}
        {review && review.clicks.map((c, i) => <span key={i} style={{ opacity: elapsed >= c ? 1 : 0.15 }}>⚑</span>)}
      </div>
      <div className="hp-time hp-time-wide"><div style={{ width: `${Math.min(100, (elapsed / clip.duration) * 100)}%` }} /></div>
    </div>
  );
}
