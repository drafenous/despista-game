import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, ClipOp, Group, Picture, Rect, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import type { Game, Snapshot } from '../game/types';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/viewport';
import { SkiaContext } from '../render/SkiaContext';

const LETTERBOX = '#080d16';
const MAX_STEPS_PER_FRAME = 3;
const PERF = typeof __DEV__ !== 'undefined' && __DEV__;

function hudSignature(snap: Snapshot): string {
  const inv = snap.inventory.join(',');
  const effects = snap.effects.map(e => `${e.label}:${Number(e.remaining).toFixed(1)}`).join(',');
  return [
    snap.time,
    snap.bestTime,
    snap.distanceLabel,
    snap.screenDistanceLabel,
    Math.round(snap.suspicion),
    snap.alert ? 1 : 0,
    snap.paused ? 1 : 0,
    snap.gameOver ? 1 : 0,
    snap.started ? 1 : 0,
    snap.reason ?? '',
    snap.difficulty,
    snap.bustedTimer.toFixed(1),
    snap.pursuitEscapeTimer.toFixed(1),
    snap.pursuitGraceTimer.toFixed(1),
    snap.escapeTarget,
    inv,
    effects,
  ].join('|');
}

function replacePicture(
  slot: { value: SkPicture },
  next: SkPicture,
  empty: SkPicture,
  retireQueue: SkPicture[],
) {
  const previous = slot.value;
  slot.value = next;
  // Skia's UI-thread redraw can lag the SharedValue swap by a frame or two.
  // Keep a few generations alive, then dispose the oldest.
  if (previous && previous !== empty && previous !== next) {
    retireQueue.push(previous);
    while (retireQueue.length > 3) {
      const retired = retireQueue.shift();
      try { retired?.dispose(); } catch { /* already disposed */ }
    }
  }
}

export function GameCanvas({ game, scale, offsetX, offsetY, viewportWidth, viewportHeight, onSnapshot }: {
  game: Game;
  scale: number;
  offsetX: number;
  offsetY: number;
  viewportWidth: number;
  viewportHeight: number;
  onSnapshot: (snapshot: Snapshot) => void;
}) {
  const playfield = useMemo(() => Skia.XYWHRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT), []);
  const [emptyPicture] = useState(() => {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(playfield);
    const initial = recorder.finishRecordingAsPicture();
    recorder.dispose();
    return initial;
  });
  const bgPicture = useSharedValue(emptyPicture);
  const fgPicture = useSharedValue(emptyPicture);

  useEffect(() => {
    let frame = 0, last = 0, accumulated = 0, lastHUD = 0;
    let wasPlaying = false, dirty = true;
    let lastBgKey: number | null = null;
    let lastHudKey = '';
    const recorder = Skia.PictureRecorder();
    const context = new SkiaContext();
    const retireBg: SkPicture[] = [];
    const retireFg: SkPicture[] = [];

    let perfFrames = 0;
    let perfStep = 0;
    let perfDraw = 0;
    let perfFinish = 0;
    let perfLastLog = 0;

    function recordLayer(draw: (ctx: SkiaContext) => void): SkPicture {
      const drawStart = PERF ? performance.now() : 0;
      const canvas = recorder.beginRecording(playfield);
      canvas.save();
      canvas.clipRect(playfield, ClipOp.Intersect, true);
      context.attach(canvas);
      try { draw(context); } finally { context.detach(); }
      canvas.restore();
      if (PERF) perfDraw += performance.now() - drawStart;
      const finishStart = PERF ? performance.now() : 0;
      const picture = recorder.finishRecordingAsPicture();
      if (PERF) perfFinish += performance.now() - finishStart;
      return picture;
    }

    function tick(now: number) {
      const playing = game.isPlaying();
      const stopped = wasPlaying && !playing;
      const delta = last && playing && wasPlaying ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      wasPlaying = playing;

      let stepMs = 0;
      if (playing) {
        accumulated += delta;
        let steps = 0;
        const stepStart = PERF ? performance.now() : 0;
        while (accumulated >= 1 / 60 && steps < MAX_STEPS_PER_FRAME) {
          game.step(1 / 60);
          accumulated -= 1 / 60;
          steps++;
        }
        if (accumulated >= 1 / 60) accumulated = 0;
        if (PERF) stepMs = performance.now() - stepStart;
        dirty = true;
      } else accumulated = 0;

      if (dirty) {
        const bgKey = game.backgroundKey();
        if (lastBgKey !== bgKey) {
          replacePicture(bgPicture, recordLayer(ctx => game.drawBackground(ctx)), emptyPicture, retireBg);
          lastBgKey = bgKey;
        }
        replacePicture(fgPicture, recordLayer(ctx => game.drawForeground(ctx)), emptyPicture, retireFg);
        dirty = false;
        if (PERF) {
          perfStep += stepMs;
          perfFrames++;
          if (!perfLastLog) perfLastLog = now;
          if (now - perfLastLog >= 2000) {
            const n = Math.max(1, perfFrames);
            console.log('[perf]', {
              fps: Math.round(n * 1000 / (now - perfLastLog)),
              stepMs: +(perfStep / n).toFixed(2),
              drawRecordMs: +(perfDraw / n).toFixed(2),
              pictureFinishMs: +(perfFinish / n).toFixed(2),
            });
            perfFrames = 0;
            perfStep = 0;
            perfDraw = 0;
            perfFinish = 0;
            perfLastLog = now;
          }
        }
      }

      if (stopped || (playing && now - lastHUD >= 100)) {
        const snap = game.snapshot();
        const key = hudSignature(snap);
        if (stopped || key !== lastHudKey) {
          lastHudKey = key;
          onSnapshot(snap);
        }
        lastHUD = now;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      context.dispose();
      recorder.dispose();
    };
  }, [game, onSnapshot, bgPicture, fgPicture, playfield, emptyPicture]);

  const worldW = WORLD_WIDTH * scale;
  const worldH = WORLD_HEIGHT * scale;
  const right = offsetX + worldW;
  const bottom = offsetY + worldH;

  return <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Group transform={[{ translateX: offsetX }, { translateY: offsetY }]}>
      <Group transform={[{ scale }]} clip={playfield}>
        <Picture picture={bgPicture} />
        <Picture picture={fgPicture} />
      </Group>
    </Group>
    {/* Opaque letterbox masks keep any residual bleed out of the viewport chrome. */}
    {offsetY > 0 && <Rect x={0} y={0} width={viewportWidth} height={offsetY} color={LETTERBOX} />}
    {bottom < viewportHeight && (
      <Rect x={0} y={bottom} width={viewportWidth} height={viewportHeight - bottom} color={LETTERBOX} />
    )}
    {offsetX > 0 && <Rect x={0} y={offsetY} width={offsetX} height={worldH} color={LETTERBOX} />}
    {right < viewportWidth && (
      <Rect x={right} y={offsetY} width={viewportWidth - right} height={worldH} color={LETTERBOX} />
    )}
  </Canvas>;
}
