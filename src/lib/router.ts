import { useEffect, useState } from 'react';

export function useRoute(): string[] {
  const get = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [parts, setParts] = useState(get);
  useEffect(() => {
    const on = () => { setParts(get()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}

export const go = (path: string) => { location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`; };
