const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');

function loadTrackerModule() {
  const files = [
    'src/achievements/catalog.ts',
    'src/achievements/types.ts',
    'src/achievements/tracker.ts',
  ];
  let source = '';
  for (const file of files) {
    const raw = fs.readFileSync(path.join(root, file), 'utf8');
    source += raw
      .replace(/^import[\s\S]*?;\r?\n/gm, '')
      .replace(/^export /gm, '')
      .replace(/ as Record<AchievementId, AchievementDef>/g, '')
      + '\n';
  }
  source += `
    globalThis.__ach = {
      ACHIEVEMENTS,
      emptyProgress,
      emptyRunStats,
      createAchievementTracker,
    };
  `;
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  Function('module', 'exports', 'require', outputText)(module, module.exports, require);
  return globalThis.__ach;
}

function live(overrides = {}) {
  const { emptyRunStats } = loadTrackerModule();
  return {
    started: true,
    gameOver: false,
    paused: false,
    reason: null,
    difficulty: 'medium',
    elapsed: 0,
    distance: 0,
    best: 0,
    suspicion: 0,
    alert: false,
    bustedTimer: 0,
    inventoryLength: 0,
    runStats: emptyRunStats(),
    ...overrides,
    runStats: { ...emptyRunStats(), ...(overrides.runStats || {}) },
  };
}

test('achievement tracker unlocks binary and incremental progress', () => {
  const { createAchievementTracker } = loadTrackerModule();
  const tracker = createAchievementTracker();

  let result = tracker.dispatch({
    type: 'live',
    snap: live({ elapsed: 60, distance: 10 }),
  });
  assert.ok(result.newlyUnlocked.some(item => item.id === 'survive_60s'));
  assert.ok(result.newlyUnlocked.some(item => item.id === 'first_run'));

  result = tracker.dispatch({
    type: 'live',
    snap: live({
      elapsed: 70,
      distance: 20,
      runStats: { escapes: 1, escapeNoItems: true },
    }),
  });
  assert.ok(result.progress.unlockedAt.first_escape);
  assert.ok(result.progress.unlockedAt.escape_no_items);
  assert.equal(result.progress.meta.escapes, 1);

  result = tracker.dispatch({
    type: 'run_end',
    snap: live({
      started: false,
      gameOver: true,
      reason: 'caught',
      elapsed: 70,
      distance: 20,
      runStats: { escapes: 1, escapeNoItems: true },
    }),
  });
  assert.ok(result.progress.unlockedAt.first_caught);
  assert.equal(result.progress.meta.gamesPlayed, 1);
  assert.equal(tracker.list().length, 50);
});

test('catalog exposes unique store ids for both platforms', () => {
  const { ACHIEVEMENTS } = loadTrackerModule();
  const ids = new Set(ACHIEVEMENTS.map(item => item.id));
  const stores = new Set(ACHIEVEMENTS.map(item => item.storeId));
  assert.equal(ids.size, 50);
  assert.equal(stores.size, 50);
});
