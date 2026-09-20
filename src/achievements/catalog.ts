/** Catálogo único de conquistas — mesmos IDs/critérios em Android e iOS. */

export type AchievementId =
  | 'first_run'
  | 'first_caught'
  | 'first_escape'
  | 'crowd_cover_10s'
  | 'low_suspicion_30s'
  | 'survive_60s'
  | 'run_500m'
  | 'run_2km_total'
  | 'play_30min_total'
  | 'beat_best_time'
  | 'easy_2min'
  | 'medium_2min'
  | 'hard_90s'
  | 'pro_60s'
  | 'impossible_30s'
  | 'impossible_3min'
  | 'first_alert'
  | 'escape_5'
  | 'escape_no_items'
  | 'no_cop_touch_2min'
  | 'near_capture_escape'
  | 'survive_anti_camp'
  | 'no_camera_90s'
  | 'suspicion_under_20_60s'
  | 'suspicion_99_recover'
  | 'cameras_10_clean'
  | 'crowd_cover_30s'
  | 'direction_50'
  | 'no_obstacle_100m'
  | 'four_directions_escape'
  | 'use_escape'
  | 'use_soap'
  | 'use_skates_50m'
  | 'use_moses'
  | 'use_cloak_alert'
  | 'use_teleport_capture'
  | 'use_shield'
  | 'use_timemachine'
  | 'collect_all_8_items'
  | 'inventory_full'
  | 'use_20_items'
  | 'escape_one_item'
  | 'survive_90s_no_items'
  | 'survive_3_difficulties'
  | 'hard_escape_4s'
  | 'impossible_no_escape_item'
  | 'play_10_games'
  | 'play_3_days'
  | 'near_record'
  | 'unlock_25';

