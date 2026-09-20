import { emptyRunStats, type LiveSnapshot, type RunStats } from './types';
import type { Difficulty, Snapshot } from '../game/types';

export function toLiveSnapshot(snap: Snapshot): LiveSnapshot {
  const stats = (snap as Snapshot & { runStats?: RunStats }).runStats ?? emptyRunStats();
  return {
    started: snap.started,
    gameOver: snap.gameOver,
    paused: snap.paused,
    reason: snap.reason == null ? null : String(snap.reason),
    difficulty: snap.difficulty as Difficulty,
    elapsed: snap.elapsed,
    distance: snap.distance,
    best: snap.best,
    suspicion: snap.suspicion,
    alert: snap.alert,
    bustedTimer: snap.bustedTimer,
    inventoryLength: snap.inventory.length,
    runStats: {
      ...stats,
      dirsInEscape: [...(stats.dirsInEscape ?? [])],
      pickedTypes: [...(stats.pickedTypes ?? [])],
      usedTypes: [...(stats.usedTypes ?? [])],
    },
  };
}
