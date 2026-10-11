import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'despista:run:v1';

export type SavedRun = Record<string, unknown> & { version: 1 };

export async function loadRun(): Promise<SavedRun | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.version === 1 ? parsed as SavedRun : null;
  } catch {
    return null;
  }
}

let pending: Promise<void> = Promise.resolve();

export function saveRun(state: unknown): Promise<void> {
  const write = pending.catch(() => {}).then(async () => {
    if (!state) {
      await AsyncStorage.removeItem(KEY);
      return;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  });
  pending = write;
  return write;
}

export function clearRun(): Promise<void> {
  return saveRun(null);
}