export type AchievementDef = {
  id: AchievementId;
  /** ID estável para lojas nativas (Game Center / Play Games). */
  storeId: string;
  name: string;
  description: string;
  /** Meta de progresso (1 = binário). */
  target: number;
  hidden?: boolean;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_run', storeId: 'despista_first_run', name: 'Primeiros passos', description: 'Jogue sua primeira partida.', target: 1 },
  { id: 'first_caught', storeId: 'despista_first_caught', name: 'Quase pego', description: 'Seja capturado pela primeira vez.', target: 1 },
  { id: 'first_escape', storeId: 'despista_first_escape', name: 'Fugitivo', description: 'Escape de uma perseguição.', target: 1 },
  { id: 'crowd_cover_10s', storeId: 'despista_crowd_cover_10s', name: 'Sombra na multidão', description: 'Fique 10 segundos sob cobertura da multidão.', target: 1 },
  { id: 'low_suspicion_30s', storeId: 'despista_low_suspicion_30s', name: 'Olho no radar', description: 'Sobreviva 30s com suspeita no máximo 50.', target: 1 },
  { id: 'survive_60s', storeId: 'despista_survive_60s', name: '1 minuto vivo', description: 'Sobreviva 60 segundos em qualquer dificuldade.', target: 1 },
  { id: 'run_500m', storeId: 'despista_run_500m', name: 'Maratonista', description: 'Percorra 500 m em uma única partida.', target: 1 },
  { id: 'run_2km_total', storeId: 'despista_run_2km_total', name: 'Maratonista urbano', description: 'Percorra 2 km no total.', target: 2000 },
  { id: 'play_30min_total', storeId: 'despista_play_30min_total', name: 'Veterano', description: 'Acumule 30 minutos de jogo.', target: 1800 },
  { id: 'beat_best_time', storeId: 'despista_beat_best_time', name: 'Recorde pessoal', description: 'Bata o seu próprio recorde de tempo.', target: 1 },
  { id: 'easy_2min', storeId: 'despista_easy_2min', name: 'Modo fácil', description: 'Sobreviva 2 minutos no Fácil.', target: 1 },
  { id: 'medium_2min', storeId: 'despista_medium_2min', name: 'No meio', description: 'Sobreviva 2 minutos no Médio.', target: 1 },
  { id: 'hard_90s', storeId: 'despista_hard_90s', name: 'Difícil de verdade', description: 'Sobreviva 90 segundos no Difícil.', target: 1 },
  { id: 'pro_60s', storeId: 'despista_pro_60s', name: 'Pro', description: 'Sobreviva 60 segundos no Pro.', target: 1 },
  { id: 'impossible_30s', storeId: 'despista_impossible_30s', name: 'Impossível… quase', description: 'Sobreviva 30 segundos no Impossível.', target: 1 },
  { id: 'impossible_3min', storeId: 'despista_impossible_3min', name: 'Lenda', description: 'Sobreviva 3 minutos no Impossível.', target: 1, hidden: true },
  { id: 'first_alert', storeId: 'despista_first_alert', name: 'Alerta vermelho', description: 'Entre em alerta pela primeira vez.', target: 1 },
  { id: 'escape_5', storeId: 'despista_escape_5', name: 'Despistado', description: 'Escape de 5 perseguições.', target: 5 },
  { id: 'escape_no_items', storeId: 'despista_escape_no_items', name: 'Fantasma', description: 'Escape de uma perseguição sem usar itens.', target: 1 },
  { id: 'no_cop_touch_2min', storeId: 'despista_no_cop_touch_2min', name: 'Contato zero', description: 'Sobreviva 2 minutos sem tocar em nenhum policial.', target: 1 },
  { id: 'near_capture_escape', storeId: 'despista_near_capture_escape', name: 'Quase lá', description: 'Fique 1s sob captura e ainda assim escape.', target: 1 },
  { id: 'survive_anti_camp', storeId: 'despista_survive_anti_camp', name: 'Anti-camping', description: 'Sobreviva depois do anti-camping te forçar a se mover.', target: 1 },
  { id: 'no_camera_90s', storeId: 'despista_no_camera_90s', name: 'Fora do frame', description: 'Fique 90 segundos sem ser visto por câmeras.', target: 1 },
  { id: 'suspicion_under_20_60s', storeId: 'despista_suspicion_under_20_60s', name: 'Baixa suspeita', description: 'Mantenha a suspeita abaixo de 20 por 60 segundos.', target: 1 },
  { id: 'suspicion_99_recover', storeId: 'despista_suspicion_99_recover', name: 'No limite', description: 'Chegue a 99 de suspeita e volte abaixo de 50.', target: 1 },
  { id: 'cameras_10_clean', storeId: 'despista_cameras_10_clean', name: 'Cego de câmera', description: 'Passe por 10 câmeras sem ser reconhecido.', target: 10 },
  { id: 'crowd_cover_30s', storeId: 'despista_crowd_cover_30s', name: 'Peixe na água', description: 'Fique 30 segundos contínuos sob cobertura da multidão.', target: 1 },
  { id: 'direction_50', storeId: 'despista_direction_50', name: 'Zig-zag', description: 'Mude de direção 50 vezes em uma partida.', target: 1 },
  { id: 'no_obstacle_100m', storeId: 'despista_no_obstacle_100m', name: 'Sem bater', description: 'Percorra 100 m sem colidir em obstáculos.', target: 1 },
  { id: 'four_directions_escape', storeId: 'despista_four_directions_escape', name: 'Esquerda e direita', description: 'Use as quatro direções durante uma fuga.', target: 1 },
  { id: 'use_escape', storeId: 'despista_use_escape', name: 'Fuga imediata', description: 'Use o item Fuga.', target: 1 },
  { id: 'use_soap', storeId: 'despista_use_soap', name: 'Escorregadio', description: 'Use o Sabonete durante uma perseguição e escape.', target: 1 },
  { id: 'use_skates_50m', storeId: 'despista_use_skates_50m', name: 'Patins ligados', description: 'Percorra 50 m sob o efeito dos Patins.', target: 1 },
  { id: 'use_moses', storeId: 'despista_use_moses', name: 'Mar aberto', description: 'Use o Cajado e Moisés.', target: 1 },
  { id: 'use_cloak_alert', storeId: 'despista_use_cloak_alert', name: 'Invisível', description: 'Use o Manto da invisibilidade sob alerta.', target: 1 },
  { id: 'use_teleport_capture', storeId: 'despista_use_teleport_capture', name: 'Blink', description: 'Use o Teletransporte enquanto está sob captura.', target: 1 },
  { id: 'use_shield', storeId: 'despista_use_shield', name: 'Blindado', description: 'Use o Escudo perto de um policial.', target: 1 },
  { id: 'use_timemachine', storeId: 'despista_use_timemachine', name: 'Déjà vu', description: 'Use a Máquina do tempo.', target: 1 },
  { id: 'collect_all_8_items', storeId: 'despista_collect_all_8_items', name: 'Colecionador', description: 'Colete os 8 tipos de item pelo menos uma vez.', target: 8 },
  { id: 'inventory_full', storeId: 'despista_inventory_full', name: 'Inventário cheio', description: 'Tenha 3 itens ao mesmo tempo.', target: 1 },
  { id: 'use_20_items', storeId: 'despista_use_20_items', name: 'Gastador', description: 'Use 20 itens no total.', target: 20 },
  { id: 'escape_one_item', storeId: 'despista_escape_one_item', name: 'Cirurgião', description: 'Escape de uma perseguição usando exatamente 1 item.', target: 1 },
  { id: 'survive_90s_no_items', storeId: 'despista_survive_90s_no_items', name: 'Sem poder', description: 'Sobreviva 90 segundos sem usar nenhum item.', target: 1 },
  { id: 'survive_3_difficulties', storeId: 'despista_survive_3_difficulties', name: 'Só Fácil? Não', description: 'Sobreviva 60s em 3 dificuldades diferentes.', target: 3 },
  { id: 'hard_escape_4s', storeId: 'despista_hard_escape_4s', name: 'Sob pressão', description: 'Escape no Difícil ou no Pro.', target: 1 },
  { id: 'impossible_no_escape_item', storeId: 'despista_impossible_no_escape_item', name: 'Impossível sem Fuga', description: 'Sobreviva 20s no Impossível sem usar Fuga.', target: 1, hidden: true },
  { id: 'play_10_games', storeId: 'despista_play_10_games', name: '10 partidas', description: 'Complete 10 partidas.', target: 10 },
  { id: 'play_3_days', storeId: 'despista_play_3_days', name: 'Persistente', description: 'Jogue em 3 dias diferentes.', target: 3 },
  { id: 'near_record', storeId: 'despista_near_record', name: 'Quase herói', description: 'Chegue a 10 segundos do seu recorde sem batê-lo.', target: 1 },
  { id: 'unlock_25', storeId: 'despista_unlock_25', name: 'Despista!', description: 'Desbloqueie 25 conquistas.', target: 25 },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENTS.map(item => [item.id, item]),
) as Record<AchievementId, AchievementDef>;

export const ALL_ITEM_TYPES = [
  'escape', 'soap', 'skates', 'staff', 'invis', 'teleport', 'shield', 'time',
] as const;
