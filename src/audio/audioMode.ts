import { setAudioModeAsync } from 'expo-audio';
import { audioLog } from '../debug/audioLog';

let audioModeReady: Promise<boolean> | null = null;

/** Configura a sessão de áudio uma vez (SFX + loops). */
export function ensureAudioMode() {
  if (!audioModeReady) {
    audioLog('mode', 'start');
    audioModeReady = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    }).then(() => {
      audioLog('mode', 'ok');
      return true;
    }).catch((error: unknown) => {
      audioModeReady = null;
      audioLog('mode', 'fail', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    });
  }
  return audioModeReady;
}
