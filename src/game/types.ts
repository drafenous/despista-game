import { createGame } from './engine';
export type Game = ReturnType<typeof createGame>;
export type Snapshot = ReturnType<Game['snapshot']>;
export type Difficulty = 'easy' | 'medium' | 'hard' | 'pro' | 'impossible';
export const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Fácil' }, { id: 'medium', label: 'Médio' },
  { id: 'hard', label: 'Difícil' }, { id: 'pro', label: 'Pro' },
  { id: 'impossible', label: 'Impossível' },
];
export type Power = keyof Game['powers'];
