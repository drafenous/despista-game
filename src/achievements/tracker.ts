import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, type AchievementDef, type AchievementId } from './catalog';
import {
  emptyProgress,
  type AchievementEvent,
  type AchievementProgress,
  type LiveSnapshot,
} from './types';

export type TrackerResult = {
  progress: AchievementProgress;
  newlyUnlocked: AchievementDef[];
};

type Session = {
  started: boolean;
  ended: boolean;
  bestAtStart: number;
  milestones: Set<string>;
  lastElapsed: number;
  lastDistance: number;
  lastCamerasClean: number;
  lastEscapes: number;
  lastItemsUsed: number;
};

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function unlock(
  progress: AchievementProgress,
  id: AchievementId,
  newly: AchievementDef[],
  amount = 1,
): void {
  const def = ACHIEVEMENT_BY_ID[id];
  if (!def) return;
  const current = progress.values[id] ?? 0;
  const next = Math.min(def.target, Math.max(current, amount));
  progress.values[id] = next;
  if (next >= def.target && !progress.unlockedAt[id]) {
    progress.unlockedAt[id] = Date.now();
    newly.push(def);
  }
}

function bump(
  progress: AchievementProgress,
  id: AchievementId,
  newly: AchievementDef[],
  amount: number,
): void {
  const def = ACHIEVEMENT_BY_ID[id];
  if (!def || amount <= 0) return;
  const current = progress.values[id] ?? 0;
  if (current >= def.target && progress.unlockedAt[id]) {
    progress.values[id] = def.target;
    return;
  }
  const next = Math.min(def.target, current + amount);
  progress.values[id] = next;
  if (next >= def.target && !progress.unlockedAt[id]) {
    progress.unlockedAt[id] = Date.now();
    newly.push(def);
  }
}

function syncMetaCounters(progress: AchievementProgress, newly: AchievementDef[]): void {
  unlock(progress, 'run_2km_total', newly, progress.meta.totalDistanceMeters);
  unlock(progress, 'play_30min_total', newly, progress.meta.totalPlaySeconds);
  unlock(progress, 'escape_5', newly, progress.meta.escapes);
  unlock(progress, 'use_20_items', newly, progress.meta.itemsUsed);
  unlock(progress, 'play_10_games', newly, progress.meta.gamesPlayed);
  unlock(progress, 'play_3_days', newly, progress.meta.playDays.length);
  unlock(progress, 'collect_all_8_items', newly, progress.meta.collectedItems.length);
  unlock(progress, 'survive_3_difficulties', newly, progress.meta.difficultiesSurvived60s.length);
  unlock(progress, 'cameras_10_clean', newly, progress.meta.camerasCleanTotal);
  const unlockedCount = Object.keys(progress.unlockedAt).filter(id => id !== 'unlock_25').length;
  unlock(progress, 'unlock_25', newly, unlockedCount);
}

