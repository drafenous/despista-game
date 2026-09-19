import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'despista:best:v1';
export async function loadBest(): Promise<number> {
  const value = Number(await AsyncStorage.getItem(KEY));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
// Serialize writes so slower older writes cannot overwrite a newer record.
let pending: Promise<void> = Promise.resolve();
export function saveBest(best: number): Promise<void> {
  const write = pending.catch(() => {}).then(() => AsyncStorage.setItem(KEY, String(best)));
  pending = write;
  return write;
}
