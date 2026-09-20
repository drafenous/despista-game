import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { createGame } from './src/game/engine';
import { uiPowerSvg } from './src/game/icons';
import {
  CONTROL_MODES,
  DEFAULT_SETTINGS,
  INVENTORY_CORNERS,
  INVENTORY_DIRECTIONS,
  type GameSettings,
} from './src/game/settings';
import { DIFFICULTIES, type Difficulty, type Power, type Snapshot } from './src/game/types';
import { fitWorldToViewport, WORLD_HEIGHT, WORLD_WIDTH } from './src/game/viewport';
import { FloatingJoystick } from './src/components/FloatingJoystick';
import { GameCanvas } from './src/components/GameCanvas';
import { Joystick } from './src/components/Joystick';
import { PowerUpButton } from './src/components/PowerUpButton';
import { useChaseAlertSound } from './src/audio/chaseAlert';
import { playSfx } from './src/audio/sfx';
import {
  AchievementToast,
  AchievementsPanel,
} from './src/achievements/AchievementsPanel';
import {
  createAchievementTracker,
  loadAchievementProgress,
  saveAchievementProgress,
} from './src/achievements';
import { toLiveSnapshot } from './src/achievements/live';
import { loadBest, saveBest } from './src/storage/records';
import { loadSettings, saveSettings } from './src/storage/settings';
import { uiLog } from './src/debug/uiLog';

function Button({ children, onPress, secondary = false, disabled = false }: {
  children: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled}
    onPress={() => {
      uiLog('menu.button', disabled ? 'press-disabled' : 'press', { label: children });
      if (!disabled) onPress();
    }}
    style={({ pressed }) => [s.button, secondary && s.secondary, (pressed || disabled) && { opacity: .6 }]}>
    <Text style={[s.buttonText, secondary && { color: '#dfebfa' }]}>{children}</Text>
  </Pressable>;
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return <View style={s.meter}>
    <Text style={[s.small, { color }]}>{label}</Text>
    <View style={s.track}><View style={{ height: 4, width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }} /></View>
  </View>;
}

