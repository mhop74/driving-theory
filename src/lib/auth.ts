// Simple client-side password gate. This keeps casual visitors out of the app on
// a public GitHub Pages URL. It is NOT strong security: the check runs in the
// browser and the password hash is in the published code.

const KEY = 'theory-trainer:unlock';
const DAYS_REMEMBERED = 30;

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkPassword(pw: string): Promise<boolean> {
  return (await sha256(__PW_SALT__ + pw)) === __PW_HASH__;
}

export function isUnlocked(): boolean {
  try {
    if (sessionStorage.getItem(KEY) === __PW_HASH__) return true;
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    return !!saved && saved.h === __PW_HASH__ && saved.until > Date.now();
  } catch { return false; }
}

export function unlock(remember: boolean) {
  try {
    sessionStorage.setItem(KEY, __PW_HASH__);
    if (remember) localStorage.setItem(KEY, JSON.stringify({ h: __PW_HASH__, until: Date.now() + DAYS_REMEMBERED * 86_400_000 }));
  } catch { /* ignore */ }
}

export function lock() {
  try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch { /* ignore */ }
}
