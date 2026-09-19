import React, { useRef, type ReactNode } from 'react';
import { View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

/** Raw touches keep each inventory slot independent of the joystick's finger. */
export function PowerUpButton({ disabled, label, onActivate, style, children }: {
  disabled: boolean;
  label: string;
  onActivate: () => void;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const touch = useRef<string | null>(null);
  const activate = () => { if (!disabled) onActivate(); };
  const start = (event: GestureResponderEvent) => {
    if (touch.current !== null) return;
    const point = event.nativeEvent.changedTouches[0];
    if (!point) return;
    touch.current = String(point.identifier);
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
