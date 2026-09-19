import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { createGame } from './src/game/engine';
import { uiPowerSvg } from './src/game/icons';
import { DIFFICULTIES, type Difficulty, type Power } from './src/game/types';
import { GameCanvas } from './src/components/GameCanvas';
import { Joystick } from './src/components/Joystick';
import { PowerUpButton } from './src/components/PowerUpButton';
import { loadBest, saveBest } from './src/storage/records';

function Button({ children, onPress, secondary = false, disabled = false }: {
  children: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
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

function Despista() {
  const mounted = useRef(true);
  const [storageError, setStorageError] = useState('');
  const [ready, setReady] = useState(false);
  const [game] = useState(() => createGame({
    onBest: (best: number) => {
      saveBest(best).catch(() => {
        if (mounted.current) setStorageError('Não foi possível salvar o recorde neste aparelho.');
      });
    },
  }));
  const [snapshot, setSnapshot] = useState(() => game.snapshot());
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [available, setAvailable] = useState({ width: 420, height: 780 });
  const scale = Math.min(available.width / 420, available.height / 780, 1.3);
  const refresh = useCallback(() => setSnapshot(game.snapshot()), [game]);
  const move = useCallback((x: number, y: number) => game.setInput(x, y), [game]);

  useEffect(() => {
    mounted.current = true;
    loadBest().then(value => { if (mounted.current) { game.setBest(value); refresh(); } })
      .catch(() => { if (mounted.current) setStorageError('Recorde indisponível. Você pode jogar normalmente.'); })
      .finally(() => { if (mounted.current) setReady(true); });
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') { game.setPaused(true); refresh(); }
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!game.snapshot().started) return false;
      game.setPaused(true); refresh(); return true;
    });
    return () => { mounted.current = false; appState.remove(); back.remove(); };
  }, [game, refresh]);

  const start = () => { game.start(difficulty); refresh(); };
  const paused = snapshot.paused;
  const menu = !snapshot.started || snapshot.gameOver;
  const active = snapshot.started && !paused;
  const title = snapshot.gameOver
    ? snapshot.reason === 'caught' ? 'PRESO!' : 'FICOU PARA TRÁS!'
    : 'DESPISTA!';
  return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="light-content" backgroundColor="#080d16" />
    <View style={s.available} onLayout={event => setAvailable(event.nativeEvent.layout)}>
      <View style={[s.board, { width: 420 * scale, height: 780 * scale }]}>
        <GameCanvas game={game} scale={scale} onSnapshot={setSnapshot} />
        <View pointerEvents="box-none" style={s.hud}>
          <View style={s.hudRow}>
            <View style={s.panel}>
              <Text style={s.small}>TEMPO</Text><Text style={s.time}>{snapshot.time}</Text>
              <Text style={s.small}>RECORDE {snapshot.bestTime}</Text>
            </View>
            <View style={[s.panel, { alignItems: 'flex-end' }]}>
              <Text style={s.small}>JOGADOR · {snapshot.distanceLabel}</Text>
              <Text style={[s.small, { marginTop: 4 }]}>TELA · {snapshot.screenDistanceLabel}</Text>
              {snapshot.started && <Pressable accessibilityRole="button" accessibilityLabel="Pausar jogo"
                onPress={() => { game.setPaused(true); refresh(); }} style={s.pause}>
                <Text style={s.pauseText}>Ⅱ</Text>
              </Pressable>}
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

        {active && <View pointerEvents="box-none" style={s.controls}>
          <Joystick onMove={move} size={Math.min(164, 420 * scale * .4)} />
          <View style={s.inventory}>
            {[0, 1, 2].map(index => {
              const type = snapshot.inventory[index] as Power | undefined;
              const power = type ? game.powers[type] : undefined;
              return <PowerUpButton key={index} disabled={!power}
                label={power ? `Usar ${power.name}` : `Slot ${index + 1} vazio`}
                onActivate={() => { game.usePowerUp(index); refresh(); }}
                style={[s.slot, { borderColor: power?.color ?? '#ffffff22' }]}>
                {type && power ? <SvgXml xml={uiPowerSvg(type, power.color)} width={36} height={36} />
                  : <Text style={s.empty}>＋</Text>}
                <Text numberOfLines={1} style={s.slotName}>{power?.short ?? 'vazio'}</Text>
              </PowerUpButton>;
            })}
          </View>
        </View>}

        {(menu || paused) && <View style={s.overlay}>
          <ScrollView style={s.menuScroll} contentContainerStyle={s.card} bounces={false}>
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
              <Button onPress={() => { game.setPaused(false); refresh(); }}>CONTINUAR</Button>
              <Button secondary onPress={start}>RECOMEÇAR</Button>
            </> : <>
              <Text style={s.label}>DIFICULDADE</Text>
              <View style={s.difficulties}>
                {DIFFICULTIES.map(mode => <Pressable key={mode.id} accessibilityRole="button"
                  accessibilityState={{ selected: difficulty === mode.id }}
                  onPress={() => setDifficulty(mode.id)}
                  style={[s.difficulty, difficulty === mode.id && s.selected]}>
                  <Text style={[s.difficultyText, difficulty === mode.id && { color: '#101820' }]}>{mode.label}</Text>
                </Pressable>)}
              </View>
              <Text style={s.modeDescription}>{game.describeDifficulty(difficulty)}</Text>
              <Button disabled={!ready} onPress={start}>{!ready ? 'CARREGANDO…' : snapshot.gameOver ? 'JOGAR DE NOVO' : 'COMEÇAR'}</Button>
              <Text style={s.record}>RECORDE · {snapshot.bestTime}</Text>
            </>}
            <Text style={s.help}>Arraste o direcional em quatro direções. Toque nos itens para usar. A multidão esconde você, mas também bloqueia a passagem.</Text>
            {!!storageError && <Text style={s.error}>{storageError}</Text>}
          </ScrollView>
        </View>}
      </View>
    </View>
  </SafeAreaView>;
}
export default function App() {
  return <SafeAreaProvider><Despista /></SafeAreaProvider>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080d16' },
  available: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  board: { overflow: 'hidden', backgroundColor: '#1f2630' },
  hud: { position: 'absolute', top: 12, left: 12, right: 12 },
  hudRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  panel: { backgroundColor: '#0b1020df', borderColor: '#ffffff20', borderWidth: 1, borderRadius: 9, padding: 10 },
  small: { color: '#a8b9ce', fontSize: 10, fontWeight: '700', letterSpacing: .5 },
  time: { color: '#fff', fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'], marginVertical: 3 },
  pause: { width: 56, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 5, borderRadius: 10, backgroundColor: '#243550' },
  pauseText: { color: '#d6edff', fontSize: 23, fontWeight: '900' },
  meter: { marginTop: 7, padding: 8, backgroundColor: '#0b1020e6', borderRadius: 6 },
  track: { height: 4, backgroundColor: '#ffffff18', marginTop: 5, overflow: 'hidden', borderRadius: 2 },
  effects: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  effect: { fontSize: 10, fontWeight: '700', padding: 5, backgroundColor: '#0b1020dd', borderRadius: 5 },
  controls: { position: 'absolute', bottom: 14, left: 12, right: 12, flexDirection: 'row', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between' },
  inventory: { flex: 1, maxWidth: 204, flexDirection: 'row', gap: 6, marginBottom: 6 },
  slot: { flex: 1, height: 78, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 11, backgroundColor: '#0b1020ed' },
  slotName: { color: '#e5edfa', fontSize: 11, marginTop: 5 },
  empty: { color: '#6b7d91', fontSize: 32 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#070b12b8',
    justifyContent: 'center',
    padding: 20,
  },
  menuScroll: { flexGrow: 0, maxHeight: '96%', borderRadius: 18, backgroundColor: '#111a29', borderWidth: 1, borderColor: '#ffffff25' },
  card: { padding: 22, alignItems: 'stretch' },
  eyebrow: { color: '#8ca3bd', fontSize: 9, fontWeight: '800', letterSpacing: 2.4, textAlign: 'center', marginBottom: 10 },
  title: { color: '#f7d154', fontSize: 35, lineHeight: 40, fontWeight: '900', textAlign: 'center' },
  description: { color: '#bdccde', fontSize: 13, lineHeight: 20, textAlign: 'center', marginVertical: 16 },
  label: { color: '#879db6', fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 9 },
  difficulties: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  difficulty: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#202d41', borderRadius: 7 },
  selected: { backgroundColor: '#f7d154' },
  difficultyText: { color: '#c9d8ec', fontWeight: '800', fontSize: 12 },
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
