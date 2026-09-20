import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SETTINGS,
  normalizeControlMode,
  type GameSettings,
  type InventoryCorner,
  type InventoryDirection,
} from '../game/settings';

const KEY = 'despista:settings:v1';

const CORNERS = new Set<InventoryCorner>(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
const DIRECTIONS = new Set<InventoryDirection>(['horizontal', 'vertical']);

function sanitize(raw: unknown): GameSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const value = raw as Partial<GameSettings>;
  return {
    controlMode: normalizeControlMode(value.controlMode),
    inventoryCorner: CORNERS.has(value.inventoryCorner as InventoryCorner)
      ? value.inventoryCorner as InventoryCorner
      : DEFAULT_SETTINGS.inventoryCorner,
    inventoryDirection: DIRECTIONS.has(value.inventoryDirection as InventoryDirection)
      ? value.inventoryDirection as InventoryDirection
      : DEFAULT_SETTINGS.inventoryDirection,
  };
}

export async function loadSettings(): Promise<GameSettings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let pending: Promise<void> = Promise.resolve();
export function saveSettings(settings: GameSettings): Promise<void> {
  const next = sanitize(settings);
  const write = pending.catch(() => {}).then(() => AsyncStorage.setItem(KEY, JSON.stringify(next)));
  pending = write;
  return write;
}
