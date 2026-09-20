/** Lightweight audio logger (filter Metro with `[audio]`). */
export function audioLog(target: string, action: string, data?: Record<string, unknown>) {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) return;
  if (data && Object.keys(data).length > 0) {
    console.log('[audio]', target, action, data);
  } else {
    console.log('[audio]', target, action);
  }
}
