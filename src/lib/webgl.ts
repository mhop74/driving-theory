let cached: boolean | null = null;

/** True when the browser can render the 3D hazard clips. */
export function supports3D(): boolean {
  if (cached === null) {
    try {
      const c = document.createElement('canvas');
      cached = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      cached = false;
    }
  }
  return cached;
}
