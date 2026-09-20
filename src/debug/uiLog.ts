/** Lightweight UI interaction logger (filter Metro with `[ui]`). */
export function uiLog(target: string, action: string, data?: Record<string, unknown>) {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) return;
  if (data && Object.keys(data).length > 0) {
    console.log('[ui]', target, action, data);
  } else {
    console.log('[ui]', target, action);
  }
}