function applyLiveFlags(
  progress: AchievementProgress,
  snap: LiveSnapshot,
  newly: AchievementDef[],
  session: Session,
): void {
  const stats = snap.runStats;
  const mark = (key: string, condition: boolean, id: AchievementId, amount = 1) => {
    if (!condition || session.milestones.has(key)) return;
    session.milestones.add(key);
    unlock(progress, id, newly, amount);
  };

  mark('first_run', snap.started || snap.gameOver, 'first_run');
  mark('survive_60s', snap.elapsed >= 60, 'survive_60s');
  mark('run_500m', snap.distance >= 500, 'run_500m');
  mark('easy_2min', snap.difficulty === 'easy' && snap.elapsed >= 120, 'easy_2min');
  mark('medium_2min', snap.difficulty === 'medium' && snap.elapsed >= 120, 'medium_2min');
  mark('hard_90s', snap.difficulty === 'hard' && snap.elapsed >= 90, 'hard_90s');
  mark('pro_60s', snap.difficulty === 'pro' && snap.elapsed >= 60, 'pro_60s');
  mark('impossible_30s', snap.difficulty === 'impossible' && snap.elapsed >= 30, 'impossible_30s');
  mark('impossible_3min', snap.difficulty === 'impossible' && snap.elapsed >= 180, 'impossible_3min');
  mark('crowd_cover_10s', stats.crowdCoverTime >= 10, 'crowd_cover_10s');
  mark('crowd_cover_30s', stats.crowdCoverStreakMax >= 30, 'crowd_cover_30s');
  mark('low_suspicion_30s', stats.suspicionLow50Time >= 30, 'low_suspicion_30s');
  mark('suspicion_under_20_60s', stats.suspicionLow20Time >= 60, 'suspicion_under_20_60s');
  mark('no_camera_90s', stats.noCameraTime >= 90, 'no_camera_90s');
  mark('direction_50', stats.directionChanges >= 50, 'direction_50');
  mark('no_obstacle_100m', !stats.obstacleHit && stats.cleanDistanceMeters >= 100, 'no_obstacle_100m');
  mark('no_cop_touch_2min', !stats.touchedPolice && snap.elapsed >= 120, 'no_cop_touch_2min');
  mark('inventory_full', stats.inventoryFull || snap.inventoryLength >= 3, 'inventory_full');
  mark('suspicion_99_recover', stats.suspicionRecovered, 'suspicion_99_recover');
  mark('first_alert', stats.alertEver || snap.alert, 'first_alert');
  mark('survive_anti_camp', stats.antiCampSurvived, 'survive_anti_camp');
  mark('use_skates_50m', stats.skatesMeters >= 50, 'use_skates_50m');
  mark('use_escape', stats.usedEscapeItem, 'use_escape');
  mark('use_moses', stats.usedStaff, 'use_moses');
  mark('use_timemachine', stats.usedTime, 'use_timemachine');
  mark('use_cloak_alert', stats.usedCloakInAlert, 'use_cloak_alert');
  mark('use_teleport_capture', stats.usedTeleportInBusted, 'use_teleport_capture');
  mark('use_shield', stats.usedShieldNearCop, 'use_shield');
  mark(
    'survive_90s_no_items',
    snap.elapsed >= 90 && stats.itemsUsed === 0,
    'survive_90s_no_items',
  );
  mark(
    'impossible_no_escape_item',
    snap.difficulty === 'impossible' && snap.elapsed >= 20 && !stats.usedEscapeItem,
    'impossible_no_escape_item',
  );
  mark(
    'near_record',
    session.bestAtStart > 0
      && snap.elapsed >= session.bestAtStart - 10
      && snap.elapsed < session.bestAtStart,
    'near_record',
  );

  if (stats.escapes > session.lastEscapes) {
    const gained = stats.escapes - session.lastEscapes;
    session.lastEscapes = stats.escapes;
    progress.meta.escapes += gained;
    unlock(progress, 'first_escape', newly);
    if (stats.escapeNoItems) unlock(progress, 'escape_no_items', newly);
    if (stats.escapeOneItem) unlock(progress, 'escape_one_item', newly);
    if (stats.nearCaptureEscape) unlock(progress, 'near_capture_escape', newly);
    if (stats.hardEscape) unlock(progress, 'hard_escape_4s', newly);
    if (stats.usedSoapInAlert) unlock(progress, 'use_soap', newly);
    if (stats.dirsInEscape.length >= 4) unlock(progress, 'four_directions_escape', newly);
  }

  if (stats.itemsUsed > session.lastItemsUsed) {
    const gained = stats.itemsUsed - session.lastItemsUsed;
    session.lastItemsUsed = stats.itemsUsed;
    progress.meta.itemsUsed += gained;
  }

  if (stats.camerasClean > session.lastCamerasClean) {
    const gained = stats.camerasClean - session.lastCamerasClean;
    session.lastCamerasClean = stats.camerasClean;
    progress.meta.camerasCleanTotal += gained;
  }

  for (const item of stats.pickedTypes) {
    if (!progress.meta.collectedItems.includes(item)) {
      progress.meta.collectedItems.push(item);
    }
  }

  if (snap.elapsed >= 60 && !progress.meta.difficultiesSurvived60s.includes(snap.difficulty)) {
    progress.meta.difficultiesSurvived60s.push(snap.difficulty);
  }

  const day = todayKey();
  if (!progress.meta.playDays.includes(day)) {
    progress.meta.playDays.push(day);
  }

  const deltaTime = Math.max(0, snap.elapsed - session.lastElapsed);
  const deltaDistance = Math.max(0, snap.distance - session.lastDistance);
  if (deltaTime > 0 && deltaTime < 2) progress.meta.totalPlaySeconds += deltaTime;
  if (deltaDistance > 0 && deltaDistance < 50) progress.meta.totalDistanceMeters += deltaDistance;
  session.lastElapsed = snap.elapsed;
  session.lastDistance = snap.distance;
}

