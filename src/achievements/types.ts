import type { AchievementId } from './catalog';
import type { Difficulty } from '../game/types';

export type RunStats = {
  crowdCoverTime: number;
  crowdCoverStreak: number;
  crowdCoverStreakMax: number;
  suspicionLow50Time: number;
  suspicionLow20Time: number;
  noCameraTime: number;
  directionChanges: number;
  obstacleHit: boolean;
  cleanDistanceMeters: number;
  skatesMeters: number;
  camerasClean: number;
  maxBusted: number;
  touchedPolice: boolean;
  escapes: number;
  itemsUsed: number;
  itemsUsedInAlert: number;
  usedEscapeItem: boolean;
  usedSoapInAlert: boolean;
  usedCloakInAlert: boolean;
  usedTeleportInBusted: boolean;
  usedShieldNearCop: boolean;
  usedStaff: boolean;
  usedTime: boolean;
  usedSkates: boolean;
  alertEver: boolean;
  antiCamp: boolean;
  antiCampSurvived: boolean;
  inventoryFull: boolean;
  suspicionHit99: boolean;
  suspicionRecovered: boolean;
  dirsInEscape: string[];
  nearCaptureEscape: boolean;
  escapeNoItems: boolean;
  escapeOneItem: boolean;
  hardEscape: boolean;
  pickedTypes: string[];
  usedTypes: string[];
};

export function emptyRunStats(): RunStats {
  return {
    crowdCoverTime: 0,
    crowdCoverStreak: 0,
    crowdCoverStreakMax: 0,
    suspicionLow50Time: 0,
    suspicionLow20Time: 0,
    noCameraTime: 0,
    directionChanges: 0,
    obstacleHit: false,
    cleanDistanceMeters: 0,
    skatesMeters: 0,
    camerasClean: 0,
    maxBusted: 0,
    touchedPolice: false,
    escapes: 0,
    itemsUsed: 0,
    itemsUsedInAlert: 0,
    usedEscapeItem: false,
    usedSoapInAlert: false,
    usedCloakInAlert: false,
    usedTeleportInBusted: false,
    usedShieldNearCop: false,
    usedStaff: false,
    usedTime: false,
    usedSkates: false,
    alertEver: false,
    antiCamp: false,
    antiCampSurvived: false,
    inventoryFull: false,
    suspicionHit99: false,
    suspicionRecovered: false,
    dirsInEscape: [],
    nearCaptureEscape: false,
    escapeNoItems: false,
    escapeOneItem: false,
    hardEscape: false,
    pickedTypes: [],
    usedTypes: [],
  };
}

export type AchievementMeta = {
  totalPlaySeconds: number;
  totalDistanceMeters: number;
  gamesPlayed: number;
  escapes: number;
  itemsUsed: number;
  playDays: string[];
  collectedItems: string[];
  difficultiesSurvived60s: Difficulty[];
  camerasCleanTotal: number;
};

export type AchievementProgress = {
  values: Partial<Record<AchievementId, number>>;
  unlockedAt: Partial<Record<AchievementId, number>>;
  meta: AchievementMeta;
};

export function emptyProgress(): AchievementProgress {
  return {
    values: {},
    unlockedAt: {},
    meta: {
      totalPlaySeconds: 0,
      totalDistanceMeters: 0,
      gamesPlayed: 0,
      escapes: 0,
      itemsUsed: 0,
      playDays: [],
      collectedItems: [],
      difficultiesSurvived60s: [],
      camerasCleanTotal: 0,
    },
  };
}

export type LiveSnapshot = {
  started: boolean;
  gameOver: boolean;
  paused: boolean;
  reason: string | null;
  difficulty: Difficulty;
  elapsed: number;
  distance: number;
  best: number;
  suspicion: number;
  alert: boolean;
  bustedTimer: number;
  inventoryLength: number;
  runStats: RunStats;
};

export type AchievementEvent =
  | { type: 'hydrate'; progress: AchievementProgress }
  | { type: 'live'; snap: LiveSnapshot }
  | { type: 'run_end'; snap: LiveSnapshot }
  | { type: 'best_beaten' };
