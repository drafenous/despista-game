export type ControlMode = 'fixed' | 'free';
export type InventoryCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type InventoryDirection = 'horizontal' | 'vertical';

export type GameSettings = {
  controlMode: ControlMode;
  inventoryCorner: InventoryCorner;
  inventoryDirection: InventoryDirection;
};

export const DEFAULT_SETTINGS: GameSettings = {
  controlMode: 'fixed',
  inventoryCorner: 'bottom-right',
  inventoryDirection: 'horizontal',
};

/** fixed = joystick no canto; free = floating joystick (aparece no toque). */
export const CONTROL_MODES: { id: ControlMode; label: string; hint: string }[] = [
  {
    id: 'fixed',
    label: 'Joystick fixo',
    hint: 'Direcional sempre no canto inferior esquerdo.',
  },
  {
    id: 'free',
    label: 'Joystick livre',
    hint: 'Toque em qualquer lugar: o direcional aparece onde você tocou (floating joystick).',
  },
];

export const INVENTORY_CORNERS: { id: InventoryCorner; label: string }[] = [
  { id: 'top-left', label: 'Superior esquerdo' },
  { id: 'top-right', label: 'Superior direito' },
  { id: 'bottom-left', label: 'Inferior esquerdo' },
  { id: 'bottom-right', label: 'Inferior direito' },
];

export const INVENTORY_DIRECTIONS: { id: InventoryDirection; label: string }[] = [
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'vertical', label: 'Vertical' },
];

/** Maps legacy control modes saved on device to the new fixed/free options. */
export function normalizeControlMode(value: unknown): ControlMode {
  if (value === 'fixed' || value === 'free') return value;
  if (value === 'fullscreen') return 'free';
  if (value === 'corner' || value === 'both') return 'fixed';
  return DEFAULT_SETTINGS.controlMode;
}