function ChoiceRow<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return <View style={s.choices}>
    {options.map(option => <Pressable key={option.id} accessibilityRole="button"
      accessibilityState={{ selected: value === option.id }}
      onPress={() => {
        uiLog('menu.choice', 'press', { id: option.id, label: option.label, previous: value });
        onChange(option.id);
      }}
      style={[s.choice, value === option.id && s.selected]}>
      <Text style={[s.choiceText, value === option.id && { color: '#101820' }]}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

function Despista() {
  const mounted = useRef(true);
  const insets = useSafeAreaInsets();
  const inputSources = useRef({ pad: { x: 0, y: 0 } });
  const slotLayouts = useRef<({ x: number; y: number; w: number; h: number } | null)[]>([null, null, null]);
  const slotNodes = useRef<(View | null)[]>([null, null, null]);
  const trackerRef = useRef(createAchievementTracker());
  const endedRunRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistAchievementsRef = useRef<(progress: ReturnType<typeof trackerRef.current.getProgress>) => void>(() => {});
  const showUnlocksRef = useRef<(names: string[]) => void>(() => {});
  const [storageError, setStorageError] = useState('');
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [showOptions, setShowOptions] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [achievementTick, setAchievementTick] = useState(0);
  const [toastName, setToastName] = useState('');
  const [game] = useState(() => createGame({
    onBest: (best: number) => {
      saveBest(best).catch(() => {
        if (mounted.current) setStorageError('Não foi possível salvar o recorde neste aparelho.');
      });
      const result = trackerRef.current.dispatch({ type: 'best_beaten' });
      persistAchievementsRef.current(result.progress);
      showUnlocksRef.current(result.newlyUnlocked.map(item => item.name));
    },
    onPowerPickup: () => playSfx('powerPickup'),
    onPowerUse: () => playSfx('powerUse'),
  }));
  const [snapshot, setSnapshot] = useState(() => game.snapshot());
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [viewport, setViewport] = useState({ width: WORLD_WIDTH, height: WORLD_HEIGHT });
  const fit = useMemo(() => fitWorldToViewport(viewport.width, viewport.height), [viewport]);
  const { scale, offsetX, offsetY } = fit;
  const pad = {
    top: Math.max(12, insets.top + 8),
    bottom: Math.max(14, insets.bottom + 10),
    left: Math.max(12, insets.left + 8),
    right: Math.max(12, insets.right + 8),
  };
  const refresh = useCallback(() => setSnapshot(game.snapshot()), [game]);

  const persistAchievements = useCallback((progress: ReturnType<typeof trackerRef.current.getProgress>) => {
    saveAchievementProgress(progress).catch(() => {
      if (mounted.current) setStorageError('Não foi possível salvar as conquistas neste aparelho.');
    });
    if (mounted.current) setAchievementTick(value => value + 1);
  }, []);

  const showUnlocks = useCallback((names: string[]) => {
    if (!names.length || !mounted.current) return;
    setToastName(names[0]);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      if (mounted.current) setToastName('');
    }, 2800);
  }, []);

  persistAchievementsRef.current = persistAchievements;
  showUnlocksRef.current = showUnlocks;

  const handleSnapshot = useCallback((snap: Snapshot) => {
    setSnapshot(snap);
    const live = toLiveSnapshot(snap);
    if (snap.started && !snap.gameOver) {
      endedRunRef.current = false;
      const result = trackerRef.current.dispatch({ type: 'live', snap: live });
      if (result.newlyUnlocked.length) {
        persistAchievements(result.progress);
        showUnlocks(result.newlyUnlocked.map(item => item.name));
      }
      return;
    }
    if (snap.gameOver && !endedRunRef.current) {
      endedRunRef.current = true;
      const result = trackerRef.current.dispatch({ type: 'run_end', snap: live });
      persistAchievements(result.progress);
      showUnlocks(result.newlyUnlocked.map(item => item.name));
    }
  }, [persistAchievements, showUnlocks]);

  const onPadMove = useCallback((x: number, y: number) => {
    inputSources.current.pad = { x, y };
    game.setInput(x, y);
  }, [game]);
  const clearInputs = useCallback(() => {
    inputSources.current = { pad: { x: 0, y: 0 } };
    game.setInput(0, 0);
  }, [game]);

  const measureSlot = useCallback((index: number) => {
    const node = slotNodes.current[index];
    node?.measureInWindow((x, y, w, h) => {
      slotLayouts.current[index] = { x, y, w, h };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<GameSettings>) => {
    uiLog('settings', 'update', patch as Record<string, unknown>);
    setSettings(previous => {
      const next = { ...previous, ...patch };
      saveSettings(next).catch(() => {
        if (mounted.current) setStorageError('Não foi possível salvar as opções neste aparelho.');
      });
      return next;
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    Promise.all([loadBest(), loadSettings(), loadAchievementProgress()]).then(([best, loaded, achievements]) => {
      if (!mounted.current) return;
      game.setBest(best);
      setSettings(loaded);
      trackerRef.current.dispatch({ type: 'hydrate', progress: achievements });
      setAchievementTick(value => value + 1);
      refresh();
    }).catch(() => {
      if (mounted.current) setStorageError('Recorde, opções ou conquistas indisponíveis. Você pode jogar normalmente.');
    }).finally(() => {
      if (mounted.current) setReady(true);
    });
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active' && game.allowsPause()) { game.setPaused(true); refresh(); }
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showAchievements) { setShowAchievements(false); return true; }
      if (showOptions) { setShowOptions(false); return true; }
      if (!game.snapshot().started) return false;
      if (!game.allowsPause()) return false;
      game.setPaused(true); refresh(); return true;
    });
    return () => {
      mounted.current = false;
      appState.remove();
      back.remove();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [game, refresh, showOptions, showAchievements]);

  const start = () => {
    uiLog('menu', 'start', { difficulty });
    clearInputs();
    endedRunRef.current = false;
    game.start(difficulty);
    refresh();
  };
  const paused = snapshot.paused;
  const menu = !snapshot.started || snapshot.gameOver;
  void achievementTick;
  const active = snapshot.started && !paused;
  useChaseAlertSound({
    active,
    alert: snapshot.alert,
    bustedTimer: snapshot.bustedTimer,
  });
  const showFixedPad = settings.controlMode === 'fixed';
  const showFreePad = settings.controlMode === 'free';
  const inventoryTop = settings.inventoryCorner.startsWith('top');
  const inventoryLeft = settings.inventoryCorner.endsWith('left');
  const inventoryVertical = settings.inventoryDirection === 'vertical';
  const joystickSize = Math.min(164, WORLD_WIDTH * scale * .4);
  const title = snapshot.gameOver
    ? snapshot.reason === 'caught' ? 'PRESO!' : 'FICOU PARA TRÁS!'
    : 'DESPISTA!';
  const controlHint = CONTROL_MODES.find(mode => mode.id === settings.controlMode)?.hint
    ?? 'Arraste o direcional em quatro direções.';

  const lastPowerUpAt = useRef(0);

  /** Android delivers 2nd+ fingers to the view that got the first ACTION_DOWN
   * (joystick). Hit-test ALL fingers against inventory — changedTouches alone
   * often still reports the joystick finger, so the slot never matches. */
  const tryActivateSlotAtTouch = useCallback((event: GestureResponderEvent) => {
    if (!active) return;
    const now = Date.now();
    if (now - lastPowerUpAt.current < 280) return;

    const points = event.nativeEvent.touches.length > 0
      ? event.nativeEvent.touches
      : event.nativeEvent.changedTouches;
    const liveInventory = game.snapshot().inventory;
    const padHit = 10;

    for (const point of points) {
      const { pageX, pageY } = point;
      for (let index = 0; index < 3; index++) {
        const box = slotLayouts.current[index];
        if (!box) continue;
        if (
          pageX < box.x - padHit || pageX > box.x + box.w + padHit ||
          pageY < box.y - padHit || pageY > box.y + box.h + padHit
        ) continue;

        const type = liveInventory[index];
        if (!type) {
          uiLog('powerup.panel', 'hit-empty-slot', {
            index,
            x: Math.round(pageX),
            y: Math.round(pageY),
          });
          return;
        }

        lastPowerUpAt.current = now;
        uiLog('powerup.panel', 'activate-via-multitouch', {
          index,
          type,
          x: Math.round(pageX),
          y: Math.round(pageY),
          fingers: points.length,
        });
        game.usePowerUp(index);
        refresh();
        return;
      }
    }

    if (points.length >= 2) {
      uiLog('powerup.panel', 'multitouch-miss', {
        fingers: points.length,
        points: Array.from(points).map(t => ({ x: Math.round(t.pageX), y: Math.round(t.pageY) })),
        slots: slotLayouts.current.map((b, i) => b && {
          i, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h),
        }),
      });
    }
  }, [active, game, refresh]);

  return <View style={s.root}>
    <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
    <View style={s.board} onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      setViewport(previous => previous.width === width && previous.height === height
        ? previous : { width, height });
    }}
      onTouchStart={tryActivateSlotAtTouch}
    >
      <GameCanvas game={game} scale={scale} offsetX={offsetX} offsetY={offsetY}
        viewportWidth={viewport.width} viewportHeight={viewport.height} onSnapshot={handleSnapshot} />

      {!!toastName && <AchievementToast name={toastName} />}

      {active && showFreePad && (
        <FloatingJoystick onMove={onPadMove} onAuxTouch={tryActivateSlotAtTouch} size={joystickSize} />
      )}

      <View pointerEvents="box-none" style={[s.hud, { top: pad.top, left: pad.left, right: pad.right }]}>
        {snapshot.started && snapshot.allowsPause && (
          <View pointerEvents="box-none" style={s.pauseWrap}>
            <Pressable accessibilityRole="button" accessibilityLabel="Pausar jogo"
              onPress={() => {
                uiLog('hud', 'pause');
                game.setPaused(true); refresh();
              }} style={s.pause}>
              <Text style={s.pauseText}>Ⅱ</Text>
            </Pressable>
          </View>
        )}
        <View style={s.hudRow}>
          <View style={s.panel}>
            <Text style={s.small}>TEMPO</Text><Text style={s.time}>{snapshot.time}</Text>
            <Text style={s.small}>RECORDE {snapshot.bestTime}</Text>
          </View>
          <View style={[s.panel, { alignItems: 'flex-end' }]}>
            <Text style={s.small}>JOGADOR · {snapshot.distanceLabel}</Text>
            <Text style={[s.small, { marginTop: 4 }]}>TELA · {snapshot.screenDistanceLabel}</Text>
          </View>
        </View>
        {active && snapshot.suspicion > 0 && !snapshot.alert &&
          <Meter label="SUSPEITA" value={snapshot.suspicion} color="#f5cf60" />}
        {active && snapshot.bustedTimer > 0 &&
          <Meter label={`BUSTED · ${snapshot.bustedTimer.toFixed(1)} / 1,5s`}
            value={snapshot.bustedTimer / 1.5 * 100} color="#ff6675" />}
        {active && snapshot.alert &&
          <Meter label={snapshot.difficulty === 'impossible' ? 'PERSEGUIÇÃO PERMANENTE'
            : snapshot.pursuitGraceTimer > 0 ? 'QUEBRANDO VISÃO…'
              : `FUGA · ${snapshot.pursuitEscapeTimer.toFixed(1)} / ${snapshot.escapeTarget}s`}
            value={snapshot.difficulty === 'impossible' ? 100 : snapshot.pursuitEscapeTimer / snapshot.escapeTarget * 100}
            color="#ffcf65" />}
        <View style={s.effects}>
          {active && snapshot.effects.map(effect => <Text key={String(effect.label)}
            style={[s.effect, { color: String(effect.color) }]}>
            {effect.label} {Number(effect.remaining).toFixed(1)}s
          </Text>)}
        </View>
      </View>

      {active && <View pointerEvents="box-none" style={[
        s.inventory,
        inventoryVertical ? s.inventoryVertical : s.inventoryHorizontal,
        inventoryTop
          ? { top: pad.top + 148 }
          : { bottom: pad.bottom + (inventoryLeft && showFixedPad ? joystickSize + 10 : 0) },
        inventoryLeft ? { left: pad.left } : { right: pad.right },
      ]}
        onLayout={() => { for (let i = 0; i < 3; i++) measureSlot(i); }}
      >
        {[0, 1, 2].map(index => {
          const type = snapshot.inventory[index] as Power | undefined;
          const power = type ? game.powers[type] : undefined;
          return <View
            key={index}
            ref={node => { slotNodes.current[index] = node; }}
            onLayout={() => measureSlot(index)}
            collapsable={false}
          >
            <PowerUpButton disabled={!power}
              label={power ? `Usar ${power.name}` : `Slot ${index + 1} vazio`}
              onActivate={() => {
                uiLog('powerup.panel', 'activate', { index, type: type ?? null });
                game.usePowerUp(index); refresh();
              }}
              style={[s.slot, inventoryVertical && s.slotVertical, { borderColor: power?.color ?? '#ffffff22' }]}>
              {type && power ? <SvgXml xml={uiPowerSvg(type, power.color)} width={36} height={36} />
                : <Text style={s.empty}>＋</Text>}
              <Text numberOfLines={1} style={s.slotName}>{power?.short ?? 'vazio'}</Text>
            </PowerUpButton>
          </View>;
        })}
      </View>}

      {active && showFixedPad && <View pointerEvents="box-none"
        style={[s.joystickWrap, { left: pad.left, bottom: pad.bottom }]}>
        <Joystick onMove={onPadMove} onAuxTouch={tryActivateSlotAtTouch} size={joystickSize} />
      </View>}

      {(menu || paused || showOptions) && <View style={[s.overlay, {
        paddingTop: pad.top,
        paddingBottom: pad.bottom,
        paddingLeft: pad.left,
        paddingRight: pad.right,
      }]}>
        <ScrollView style={s.menuScroll} contentContainerStyle={s.card} bounces={false}>
          {showAchievements ? (
            <AchievementsPanel
              tracker={trackerRef.current}
              onBack={() => {
                uiLog('menu', 'achievements-close');
                setShowAchievements(false);
              }}
            />
          ) : showOptions ? <>
            <Text style={s.eyebrow}>PERSONALIZE O CONTROLE</Text>
            <Text accessibilityRole="header" style={s.title}>OPÇÕES</Text>
            <Text style={s.description}>As preferências ficam salvas neste aparelho.</Text>

            <Text style={s.label}>CONTROLE</Text>
            <ChoiceRow options={CONTROL_MODES} value={settings.controlMode}
              onChange={controlMode => updateSettings({ controlMode })} />
            <Text style={s.modeDescription}>
              {CONTROL_MODES.find(mode => mode.id === settings.controlMode)?.hint}
            </Text>

            <Text style={s.label}>BARRA DE POWER-UPS</Text>
            <ChoiceRow options={INVENTORY_CORNERS} value={settings.inventoryCorner}
              onChange={inventoryCorner => updateSettings({ inventoryCorner })} />

            <Text style={[s.label, { marginTop: 14 }]}>DIREÇÃO DOS ÍCONES</Text>
            <ChoiceRow options={INVENTORY_DIRECTIONS} value={settings.inventoryDirection}
              onChange={inventoryDirection => updateSettings({ inventoryDirection })} />

            <View style={{ marginTop: 18 }}>
              <Button onPress={() => { uiLog('menu', 'options-close'); setShowOptions(false); }}>VOLTAR</Button>
            </View>
            {!!storageError && <Text style={s.error}>{storageError}</Text>}
          </> : <>
            <Text style={s.eyebrow}>SOBREVIVA À CIDADE</Text>
            <Text accessibilityRole="header" style={s.title}>{paused ? 'PAUSA' : title}</Text>
            <Text style={s.description}>{paused ? 'Respire. A cidade espera por você.'
              : snapshot.gameOver ? snapshot.reason === 'caught'
                ? 'Você permaneceu na área de captura por 1,5 segundo. Saia antes que a barra complete.'
                : 'A cidade seguiu em frente. Continue subindo para não ficar para trás.'
                : 'Misture-se à multidão, evite a vigilância e despiste os policiais.'}</Text>
            {(snapshot.gameOver || paused) && <View style={s.stats}>
              <Text style={s.stat}>{snapshot.time}<Text style={s.statCaption}>{'\n'}TEMPO</Text></Text>
              <Text style={s.stat}>{snapshot.distanceLabel}<Text style={s.statCaption}>{'\n'}PERCORRIDO</Text></Text>
            </View>}
            {paused ? <>
              <Button onPress={() => {
                uiLog('menu', 'resume');
                clearInputs(); game.setPaused(false); refresh();
              }}>CONTINUAR</Button>
              <Button secondary onPress={start}>RECOMEÇAR</Button>
              <Button secondary onPress={() => { uiLog('menu', 'achievements-open'); setShowAchievements(true); }}>CONQUISTAS</Button>
              <Button secondary onPress={() => { uiLog('menu', 'options-open'); setShowOptions(true); }}>OPÇÕES</Button>
            </> : <>
              <Text style={s.label}>DIFICULDADE</Text>
              <View style={s.difficulties}>
                {DIFFICULTIES.map(mode => <Pressable key={mode.id} accessibilityRole="button"
                  accessibilityState={{ selected: difficulty === mode.id }}
                  onPress={() => {
                    uiLog('menu.difficulty', 'press', { id: mode.id, label: mode.label });
                    setDifficulty(mode.id);
                  }}
                  style={[s.difficulty, difficulty === mode.id && s.selected]}>
                  <Text style={[s.difficultyText, difficulty === mode.id && { color: '#101820' }]}>{mode.label}</Text>
                </Pressable>)}
              </View>
              <Text style={s.modeDescription}>{game.describeDifficulty(difficulty)}</Text>
              <Button disabled={!ready} onPress={start}>{!ready ? 'CARREGANDO…' : snapshot.gameOver ? 'JOGAR DE NOVO' : 'COMEÇAR'}</Button>
              <Button secondary onPress={() => { uiLog('menu', 'achievements-open'); setShowAchievements(true); }}>CONQUISTAS</Button>
              <Button secondary onPress={() => { uiLog('menu', 'options-open'); setShowOptions(true); }}>OPÇÕES</Button>
              <Text style={s.record}>RECORDE · {snapshot.bestTime}</Text>
            </>}
            <Text style={s.help}>{controlHint} Toque nos itens para usar. A multidão esconde você, mas também bloqueia a passagem.</Text>
            {!!storageError && <Text style={s.error}>{storageError}</Text>}
          </>}
        </ScrollView>
      </View>}
    </View>
  </View>;
}

