import { useState } from 'react';
import { checkPassword, unlock } from '../lib/auth';

export function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (await checkPassword(pw)) { unlock(remember); onUnlock(); }
      else { setError('Incorrect password'); setPw(''); }
    } catch {
      setError('Your browser cannot check the password here. Open the site over https.');
    }
    setBusy(false);
  }

  return (
    <div className="lock">
      <form className="card lock-card" onSubmit={submit}>
        <img src="./icon.svg" alt="" width="64" height="64" />
        <h1>Theory Trainer</h1>
        <p className="muted">Enter the password to continue.</p>
        <input type="password" autoComplete="current-password" autoFocus value={pw}
          onChange={(e) => { setPw(e.target.value); setError(''); }} aria-label="Password" placeholder="Password" />
        <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember this device for 30 days</label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={!pw || busy}>Unlock</button>
      </form>
    </div>
  );
}
