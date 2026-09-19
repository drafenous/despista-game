import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import type { Game, Snapshot } from '../game/types';
import { SkiaContext } from '../render/SkiaContext';

export function GameCanvas({ game, scale, onSnapshot }: {
  game: Game; scale: number; onSnapshot: (snapshot: Snapshot) => void;
}) {
  const [emptyPicture] = useState(() => {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, 420, 780));
    const initial = recorder.finishRecordingAsPicture();
    recorder.dispose();
    return initial;
  });
  const picture = useSharedValue(emptyPicture);
  useEffect(() => {
    let frame = 0, last = 0, accumulated = 0, lastHUD = 0;
    let wasPlaying = false, dirty = true;
    const recorder = Skia.PictureRecorder();
    function tick(now: number) {
      const playing = game.isPlaying();
      const stopped = wasPlaying && !playing;
      const delta = last && playing && wasPlaying ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      wasPlaying = playing;
      if (playing) {
        accumulated += delta;
        // Fixed simulation step makes the rules independent of refresh rate.
        while (accumulated >= 1 / 60) {
          game.step(1 / 60);
          accumulated -= 1 / 60;
        }
        dirty = true;
      } else accumulated = 0;
      if (dirty) {
        const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, 420, 780));
        const context = new SkiaContext(canvas);
        try { game.draw(context); } finally { context.dispose(); }
        // Skia observes the shared value without a React commit every frame.
        picture.value = recorder.finishRecordingAsPicture();
        dirty = false;
      }
      if (stopped || (playing && now - lastHUD >= 100)) {
        onSnapshot(game.snapshot()); lastHUD = now;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); recorder.dispose(); };
  }, [game, onSnapshot, picture]);
  return <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Group transform={[{ scale }]}><Picture picture={picture} /></Group>
  </Canvas>;
}
