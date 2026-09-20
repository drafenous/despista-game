import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACHIEVEMENTS, type AchievementId } from './catalog';
import { emptyProgress, type AchievementMeta, type AchievementProgress } from './types';
import type { Difficulty } from '../game/types';

const KEY = 'despista:achievements:v1';

const DIFFICULTIES = new Set<Difficulty>(['easy', 'medium', 'hard', 'pro', 'impossible']);
const IDS = new Set(ACHIEVEMENTS.map(item => item.id));

function sanitize(raw: unknown): AchievementProgress {
  const base = emptyProgress();
  if (!raw || typeof raw !== 'object') return base;
  const value = raw as Partial<AchievementProgress>;
  const values: AchievementProgress['values'] = {};
  const unlockedAt: AchievementProgress['unlockedAt'] = {};

  if (value.values && typeof value.values === 'object') {
    for (const [key, amount] of Object.entries(value.values)) {
      if (!IDS.has(key as AchievementId)) continue;
      const number = Number(amount);
      if (Number.isFinite(number) && number >= 0) values[key as AchievementId] = number;
    }
  }
  if (value.unlockedAt && typeof value.unlockedAt === 'object') {
    for (const [key, stamp] of Object.entries(value.unlockedAt)) {
      if (!IDS.has(key as AchievementId)) continue;
      const number = Number(stamp);
      if (Number.isFinite(number) && number > 0) unlockedAt[key as AchievementId] = number;
    }
  }

  const metaIn = (value.meta && typeof value.meta === 'object'
    ? value.meta
    : {}) as Partial<AchievementMeta>;
  const playDays = Array.isArray(metaIn.playDays)
    ? metaIn.playDays.filter((day): day is string => typeof day === 'string').slice(0, 366)
    : [];
  const collectedItems = Array.isArray(metaIn.collectedItems)
    ? [...new Set(metaIn.collectedItems.filter((item): item is string => typeof item === 'string'))]
    : [];
  const difficultiesSurvived60s = Array.isArray(metaIn.difficultiesSurvived60s)
    ? [...new Set(metaIn.difficultiesSurvived60s.filter((item): item is Difficulty =>
      DIFFICULTIES.has(item as Difficulty)))]
    : [];

  return {
    values,
    unlockedAt,
    meta: {
      totalPlaySeconds: Math.max(0, Number(metaIn.totalPlaySeconds) || 0),
      totalDistanceMeters: Math.max(0, Number(metaIn.totalDistanceMeters) || 0),
      gamesPlayed: Math.max(0, Math.floor(Number(metaIn.gamesPlayed) || 0)),
      escapes: Math.max(0, Math.floor(Number(metaIn.escapes) || 0)),
      itemsUsed: Math.max(0, Math.floor(Number(metaIn.itemsUsed) || 0)),
      playDays,
      collectedItems,
      difficultiesSurvived60s,
      camerasCleanTotal: Math.max(0, Math.floor(Number(metaIn.camerasCleanTotal) || 0)),
    },
  };
}

export async function loadAchievementProgress(): Promise<AchievementProgress> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return emptyProgress();
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyProgress();
  }
}

let pending: Promise<void> = Promise.resolve();
export function saveAchievementProgress(progress: AchievementProgress): Promise<void> {
  const next = sanitize(progress);
  const write = pending.catch(() => {}).then(() => AsyncStorage.setItem(KEY, JSON.stringify(next)));
  pending = write;
  return write;
}