export default function App() {
  return <SafeAreaProvider><Despista /></SafeAreaProvider>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080d16' },
  board: { flex: 1, width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#080d16' },
  hud: { position: 'absolute', zIndex: 4 },
  hudRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  panel: { backgroundColor: '#0b1020df', borderColor: '#ffffff20', borderWidth: 1, borderRadius: 9, padding: 10 },
  small: { color: '#a8b9ce', fontSize: 10, fontWeight: '700', letterSpacing: .5 },
  time: { color: '#fff', fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'], marginVertical: 3 },
  pauseWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 5 },
  pause: { width: 56, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#243550' },
  pauseText: { color: '#d6edff', fontSize: 23, fontWeight: '900' },
  meter: { marginTop: 7, padding: 8, backgroundColor: '#0b1020e6', borderRadius: 6 },
  track: { height: 4, backgroundColor: '#ffffff18', marginTop: 5, overflow: 'hidden', borderRadius: 2 },
  effects: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  effect: { fontSize: 10, fontWeight: '700', padding: 5, backgroundColor: '#0b1020dd', borderRadius: 5 },
  joystickWrap: { position: 'absolute', zIndex: 3 },
  inventory: { position: 'absolute', zIndex: 3, gap: 6 },
  inventoryHorizontal: { flexDirection: 'row', maxWidth: 204 },
  inventoryVertical: { flexDirection: 'column', width: 78 },
  slot: { width: 64, height: 78, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 11, backgroundColor: '#0b1020ed' },
  slotVertical: { width: 78 },
  slotName: { color: '#e5edfa', fontSize: 11, marginTop: 5 },
  empty: { color: '#6b7d91', fontSize: 32 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#070b12b8',
    justifyContent: 'center',
    zIndex: 10,
  },
  menuScroll: { flexGrow: 0, maxHeight: '96%', borderRadius: 18, backgroundColor: '#111a29', borderWidth: 1, borderColor: '#ffffff25' },
  card: { padding: 22, alignItems: 'stretch' },
  eyebrow: { color: '#8ca3bd', fontSize: 9, fontWeight: '800', letterSpacing: 2.4, textAlign: 'center', marginBottom: 10 },
  title: { color: '#f7d154', fontSize: 35, lineHeight: 40, fontWeight: '900', textAlign: 'center' },
  description: { color: '#bdccde', fontSize: 13, lineHeight: 20, textAlign: 'center', marginVertical: 16 },
  label: { color: '#879db6', fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 9 },
  difficulties: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  difficulty: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#202d41', borderRadius: 7 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#202d41', borderRadius: 7 },
  selected: { backgroundColor: '#f7d154' },
  difficultyText: { color: '#c9d8ec', fontWeight: '800', fontSize: 12 },
  choiceText: { color: '#c9d8ec', fontWeight: '800', fontSize: 12 },
  modeDescription: { minHeight: 44, color: '#96adc5', fontSize: 11, lineHeight: 16, marginVertical: 12 },
  button: { backgroundColor: '#77df89', borderRadius: 9, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  secondary: { backgroundColor: '#283950' },
  buttonText: { color: '#102719', fontSize: 14, fontWeight: '900', letterSpacing: .8 },
  record: { color: '#f7d154', fontSize: 11, textAlign: 'center', marginTop: 3, fontWeight: '700' },
  help: { color: '#8095ad', fontSize: 10, lineHeight: 16, marginTop: 16, textAlign: 'center' },
  error: { color: '#ffc07a', fontSize: 11, marginTop: 12, textAlign: 'center' },
  stats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#0b1220', padding: 15, marginBottom: 18, borderRadius: 8 },
  stat: { color: '#fff', fontWeight: '800', fontSize: 19, textAlign: 'center' },
  statCaption: { color: '#8299b4', fontSize: 9 },
});
