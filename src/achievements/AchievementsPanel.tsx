import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AchievementTracker } from './index';

export function AchievementsPanel({
  tracker,
  onBack,
}: {
  tracker: AchievementTracker;
  onBack: () => void;
}) {
  const items = tracker.list();
  const unlocked = items.filter(item => item.unlocked).length;

  return (
    <>
      <Text style={s.eyebrow}>MESMAS CONQUISTAS · ANDROID E IOS</Text>
      <Text accessibilityRole="header" style={s.title}>CONQUISTAS</Text>
      <Text style={s.description}>
        {unlocked} / {items.length} desbloqueadas. O progresso fica salvo neste aparelho.
      </Text>

      {items.map(item => {
        if (!item.visible) {
          return (
            <View key={item.id} style={s.row}>
              <Text style={s.hiddenName}>???</Text>
              <Text style={s.hiddenDesc}>Conquista secreta</Text>
            </View>
          );
        }
        const ratio = item.target > 1 ? Math.min(1, item.value / item.target) : item.unlocked ? 1 : 0;
        return (
          <View key={item.id} style={[s.row, item.unlocked && s.rowUnlocked]}>
            <View style={s.rowTop}>
              <Text style={[s.name, item.unlocked && s.nameOn]}>{item.name}</Text>
              <Text style={s.badge}>{item.unlocked ? 'OK' : item.target > 1 ? `${item.value}/${item.target}` : '—'}</Text>
            </View>
            <Text style={s.desc}>{item.description}</Text>
            {item.target > 1 && (
              <View style={s.track}>
                <View style={[s.fill, { width: `${ratio * 100}%` }]} />
              </View>
            )}
          </View>
        );
      })}

      <View style={{ marginTop: 12 }}>
        <Pressable accessibilityRole="button" onPress={onBack}
          style={({ pressed }) => [s.button, pressed && { opacity: 0.7 }]}>
          <Text style={s.buttonText}>VOLTAR</Text>
        </Pressable>
      </View>
    </>
  );
}

export function AchievementToast({ name }: { name: string }) {
  return (
    <View pointerEvents="none" style={s.toast}>
      <Text style={s.toastEyebrow}>CONQUISTA</Text>
      <Text style={s.toastName}>{name}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  eyebrow: { color: '#8ca3bd', fontSize: 9, fontWeight: '800', letterSpacing: 2.4, textAlign: 'center', marginBottom: 10 },
  title: { color: '#f7d154', fontSize: 35, lineHeight: 40, fontWeight: '900', textAlign: 'center' },
  description: { color: '#bdccde', fontSize: 13, lineHeight: 20, textAlign: 'center', marginVertical: 16 },
  row: {
    backgroundColor: '#0b1220',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffffff14',
    padding: 12,
    marginBottom: 8,
  },
  rowUnlocked: { borderColor: '#77df8944', backgroundColor: '#102018' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  name: { color: '#d5e2f2', fontWeight: '800', fontSize: 13, flex: 1 },
  nameOn: { color: '#9be7a8' },
  badge: { color: '#8aa0b8', fontSize: 11, fontWeight: '800' },
  desc: { color: '#90a4bb', fontSize: 11, lineHeight: 16, marginTop: 4 },
  hiddenName: { color: '#6d7f93', fontWeight: '800', fontSize: 13 },
  hiddenDesc: { color: '#5d6f84', fontSize: 11, marginTop: 4 },
  track: { height: 4, backgroundColor: '#ffffff14', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: '#f7d154' },
  button: { backgroundColor: '#283950', borderRadius: 9, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#dfebfa', fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },
  toast: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    zIndex: 20,
    minWidth: 220,
    maxWidth: '86%',
    backgroundColor: '#142033f2',
    borderColor: '#f7d15488',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toastEyebrow: { color: '#f7d154', fontSize: 10, fontWeight: '800', letterSpacing: 1.6, textAlign: 'center' },
  toastName: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 4 },
});
