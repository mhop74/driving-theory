import { useSyncExternalStore } from 'react';
import { load, subscribe } from './store';

export function useStore() {
  return useSyncExternalStore(subscribe, load);
}
