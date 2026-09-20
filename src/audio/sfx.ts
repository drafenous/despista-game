import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { audioLog } from '../debug/audioLog';
import { ensureAudioMode } from './audioMode';

export type SfxId = 'powerPickup' | 'powerUse';

const SOURCES: Record<SfxId, number> = {
  powerPickup: require('../../assets/sounds/power-pickup.mp3'),
  powerUse: require('../../assets/sounds/power-use.mp3'),
};

/** One-shots um pouco mais audíveis que o loop de perseguição. */
const SFX_VOLUME = 0.35;

const players = new Map<SfxId, AudioPlayer>();

function getPlayer(id: SfxId): AudioPlayer {
  let player = players.get(id);
  if (!player) {
    player = createAudioPlayer(SOURCES[id]);
    player.volume = SFX_VOLUME;
    player.loop = false;
    players.set(id, player);
    audioLog('sfx', 'player:created', { id, volume: SFX_VOLUME });
  }
  return player;
}

/** Toca um efeito one-shot (coleta / uso de power-up). */
export function playSfx(id: SfxId) {
  void (async () => {
    const modeOk = await ensureAudioMode();
    const player = getPlayer(id);
    player.volume = SFX_VOLUME;

    audioLog('sfx', 'play', {
      id,
      modeOk,
      isLoaded: player.isLoaded,
      playing: player.playing,
    });

    try {
      if (player.currentTime > 0) {
        await player.seekTo(0);
      }
      player.play();
      audioLog('sfx', 'play:called', {
        id,
        playing: player.playing,
        paused: player.paused,
      });
    } catch (error: unknown) {
      audioLog('sfx', 'play:error', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}
