import { useEffect, useRef } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { audioLog } from '../debug/audioLog';
import { ensureAudioMode } from './audioMode';

/** Asset: aviso suave de perseguição (loop). */
export const CHASE_ALERT_SOURCE = require('../../assets/sounds/chase-alert.mp3');

/** Volume baixo — indicador, não sirene alta. */
export const CHASE_ALERT_VOLUME = 0.22;

function playerSnapshot(player: {
  playing: boolean;
  paused: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  loop: boolean;
  muted: boolean;
}) {
  return {
    playing: player.playing,
    paused: player.paused,
    isLoaded: player.isLoaded,
    isBuffering: player.isBuffering,
    currentTime: Number(player.currentTime.toFixed?.(2) ?? player.currentTime),
    duration: Number(player.duration.toFixed?.(2) ?? player.duration),
    volume: player.volume,
    loop: player.loop,
    muted: player.muted,
  };
}

export type ChaseAlertGates = {
  active: boolean;
  alert: boolean;
  /** Só para debug — não bloqueia o som. */
  bustedTimer: number;
};

/**
 * Toca o loop enquanto houver perseguição e o jogo estiver rodando.
 * Continua durante o "busted"; para só na pausa / game over / fuga concluída.
 */
export function useChaseAlertSound(gates: ChaseAlertGates) {
  const player = useAudioPlayer(CHASE_ALERT_SOURCE);
  const status = useAudioPlayerStatus(player);
  const configured = useRef(false);
  const lastShouldPlay = useRef<boolean | null>(null);
  const lastLoaded = useRef(false);
  const lastGatesKey = useRef('');

  const shouldPlay = gates.active && gates.alert;

  useEffect(() => {
    ensureAudioMode();
    if (!configured.current) {
      player.loop = true;
      player.volume = CHASE_ALERT_VOLUME;
      configured.current = true;
      audioLog('chase', 'player:configured', {
        targetVolume: CHASE_ALERT_VOLUME,
        ...playerSnapshot(player),
      });
    }
  }, [player]);

  useEffect(() => {
    const busted = gates.bustedTimer > 0;
    const key = `${shouldPlay}|${gates.active}|${gates.alert}|${busted}`;
    if (key === lastGatesKey.current) return;
    lastGatesKey.current = key;
    audioLog('chase', 'gates', {
      shouldPlay,
      active: gates.active,
      alert: gates.alert,
      bustedTimer: Number(gates.bustedTimer.toFixed(2)),
      blockedBy: !gates.active
        ? 'not-active'
        : !gates.alert
          ? 'no-alert'
          : null,
    });
  }, [shouldPlay, gates.active, gates.alert, gates.bustedTimer]);

  useEffect(() => {
    if (status.isLoaded === lastLoaded.current) return;
    lastLoaded.current = status.isLoaded;
    audioLog('chase', status.isLoaded ? 'player:loaded' : 'player:unloaded', {
      duration: Number(status.duration.toFixed(2)),
      playing: status.playing,
    });
  }, [status.isLoaded, status.duration, status.playing]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const modeOk = await ensureAudioMode();
      if (cancelled) return;

      player.volume = CHASE_ALERT_VOLUME;
      player.loop = true;

      const changed = lastShouldPlay.current !== shouldPlay;
      lastShouldPlay.current = shouldPlay;

      if (shouldPlay) {
        if (!player.isLoaded) {
          audioLog('chase', 'play:deferred-not-loaded', playerSnapshot(player));
          return;
        }
        audioLog('chase', changed ? 'play:start' : 'play:ensure', {
          modeOk,
          ...playerSnapshot(player),
        });
        try {
          player.play();
          audioLog('chase', 'play:called', playerSnapshot(player));
        } catch (error: unknown) {
          audioLog('chase', 'play:error', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        if (changed || player.playing) {
          audioLog('chase', 'play:pause', playerSnapshot(player));
        }
        player.pause();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldPlay, player, status.isLoaded]);
}
