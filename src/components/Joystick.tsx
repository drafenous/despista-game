import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

/** Tracks its own touch without claiming the global responder.
 * A second finger can press an inventory slot while the first keeps moving.
 */
export function Joystick({ onMove, size = 164 }: { onMove: (x: number, y: number) => void; size?: number }) {
  const touch = useRef<{ id: string; x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const release = useCallback(() => {
    touch.current = null; onMove(0, 0); setOffset({ x: 0, y: 0 });
  }, [onMove]);
  const start = (event: GestureResponderEvent) => {
    if (touch.current) return;
    const point = event.nativeEvent.changedTouches[0];
    if (point) {
      touch.current = { id: String(point.identifier), x: point.pageX, y: point.pageY };
      onMove(0, 0);
    }
  };
  const move = (event: GestureResponderEvent) => {
    const origin = touch.current;
    if (!origin) return;
    const point = event.nativeEvent.touches.find(t => String(t.identifier) === origin.id);
    if (!point) return;
    const dx = point.pageX - origin.x, dy = point.pageY - origin.y;
    const dead = Math.hypot(dx, dy) < 10;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const x = dead || !horizontal ? 0 : Math.sign(dx);
    const y = dead || horizontal ? 0 : Math.sign(dy);
    onMove(x, y);
    setOffset(previous => previous.x === x && previous.y === y ? previous : { x, y });
  };
  const end = (event: GestureResponderEvent) => {
    if (!event.nativeEvent.touches.some(t => String(t.identifier) === touch.current?.id)) release();
  };
  return <View onTouchStart={start} onTouchMove={move} onTouchEnd={end} onTouchCancel={release}
    style={[styles.pad, { width: size, height: size }]} accessibilityLabel="Controle direcional: arraste para mover">
    <View pointerEvents="none" style={styles.vertical} /><View pointerEvents="none" style={styles.horizontal} />
    <View pointerEvents="none" style={[styles.stick, { transform: [{ translateX: offset.x * size * .24 }, { translateY: offset.y * size * .24 }] }]} />
  </View>;
}
const styles = StyleSheet.create({
  pad: { flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09111a55', borderRadius: 26 },
  vertical: { position: 'absolute', width: '36%', height: '90%', borderRadius: 12, backgroundColor: '#ffffff15' },
  horizontal: { position: 'absolute', width: '90%', height: '36%', borderRadius: 12, backgroundColor: '#ffffff15' },
  stick: { width: '36%', height: '36%', borderRadius: 12, backgroundColor: '#cbdff366', borderWidth: 2, borderColor: '#e0eeff88' },
});
