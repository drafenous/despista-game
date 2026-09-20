import React, { useRef, type ReactNode } from 'react';
import { View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { uiLog } from '../debug/uiLog';

/** Raw touches keep each inventory slot independent when the finger starts on the slot. */
export function PowerUpButton({ disabled, label, onActivate, style, children }: {
  disabled: boolean;
  label: string;
  onActivate: () => void;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const touch = useRef<string | null>(null);
  const activate = () => {
    uiLog('powerup', disabled ? 'press-disabled' : 'activate', { label });
    if (!disabled) onActivate();
  };
  const start = (event: GestureResponderEvent) => {
    if (touch.current !== null) return;
    const point = event.nativeEvent.changedTouches[0];
    if (!point) return;
    touch.current = String(point.identifier);
    uiLog('powerup', 'press', {
      label,
      disabled,
      x: Math.round(point.pageX),
      y: Math.round(point.pageY),
      touches: event.nativeEvent.touches.length,
    });
    activate();
  };
  const end = (event: GestureResponderEvent) => {
    if (event.nativeEvent.changedTouches.some(point => String(point.identifier) === touch.current)) {
      touch.current = null;
    }
  };
  return <View accessible accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} accessibilityActions={[{ name: 'activate' }]}
    onAccessibilityTap={activate}
    onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') activate(); }}
    onTouchStart={start} onTouchEnd={end} onTouchCancel={end} style={style}>
    <View pointerEvents="none" style={{ alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  </View>;
}
