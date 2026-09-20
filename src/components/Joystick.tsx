import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { uiLog } from '../debug/uiLog';

/** Four-way direction from a pixel delta (shared by fixed and floating sticks). */
export function directionFromDelta(dx: number, dy: number, deadZone = 10): { x: number; y: number } {
  const dead = Math.hypot(dx, dy) < deadZone;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  return {
    x: dead || !horizontal ? 0 : Math.sign(dx),
    y: dead || horizontal ? 0 : Math.sign(dy),
  };
}

/** Visual base + stick for the virtual joystick. */
export function JoystickFace({ size, offset }: {
  size: number;
  offset: { x: number; y: number };
}) {
  return <>
    <View pointerEvents="none" style={face.vertical} />
    <View pointerEvents="none" style={face.horizontal} />
    <View pointerEvents="none" style={[face.stick, {
      transform: [{ translateX: offset.x * size * .24 }, { translateY: offset.y * size * .24 }],
    }]} />
  </>;
}

/** Fixed corner joystick. */
export function Joystick({ onMove, onAuxTouch, size = 164 }: {
  onMove: (x: number, y: number) => void;
  onAuxTouch?: (event: GestureResponderEvent) => void;
  size?: number;
}) {
  const touch = useRef<{ id: string; x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const release = useCallback(() => {
    if (touch.current) uiLog('joystick.fixed', 'release');
    touch.current = null; onMove(0, 0); setOffset({ x: 0, y: 0 });
  }, [onMove]);
  const start = (event: GestureResponderEvent) => {
    onAuxTouch?.(event);
    if (touch.current) {
      uiLog('joystick.fixed', 'touch-ignored', { reason: 'already-tracking', touches: event.nativeEvent.touches.length });
      return;
    }
    const point = event.nativeEvent.changedTouches[0];
    if (point) {
      touch.current = { id: String(point.identifier), x: point.pageX, y: point.pageY };
      uiLog('joystick.fixed', 'press', { x: Math.round(point.pageX), y: Math.round(point.pageY) });
      onMove(0, 0);
    }
  };
  const move = (event: GestureResponderEvent) => {
    const origin = touch.current;
    if (!origin) return;
    const point = event.nativeEvent.touches.find(t => String(t.identifier) === origin.id);
    if (!point) return;
    const next = directionFromDelta(point.pageX - origin.x, point.pageY - origin.y);
    onMove(next.x, next.y);
    setOffset(previous => {
      if (previous.x === next.x && previous.y === next.y) return previous;
      uiLog('joystick.fixed', 'direction', next);
      return next;
    });
  };
  const end = (event: GestureResponderEvent) => {
    if (!event.nativeEvent.touches.some(t => String(t.identifier) === touch.current?.id)) release();
  };
  return <View onTouchStart={start} onTouchMove={move} onTouchEnd={end} onTouchCancel={release}
    style={[face.pad, { width: size, height: size }]} accessibilityLabel="Controle direcional: arraste para mover">
    <JoystickFace size={size} offset={offset} />
  </View>;
}

const face = StyleSheet.create({
  pad: { flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09111a55', borderRadius: 26 },
  vertical: { position: 'absolute', width: '36%', height: '90%', borderRadius: 12, backgroundColor: '#ffffff15' },
  horizontal: { position: 'absolute', width: '90%', height: '36%', borderRadius: 12, backgroundColor: '#ffffff15' },
  stick: { width: '36%', height: '36%', borderRadius: 12, backgroundColor: '#cbdff366', borderWidth: 2, borderColor: '#e0eeff88' },
});
