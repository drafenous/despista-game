/** Fixed simulation space. All ranking metrics use these units only. */
export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 640;

export type ViewportFit = {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

/** Uniform contain-fit: never stretches, never crops the playfield. */
export function fitWorldToViewport(width: number, height: number): ViewportFit {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const scale = Math.min(w / WORLD_WIDTH, h / WORLD_HEIGHT);
  return {
    scale,
    offsetX: (w - WORLD_WIDTH * scale) / 2,
    offsetY: (h - WORLD_HEIGHT * scale) / 2,
    width: w,
    height: h,
  };
}
