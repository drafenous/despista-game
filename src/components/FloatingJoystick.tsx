import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { uiLog } from '../debug/uiLog';
import { directionFromDelta, JoystickFace } from './Joystick';

/**
 * Floating / dynamic joystick: appears at the touch point, disappears on release.
 * Same four-direction rules as the fixed corner stick.
 */
export function FloatingJoystick({ onMove, onAuxTouch, size = 164 }: {
  onMove: (x: number, y: number) => void;
  onAuxTouch?: (event: GestureResponderEvent) => void;
  size?: number;
}) {
  const touch = useRef<{ id: string; pageX: number; pageY: number } | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const release = useCallback(() => {
    if (touch.current) uiLog('joystick.free', 'release');
    touch.current = null;
    setAnchor(null);
    setOffset({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);

  const start = (event: GestureResponderEvent) => {
    onAuxTouch?.(event);
    if (touch.current) {
      uiLog('joystick.free', 'touch-ignored', { reason: 'already-tracking', touches: event.nativeEvent.touches.length });
      return;
    }
    const point = event.nativeEvent.changedTouches[0];
    if (!point) return;
    touch.current = { id: String(point.identifier), pageX: point.pageX, pageY: point.pageY };
    setAnchor({ x: point.locationX, y: point.locationY });
    setOffset({ x: 0, y: 0 });
    uiLog('joystick.free', 'press', {
      x: Math.round(point.pageX),
      y: Math.round(point.pageY),
      localX: Math.round(point.locationX),
      localY: Math.round(point.locationY),
    });
    onMove(0, 0);
  };

  const move = (event: GestureResponderEvent) => {
    const origin = touch.current;
    if (!origin) return;
    const point = event.nativeEvent.touches.find(t => String(t.identifier) === origin.id);
    if (!point) return;
    const next = directionFromDelta(point.pageX - origin.pageX, point.pageY - origin.pageY);
    onMove(next.x, next.y);
    setOffset(previous => {
      if (previous.x === next.x && previous.y === next.y) return previous;
      uiLog('joystick.free', 'direction', next);
      return next;
    });
  };

  const end = (event: GestureResponderEvent) => {
    if (!event.nativeEvent.touches.some(t => String(t.identifier) === touch.current?.id)) release();
  };

  return <View accessibilityLabel="Joystick livre: toque e arraste para mover"
    onTouchStart={start} onTouchMove={move} onTouchEnd={end} onTouchCancel={release}
    style={styles.layer}>
    {anchor && (
      <View pointerEvents="none" style={[styles.pad, {
        width: size,
        height: size,
        left: anchor.x - size / 2,
        top: anchor.y - size / 2,
      }]}>
        <JoystickFace size={size} offset={offset} />
      </View>
    )}
  </View>;
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill },
  pad: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09111a55',
    borderRadius: 26,
  },
});