function finishRun(
  progress: AchievementProgress,
  snap: LiveSnapshot,
  newly: AchievementDef[],
  session: Session,
): void {
  if (session.ended) return;
  session.ended = true;
  applyLiveFlags(progress, snap, newly, session);
  progress.meta.gamesPlayed += 1;
  if (snap.reason === 'caught') unlock(progress, 'first_caught', newly);
  syncMetaCounters(progress, newly);
}

export function createAchievementTracker(initial = emptyProgress()) {
  let progress: AchievementProgress = structuredClone(initial);
  let session: Session = {
    started: false,
    ended: false,
    bestAtStart: 0,
    milestones: new Set(),
    lastElapsed: 0,
    lastDistance: 0,
    lastCamerasClean: 0,
    lastEscapes: 0,
    lastItemsUsed: 0,
  };

  function resetSession(best: number) {
    session = {
      started: true,
      ended: false,
      bestAtStart: best,
      milestones: new Set(),
      lastElapsed: 0,
      lastDistance: 0,
      lastCamerasClean: 0,
      lastEscapes: 0,
      lastItemsUsed: 0,
    };
  }

  function dispatch(event: AchievementEvent): TrackerResult {
    const newlyUnlocked: AchievementDef[] = [];

    if (event.type === 'hydrate') {
      progress = structuredClone(event.progress);
      syncMetaCounters(progress, newlyUnlocked);
      return { progress, newlyUnlocked };
    }

    if (event.type === 'best_beaten') {
      unlock(progress, 'beat_best_time', newlyUnlocked);
      syncMetaCounters(progress, newlyUnlocked);
      return { progress, newlyUnlocked };
    }

    const snap = event.snap;
    if (snap.started && !session.started) {
      resetSession(snap.best);
    }
    if (!session.started && (snap.started || snap.gameOver)) {
      resetSession(snap.best);
    }

    if (event.type === 'live') {
      if (snap.started && !snap.paused) applyLiveFlags(progress, snap, newlyUnlocked, session);
      syncMetaCounters(progress, newlyUnlocked);
      return { progress, newlyUnlocked };
    }

    if (event.type === 'run_end') {
      if (!session.started) resetSession(snap.best);
      finishRun(progress, snap, newlyUnlocked, session);
      session.started = false;
      return { progress, newlyUnlocked };
    }

    return { progress, newlyUnlocked };
  }

  return {
    getProgress: () => progress,
    dispatch,
    list() {
      return ACHIEVEMENTS.map(def => {
        const value = progress.values[def.id] ?? 0;
        const unlocked = !!progress.unlockedAt[def.id];
        return {
          ...def,
          value: Math.min(def.target, value),
          unlocked,
          unlockedAt: progress.unlockedAt[def.id] ?? null,
          visible: !def.hidden || unlocked,
        };
      });
    },
  };
}

export type AchievementTracker = ReturnType<typeof createAchievementTracker>;
