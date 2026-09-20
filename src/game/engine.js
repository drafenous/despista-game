/**
 * Motor portado do MVP v44. Sem DOM, timers globais ou armazenamento.
 * Coordenadas de mundo: y cresce para cima. Input touch: y cresce para baixo.
 * Os desenhos recebem um contexto compatível implementado sobre Skia nativo.
 */
/**
 * @param {{width?: number, height?: number, initialBest?: number,
 * random?: () => number, onBest?: (best: number) => void,
 * onPowerPickup?: (type: string) => void, onPowerUse?: (type: string) => void}} options
 */
export function createGame({width = 360, height = 640, initialBest = 0,
  random = Math.random, onBest = () => {},
  onPowerPickup = () => {}, onPowerUse = () => {}} = {}) {
  /** Estatísticas da partida atual para conquistas (não afetam a simulação). */
  let runStats = createEmptyRunStats();
  let runLastDir = null;
  let runDirsInEscape = new Set();
  let runAlertItemsUsed = 0;
  let runMaxBustedInAlert = 0;
  let runSoapInAlert = false;
  const W = width, H = height;
  let ctx;
  let reason = null;
  let cameraY = 0;
  let generatedUntil = 0;
  let elapsed = 0;
  let distanceTravelledUnits = 0;
  let screenDistanceTravelledUnits = 0;
  let lastMeasuredCameraY = 0;
  const DISTANCE_UNITS_PER_METER = 16;
  let suspicion = 0;
  let alert = false;
  let started = false;
  let gameOver = false;
  let paused = false;
  let spawnIndicator = 0;
  let pursuitEscapeTimer = 0;
  let pursuitGraceTimer = 0;
  let mainPursuer = null;
  let bustedTimer = 0;
  let playerIdleTimer = 0;
  let idleHunterCop = null;
  let difficulty = "medium";
  let impossiblePursuitStarted = false;

  // Power-ups / efeitos ativos.
  let escapeImmunityTimer = 0;
  let soapTimer = 0;
  let skatesTimer = 0;
  let staffTimer = 0;
  let invisibilityTimer = 0;
  let shieldPulseTimer = 0;
  let timeFreezeTimer = 0;
  // Relógio das câmeras (sweep/rotate). Não avança com o tempo parado.
  let cameraAnimTime = 0;
  let powerPickupFlash = 0;
  let powerPickupCooldown = 0;

  const inventory = [];
  const powerUps = [];

  let powerBag = [];
  let chunksSincePowerUp = 0;
  let lastPowerType = null;
  let lastPowerSpawnY = -Infinity;

  function createEmptyRunStats(){
    return {
      crowdCoverTime: 0,
      crowdCoverStreak: 0,
      crowdCoverStreakMax: 0,
      suspicionLow50Time: 0,
      suspicionLow20Time: 0,
      noCameraTime: 0,
      directionChanges: 0,
      obstacleHit: false,
      cleanDistanceMeters: 0,
      skatesMeters: 0,
      camerasClean: 0,
      maxBusted: 0,
      touchedPolice: false,
      escapes: 0,
      itemsUsed: 0,
      itemsUsedInAlert: 0,
      usedEscapeItem: false,
      usedSoapInAlert: false,
      usedCloakInAlert: false,
      usedTeleportInBusted: false,
      usedShieldNearCop: false,
      usedStaff: false,
      usedTime: false,
      usedSkates: false,
      alertEver: false,
      antiCamp: false,
      antiCampSurvived: false,
      inventoryFull: false,
      suspicionHit99: false,
      suspicionRecovered: false,
      dirsInEscape: [],
      nearCaptureEscape: false,
      escapeNoItems: false,
      escapeOneItem: false,
      hardEscape: false,
      pickedTypes: [],
      usedTypes: [],
    };
  }

  function rememberType(list, type){
    if(!list.includes(type)) list.push(type);
  }

  function noteEscape(natural){
    runStats.escapes += 1;
    runStats.itemsUsedInAlert = Math.max(runStats.itemsUsedInAlert, runAlertItemsUsed);
    if(runAlertItemsUsed === 0) runStats.escapeNoItems = true;
    if(runAlertItemsUsed === 1) runStats.escapeOneItem = true;
    if(runMaxBustedInAlert >= 1) runStats.nearCaptureEscape = true;
    if(runSoapInAlert) runStats.usedSoapInAlert = true;
    if(runDirsInEscape.size >= 4){
      runStats.dirsInEscape = [...runDirsInEscape];
    }
    if(natural && (difficulty === "hard" || difficulty === "pro")){
      runStats.hardEscape = true;
    }
    runAlertItemsUsed = 0;
    runMaxBustedInAlert = 0;
    runSoapInAlert = false;
    runDirsInEscape = new Set();
  }

  const POWER_TYPES = {
    escape: {
      name:"Fuga imediata", short:"Fuga", icon:"⚡", color:"#f6d64a"
    },
    soap: {
      name:"Sabonete", short:"Sabão", icon:"▱", color:"#64d9ff"
    },
    skates: {
      name:"Patins", short:"Patins", icon:"↠", color:"#ff8bd5"
    },
    staff: {
      name:"Cajado e Moisés", short:"Moisés", icon:"ϟ", color:"#e9c878"
    },
    invis: {
      name:"Manto da invisibilidade", short:"Manto", icon:"◌", color:"#b9a7ff"
    },
    teleport: {
      name:"Teletransporte", short:"Tele", icon:"✦", color:"#70f2d0"
    },
    shield: {
      name:"Escudo de proteção", short:"Escudo", icon:"◆", color:"#6fa8ff"
    },
    time: {
      name:"Máquina do tempo", short:"Tempo", icon:"⌛", color:"#ffd166"
    }
  };
  const POWER_KEYS = Object.keys(POWER_TYPES);

  function refillPowerBag(){
    // "Shuffle bag": todos os tipos aparecem uma vez antes de qualquer repetição.
    powerBag = [...POWER_KEYS];

    for(let i=powerBag.length-1;i>0;i--){
      const j=Math.floor(random()*(i+1));
      [powerBag[i],powerBag[j]]=[powerBag[j],powerBag[i]];
    }

    // Evita que o primeiro item do novo ciclo repita o último do ciclo anterior.
    if(powerBag.length>1 && powerBag[0]===lastPowerType){
      const swapIndex = 1 + Math.floor(random()*(powerBag.length-1));
      [powerBag[0],powerBag[swapIndex]]=[powerBag[swapIndex],powerBag[0]];
    }
  }

  function nextPowerType(){
    if(powerBag.length===0) refillPowerBag();
    const type=powerBag.shift();
    lastPowerType=type;
    return type;
  }

  let best = Number.isFinite(initialBest) ? Math.max(0, initialBest) : 0;

  const keys = new Set();
  const input = {x:0, y:0, active:false, pointerId:null, originX:0, originY:0};

  const player = {
    x: W/2, y: 0, r: 12, speed: 185, vx:0, vy:0
  };

  const npcs = [];
  const cops = [];
  const cameras = [];
  const decor = [];
  const obstacles = [];

  function fmt(t){
    const m = Math.floor(t/60);
    const s = Math.floor(t%60);
    const cs = Math.floor((t-Math.floor(t))*100);
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
  }

  function distanceMeters(){
    return distanceTravelledUnits / DISTANCE_UNITS_PER_METER;
  }

  function screenDistanceMeters(){
    return screenDistanceTravelledUnits / DISTANCE_UNITS_PER_METER;
  }

  function fmtDistance(meters){
    if(meters >= 1000) return `${(meters/1000).toFixed(2)} km`;
    if(meters < 100) return `${meters.toFixed(1)} m`;
    return `${Math.round(meters)} m`;
  }




  function rand(a,b){ return a + random()*(b-a); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }

  function isInsidePlayerSpawnSafeZone(x,y,padding=0){
    // Mantém uma área livre ao redor do ponto inicial do jogador.
    const safeX = W * .5;
    const safeY = 40;
    const radius = 78 + padding;
    return dist(x,y,safeX,safeY) < radius;
  }

  function rectTouchesPlayerSpawnSafeZone(x,y,w,h,padding=0){
    const safeX = W * .5;
    const safeY = 40;
    const nearestX = clamp(safeX, x, x+w);
    const nearestY = clamp(safeY, y, y+h);
    return dist(safeX,safeY,nearestX,nearestY) < 72 + padding;
  }

  function initialPoliceMinWorldY(){
    // screenY(worldY) < H/2  => policial aparece apenas na metade superior.
    return cameraY + (H/2 - 110) + 26;
  }

  function difficultyConfig(){
    return {
      easy: {
        npcMultiplier:.80,
        copMultiplier:1,
        autoScroll:0,
        allowBottomTouch:true,
        constantPursuit:false
      },
      medium: {
        npcMultiplier:1,
        copMultiplier:1,
        autoScroll:0,
        allowBottomTouch:true,
        constantPursuit:false
      },
      hard: {
        npcMultiplier:1,
        copMultiplier:1,
        autoScroll:40,
        allowBottomTouch:false,
        constantPursuit:false
      },
      pro: {
        npcMultiplier:1,
        copMultiplier:1.10,
        autoScroll:40,
        allowBottomTouch:false,
        constantPursuit:false
      },
      impossible: {
        npcMultiplier:1,
        copMultiplier:1.10,
        autoScroll:40,
        allowBottomTouch:false,
        constantPursuit:true
      }
    }[difficulty];
  }

  function difficultyDescription(value){
    return {
      easy:"20% menos NPCs em tela.",
      medium:"Como está agora, mas você pode encostar no canto inferior da tela sem a câmera recuar.",
      hard:"Como o Médio, porém a tela sobe automaticamente devagar. Sem pausa.",
      pro:"Como o Difícil, com 10% mais policiais em tela. Sem pausa.",
      impossible:"Como o Pro, mas a perseguição é permanente. Sem pausa. O objetivo é sobreviver o máximo possível."
    }[value];
  }

  function allowsPause(){
    return difficulty !== "hard" && difficulty !== "pro" && difficulty !== "impossible";
  }

  function pursuitEscapeTarget(){
    if(difficulty==="hard" || difficulty==="pro") return 4;
    if(difficulty==="impossible") return Infinity;
    return 3;
  }

  function nearestOnScreenCop(){
    let best = null;
    let bestDistance = Infinity;

    for(const cop of cops){
      const sy = screenY(cop.y);
      if(sy < 20 || sy > H - 20) continue;

      const d = dist(cop.x,cop.y,player.x,player.y);
      if(d < bestDistance){
        bestDistance = d;
        best = cop;
      }
    }

    return best;
  }


  function setPaused(value){
    if(!started || gameOver) return;
    if(value && !allowsPause()) return;
    paused = !!value;
    keys.clear();
    input.active = false;
    input.x = input.y = 0;
  }
  function togglePause(){ setPaused(!paused); }

  function clearPursuit({countEscape = false, natural = false} = {}){
    const wasAlert = alert;
    alert=false;
    suspicion=0;
    pursuitEscapeTimer=0;
    pursuitGraceTimer=0;
    mainPursuer=null;

    for(const cop of cops){
      cop.chase=false;
      cop.seeingPlayer=false;
      cop.recognizing=false;
      cop.suspicionLock=0;
      cop.turn=rand(.7,1.7);
    }

    for(const camera of cameras){
      camera.seeingPlayer=false;
    }

    if(countEscape && wasAlert) noteEscape(natural);
  }

  function findTeleportDestination(distance=320){
    const targetY=player.y+distance;
    const candidates=[
      [player.x,targetY],
      [W*.5,targetY],
      [player.x-80,targetY],
      [player.x+80,targetY],
      [W*.28,targetY+34],
      [W*.72,targetY+34],
      [W*.5,targetY+70]
    ];

    for(const [rawX,y] of candidates){
      const x=clamp(rawX,20,W-20);
      const probe={x,y,r:player.r+3};

      const hitsObstacle=obstacles.some(o =>
        Math.abs((o.y+o.h/2)-y)<70 && circleIntersectsRect(probe,o)
      );
      const hitsCop=cops.some(c => dist(c.x,c.y,x,y)<c.r+player.r+12);
      const hitsNpc=npcs.some(n => dist(n.x,n.y,x,y)<n.r+player.r+6);

      if(!hitsObstacle && !hitsCop && !hitsNpc) return {x,y};
    }

    return {x:W/2,y:targetY+90};
  }

  function activateShield(){
    const radius=150;
    shieldPulseTimer=.45;
    let hitCop=false;

    const repel=(entity,extraPush=0)=>{
      let dx=entity.x-player.x;
      let dy=entity.y-player.y;
      let d=Math.hypot(dx,dy);
      if(d>radius) return;
      if(d<.001){ dx=1;dy=0;d=1; }

      const push=58 + (1-d/radius)*48 + extraPush;
      entity.x=clamp(entity.x+(dx/d)*push,16,W-16);
      entity.y+=(dy/d)*push;
      entity.stunTimer=1;

      for(const o of obstacles){
        if(Math.abs((o.y+o.h/2)-entity.y)>70) continue;
        resolveCircleRect(entity,o,1);
      }
    };

    for(const npc of npcs) repel(npc);
    for(const cop of cops){
      if(dist(cop.x,cop.y,player.x,player.y)<=radius) hitCop=true;
      repel(cop,12);
    }
    if(hitCop) runStats.usedShieldNearCop=true;
  }

  function usePowerUp(slotIndex){
    if(!started || gameOver || paused) return;
    const type=inventory[slotIndex];
    if(!type) return;

    runStats.itemsUsed += 1;
    rememberType(runStats.usedTypes, type);
    if(alert){
      runAlertItemsUsed += 1;
      runStats.itemsUsedInAlert = Math.max(runStats.itemsUsedInAlert, runAlertItemsUsed);
    }

    if(type==="escape"){
      runStats.usedEscapeItem=true;
      clearPursuit({countEscape:true, natural:false});
      escapeImmunityTimer=3;
      // No Impossível, a perseguição volta somente quando a imunidade acabar.
      impossiblePursuitStarted=false;
    }else if(type==="soap"){
      soapTimer=5;
      if(alert) runSoapInAlert=true;
    }else if(type==="skates"){
      skatesTimer=10;
      runStats.usedSkates=true;
    }else if(type==="staff"){
      staffTimer=5;
      runStats.usedStaff=true;
    }else if(type==="invis"){
      invisibilityTimer=10;
      if(alert) runStats.usedCloakInAlert=true;
    }else if(type==="teleport"){
      if(bustedTimer > 0) runStats.usedTeleportInBusted=true;
      const dest=findTeleportDestination(320);
      player.x=dest.x;
      player.y=dest.y;
      cameraY=Math.max(cameraY,player.y-H*.47);
      spawnIndicator=Math.max(spawnIndicator,.7);
      ensureWorld();
    }else if(type==="shield"){
      activateShield();
    }else if(type==="time"){
      timeFreezeTimer=10;
      runStats.usedTime=true;
    }

    inventory.splice(slotIndex,1);
    onPowerUse(type);

  }

  function canCopSeePlayer(cop){
    if(escapeImmunityTimer>0 || invisibilityTimer>0) return false;
    return pointInCone(cop,player.x,player.y);
  }

  function spawnPowerUp(startY,chunkH){
    const type=nextPowerType();

    for(let attempt=0;attempt<18;attempt++){
      const x=rand(30,W-30);
      const y=startY+rand(42,chunkH-42);

      // Evita dois power-ups praticamente empilhados no eixo vertical.
      if(Math.abs(y-lastPowerSpawnY)<115) continue;
      if(isInsidePlayerSpawnSafeZone(x,y,65)) continue;

      const probe={x,y,r:16};
      if(obstacles.some(o => Math.abs((o.y+o.h/2)-y)<60 && circleIntersectsRect(probe,o))) continue;
      if(cops.some(c => dist(c.x,c.y,x,y)<48)) continue;
      if(npcs.some(n => dist(n.x,n.y,x,y)<36)) continue;
      if(powerUps.some(p => dist(p.x,p.y,x,y)<95)) continue;

      powerUps.push({
        x,y,type,r:16,
        phase:rand(0,Math.PI*2)
      });

      lastPowerSpawnY=y;
      return true;
    }

    // Se não conseguiu posicionar, devolve o tipo para o início da fila
    // para preservar a variedade do ciclo.
    powerBag.unshift(type);
    lastPowerType = null;
    return false;
  }

  function turnTowardAngle(current, target, maxStep){
    let diff = Math.atan2(Math.sin(target-current), Math.cos(target-current));
    diff = clamp(diff, -maxStep, maxStep);
    return current + diff;
  }

  function reset(){
    elapsed = 0;
    distanceTravelledUnits = 0;
    screenDistanceTravelledUnits = 0;
    lastMeasuredCameraY = 0;
    suspicion = 0;
    alert = false;
    gameOver = false;
    spawnIndicator = 2.6;
    pursuitEscapeTimer = 0;
    pursuitGraceTimer = 0;
    mainPursuer = null;
    bustedTimer = 0;
    playerIdleTimer = 0;
    idleHunterCop = null;
    impossiblePursuitStarted = false;
    escapeImmunityTimer = 0;
    soapTimer = 0;
    skatesTimer = 0;
    staffTimer = 0;
    invisibilityTimer = 0;
    shieldPulseTimer = 0;
    timeFreezeTimer = 0;
    cameraAnimTime = 0;
    powerPickupFlash = 0;
    powerPickupCooldown = 0;
    inventory.length = 0;
    powerUps.length = 0;
    powerBag = [];
    chunksSincePowerUp = 0;
    lastPowerType = null;
    lastPowerSpawnY = -Infinity;
    cameraY = 0;
    lastMeasuredCameraY = cameraY;
    generatedUntil = -100;
    npcs.length = 0;
    cops.length = 0;
    cameras.length = 0;
    decor.length = 0;
    obstacles.length = 0;
    runStats = createEmptyRunStats();
    runLastDir = null;
    runDirsInEscape = new Set();
    runAlertItemsUsed = 0;
    runMaxBustedInAlert = 0;
    runSoapInAlert = false;

    player.x = W/2;
    player.y = 40;
    player.vx = player.vy = 0;

    ensureWorld();

    // Garantia final de spawn seguro.
    // Remove/reposiciona qualquer entidade que tenha caído perto demais do player.
    for(let i=obstacles.length-1;i>=0;i--){
      const o=obstacles[i];
      if(rectTouchesPlayerSpawnSafeZone(o.x,o.y,o.w,o.h,10)){
        obstacles.splice(i,1);
      }
    }

    for(let i=npcs.length-1;i>=0;i--){
      const npc=npcs[i];
      if(isInsidePlayerSpawnSafeZone(npc.x,npc.y,12)){
        npcs.splice(i,1);
      }
    }

    const minPoliceY = initialPoliceMinWorldY();
    for(const cop of cops){
      if(screenY(cop.y) > H/2){
        cop.y = minPoliceY + rand(0,100);
      }
    }


    reason = null;
  }

  function start(mode = difficulty){
    if(!["easy","medium","hard","pro","impossible"].includes(mode)) throw new Error("Dificuldade inválida");
    difficulty = mode;
    reset();
    started = true;
    paused = false;
    keys.clear();
    input.active = false;
    input.x = input.y = 0;

    if(difficultyConfig().constantPursuit){
      alert = true;
      suspicion = 100;
      pursuitGraceTimer = 0;
      pursuitEscapeTimer = 0;
      impossiblePursuitStarted = true;
      mainPursuer = nearestOnScreenCop();
      for(const cop of cops) cop.chase = true;
      runStats.alertEver = true;
    }
  }

  function end(cause){
    if(gameOver) return;
    reason = cause;
    gameOver = true;
    started = false;
    paused = false;
    input.active = false;
    input.x = input.y = 0;
    if(elapsed > best){
      best = elapsed;
      onBest(best);
    }
  }

  /** 1 SQM = uma célula da grid de mundo (calçada / NPCs / obstáculos). */
  const SQM = 32;
  const NPC_GRID = SQM;
  const MAX_NPCS_PER_ROW = 3;
  const MAX_NPCS_PER_COL = 6;
  const MAX_ON_SCREEN_ACTORS = 24; // civis + policiais
  const MAX_ON_SCREEN_CAMERAS = 3;
  const MAX_LIVE_NPCS = 64;
  const NPC_MIN_SEPARATION = 24; // ~2*r + folga; evita empilhar corpos
  const crowdCellBuckets = new Map();
  const crowdNeighborBuf = [];

  function crowdCellKey(col, row){
    return (row + 1048576) * 4096 + (col + 1024);
  }

  function isWorldYOnScreen(worldY, margin=40){
    const sy = screenY(worldY);
    return sy >= -margin && sy <= H + margin;
  }

  function actorsNearY(worldY){
    // Janela ~altura da tela: quem compartilharia a viewport com este Y.
    const half = H * .5 + 80;
    let n = 0;
    for(const npc of npcs){
      if(Math.abs(npc.y - worldY) <= half) n++;
    }
    for(const cop of cops){
      if(Math.abs(cop.y - worldY) <= half) n++;
    }
    return n;
  }

  function camerasNearY(worldY){
    const half = H * .5 + 80;
    let n = 0;
    for(const camera of cameras){
      if(Math.abs(camera.y - worldY) <= half) n++;
    }
    return n;
  }

  function canSpawnActorAt(y){
    return actorsNearY(y) < MAX_ON_SCREEN_ACTORS;
  }

  function canSpawnCameraAt(y){
    return camerasNearY(y) < MAX_ON_SCREEN_CAMERAS;
  }

  function enforceOnScreenActorLimit(){
    const visible = [];
    for(const npc of npcs){
      if(isWorldYOnScreen(npc.y)) visible.push({ kind:"npc", ref:npc });
    }
    for(const cop of cops){
      if(isWorldYOnScreen(cop.y, 50)) visible.push({ kind:"cop", ref:cop });
    }
    const excess = visible.length - MAX_ON_SCREEN_ACTORS;
    if(excess <= 0) return;

    // Remove civis mais longe do player primeiro; não remove policiais.
    const civilians = visible
      .filter(e => e.kind === "npc")
      .sort((a,b) =>
        dist(b.ref.x,b.ref.y,player.x,player.y) - dist(a.ref.x,a.ref.y,player.x,player.y)
      );

    let removed = 0;
    for(const entry of civilians){
      if(removed >= excess) break;
      const idx = npcs.indexOf(entry.ref);
      if(idx >= 0){
        npcs.splice(idx,1);
        removed++;
      }
    }
  }

  function enforceOnScreenCameraLimit(){
    const visible = [];
    for(const camera of cameras){
      if(isWorldYOnScreen(camera.y, 50)) visible.push(camera);
    }
    const excess = visible.length - MAX_ON_SCREEN_CAMERAS;
    if(excess <= 0) return;

    visible.sort((a,b) =>
      dist(b.x,b.y,player.x,player.y) - dist(a.x,a.y,player.x,player.y)
    );

    for(let i=0;i<excess;i++){
      const idx = cameras.indexOf(visible[i]);
      if(idx >= 0) cameras.splice(idx,1);
    }
  }

  function npcGridCell(x,y){
    return {
      row: Math.floor(y / NPC_GRID),
      col: Math.floor(x / NPC_GRID)
    };
  }

  function isNpcGridCellTaken(row,col){
    for(const npc of npcs){
      const cell = npcGridCell(npc.x,npc.y);
      if(cell.row === row && cell.col === col) return true;
    }
    return false;
  }

  function isTooCloseToCrowd(x,y,minDist=NPC_MIN_SEPARATION){
    for(const npc of npcs){
      if(dist(npc.x,npc.y,x,y) < minDist) return true;
    }
    for(const cop of cops){
      if(dist(cop.x,cop.y,x,y) < minDist + 4) return true;
    }
    return false;
  }

  function npcGridOccupancy(preferredY){
    const rows = new Map();
    const cols = new Map();
    // Colunas: só conta NPCs na janela da tela, senão faixas antigas
    // “entopem” e abrem corredores vazios nos chunks novos.
    const colWindow = H;
    for(const npc of npcs){
      const cell = npcGridCell(npc.x,npc.y);
      rows.set(cell.row, (rows.get(cell.row) || 0) + 1);
      if(Math.abs(npc.y - preferredY) <= colWindow){
        cols.set(cell.col, (cols.get(cell.col) || 0) + 1);
      }
    }
    return { rows, cols };
  }

  function canPlaceNpcAtCell(row,col,occupancy){
    if(isNpcGridCellTaken(row,col)) return false;
    return (occupancy.rows.get(row) || 0) < MAX_NPCS_PER_ROW
      && (occupancy.cols.get(col) || 0) < MAX_NPCS_PER_COL;
  }

  function pickNpcGridPlacement(preferredY){
    const occupancy = npcGridOccupancy(preferredY);
    const minCol = Math.floor(24 / NPC_GRID);
    const maxCol = Math.floor((W - 24) / NPC_GRID);
    const baseRow = Math.floor(preferredY / NPC_GRID);

    // Prioriza linhas perto do Y pedido; depois abre o leque para preencher buracos.
    const rowOrder = [];
    const maxRowSpan = 6;
    for(let span=0; span<=maxRowSpan; span++){
      for(const row of (span === 0 ? [baseRow] : [baseRow - span, baseRow + span])){
        if(row < 0) continue;
        if(!rowOrder.includes(row)) rowOrder.push(row);
      }
    }

    let best = null;
    let bestScore = Infinity;

    for(const row of rowOrder){
      const rowCount = occupancy.rows.get(row) || 0;
      if(rowCount >= MAX_NPCS_PER_ROW) continue;

      for(let col=minCol; col<=maxCol; col++){
        if(!canPlaceNpcAtCell(row,col,occupancy)) continue;

        // Centro da célula, sem jitter — evita dois NPCs grudarem na borda.
        const x = clamp(col * NPC_GRID + NPC_GRID * .5, 24, W-24);
        const spawnY = row * NPC_GRID + NPC_GRID * .5;
        if(isInsidePlayerSpawnSafeZone(x,spawnY,12)) continue;
        if(isTooCloseToCrowd(x,spawnY)) continue;

        // Prefere células em linhas/colunas mais vazias e próximas do Y alvo.
        const colCount = occupancy.cols.get(col) || 0;
        const score = rowCount * 4 + colCount * 3 + Math.abs(row - baseRow) * 2 + random() * .5;
        if(score < bestScore){
          bestScore = score;
          best = { x, y: spawnY };
        }
      }
    }

    return best;
  }

  function separateOverlappingCrowd(){
    // Spatial hash on NPC_GRID: only test neighbors in adjacent cells, in
    // ascending (i,j) order (same resolution order as a nested scan).
    for(const bucket of crowdCellBuckets.values()) bucket.length = 0;
    crowdCellBuckets.clear();
    const startCol = [];
    const startRow = [];
    for(let i=0;i<npcs.length;i++){
      const npc = npcs[i];
      const col = Math.floor(npc.x / NPC_GRID);
      const row = Math.floor(npc.y / NPC_GRID);
      startCol[i] = col;
      startRow[i] = row;
      const key = crowdCellKey(col, row);
      let bucket = crowdCellBuckets.get(key);
      if(!bucket){
        bucket = [];
        crowdCellBuckets.set(key, bucket);
      }
      bucket.push(i);
    }

    for(let i=0;i<npcs.length;i++){
      const a = npcs[i];
      crowdNeighborBuf.length = 0;
      for(let dr=-1;dr<=1;dr++){
        for(let dc=-1;dc<=1;dc++){
          const bucket = crowdCellBuckets.get(crowdCellKey(startCol[i] + dc, startRow[i] + dr));
          if(!bucket) continue;
          for(let k=0;k<bucket.length;k++){
            const j = bucket[k];
            if(j > i) crowdNeighborBuf.push(j);
          }
        }
      }
      crowdNeighborBuf.sort((x, y) => x - y);
      let prev = -1;
      for(let n=0;n<crowdNeighborBuf.length;n++){
        const j = crowdNeighborBuf[n];
        if(j === prev) continue;
        prev = j;
        const b = npcs[j];
        if(Math.abs(a.y - b.y) > NPC_MIN_SEPARATION + 4) continue;

        let d = dist(a.x,a.y,b.x,b.y);
        const minD = NPC_MIN_SEPARATION;
        if(d >= minD) continue;

        if(d < .001){
          const angle = rand(0, Math.PI * 2);
          a.x = clamp(a.x + Math.cos(angle) * 8, 16, W-16);
          a.y += Math.sin(angle) * 8;
          d = dist(a.x,a.y,b.x,b.y);
          if(d < .001) continue;
        }

        const push = (minD - d) * .5;
        const nx = (a.x - b.x) / d;
        const ny = (a.y - b.y) / d;
        a.x = clamp(a.x + nx * push, 16, W-16);
        a.y += ny * push;
        b.x = clamp(b.x - nx * push, 16, W-16);
        b.y -= ny * push;

        const spA = clamp(Math.hypot(a.vx,a.vy) || 28, 22, 50);
        const spB = clamp(Math.hypot(b.vx,b.vy) || 28, 22, 50);
        if(a.axis === "h"){
          a.axis = "v";
          a.vx = 0;
          a.vy = (random() < .5 ? -1 : 1) * spA;
        }else{
          a.axis = "h";
          a.vy = 0;
          a.vx = (random() < .5 ? -1 : 1) * spA;
        }
        if(b.axis === "h"){
          b.axis = "v";
          b.vx = 0;
          b.vy = (random() < .5 ? -1 : 1) * spB;
        }else{
          b.axis = "h";
          b.vy = 0;
          b.vx = (random() < .5 ? -1 : 1) * spB;
        }
        a.turn = Math.min(a.turn, rand(.4,.9));
        b.turn = Math.min(b.turn, rand(.4,.9));
      }

      for(const cop of cops){
        if(Math.abs(a.y - cop.y) > NPC_MIN_SEPARATION + 8) continue;
        let d = dist(a.x,a.y,cop.x,cop.y);
        const minD = NPC_MIN_SEPARATION + 4;
        if(d >= minD) continue;

        if(d < .001){
          a.x = clamp(a.x + rand(-10,10), 16, W-16);
          a.y += rand(-10,10);
          d = dist(a.x,a.y,cop.x,cop.y);
          if(d < .001) continue;
        }

        const push = minD - d;
        const nx = (a.x - cop.x) / d;
        const ny = (a.y - cop.y) / d;
        a.x = clamp(a.x + nx * push, 16, W-16);
        a.y += ny * push;
      }
    }
  }

  function spawnNPC(y){
    if(!canSpawnActorAt(y)) return;

    const horizontal = random() < .5;
    const sign = random() < .5 ? -1 : 1;
    const speed = rand(24,48);

    const placement = pickNpcGridPlacement(y);
    if(!placement) return;
    if(!canSpawnActorAt(placement.y)) return;
    if(npcs.length >= MAX_LIVE_NPCS) return;

    npcs.push({
      x: placement.x, y: placement.y,
      vx: horizontal ? sign*speed : 0,
      vy: horizontal ? 0 : sign*speed,
      axis: horizontal ? "h" : "v",
      r:8, phase:rand(0,10),
      tone: Math.floor(rand(0,5)),
      stunTimer:0,
      turn: rand(1.2,3.2)
    });
  }

  function spawnCop(y){
    if(!canSpawnActorAt(y)) return;

    const horizontal = random() < .5;
    const sign = random() < .5 ? -1 : 1;
    const s = rand(34,52);

    let spawnY = y;

    // No início da partida, policiais só podem aparecer na metade superior da tela.
    if(elapsed < 1.0 && cameraY < 10){
      spawnY = Math.max(spawnY, initialPoliceMinWorldY() + rand(0,90));
    }

    if(!canSpawnActorAt(spawnY)) return;

    let x = rand(34,W-34);
    let placed = false;
    for(let attempt=0; attempt<16; attempt++){
      x = rand(34,W-34);
      if(isTooCloseToCrowd(x,spawnY,NPC_MIN_SEPARATION + 4)) continue;
      placed = true;
      break;
    }
    if(!placed) return;

    cops.push({
      x, y:spawnY,
      vx: horizontal ? sign*s : 0,
      vy: horizontal ? 0 : sign*s,
      axis: horizontal ? "h" : "v",
      r:12,
      dangerRadius:24,
      face: horizontal
        ? (sign < 0 ? Math.PI : 0)
        : (sign < 0 ? -Math.PI/2 : Math.PI/2),
      vision: rand(112,152),
      fov: Math.PI/3.1,
      chase:false,
      seeingPlayer:false,
      recognizing:false,
      hasBeenOnScreen:false,
      suspicionLock:0,
      avoidTimer:0,
      stunTimer:0,
      turn:rand(1.6,3.4)
    });
  }

  function cameraFaces(camera){
    if(camera.mode==="fixed2"){
      return [camera.face, camera.face + Math.PI];
    }

    if(camera.mode==="sweep"){
      const sweep = Math.sin(cameraAnimTime*camera.sweepSpeed + camera.phase) * (Math.PI/2);
      return [camera.baseFace + sweep];
    }

    return [camera.face];
  }

  function pointInCameraVision(camera, px, py){
    if(escapeImmunityTimer>0 || invisibilityTimer>0) return false;

    const dx=px-camera.x;
    const dy=py-camera.y;
    const d=Math.hypot(dx,dy);
    if(d>camera.vision || d<.001) return false;

    const targetAngle=Math.atan2(dy,dx);

    for(const face of cameraFaces(camera)){
      const da=Math.atan2(
        Math.sin(targetAngle-face),
        Math.cos(targetAngle-face)
      );

      if(Math.abs(da)<=camera.fov/2) return true;
    }

    return false;
  }

  function spawnCamera(startY,chunkH){
    if(!canSpawnCameraAt(startY + chunkH * .5)) return;

    const roll=random();
    let mode;

    if(roll<.34) mode="fixed1";
    else if(roll<.56) mode="fixed2";
    else if(roll<.80) mode="sweep";
    else mode="rotate";

    const cardinal=[
      0,
      Math.PI/2,
      Math.PI,
      -Math.PI/2
    ];

    for(let attempt=0;attempt<16;attempt++){
      const x=rand(30,W-30);
      const y=startY+rand(38,chunkH-38);

      if(!canSpawnCameraAt(y)) continue;
      if(isInsidePlayerSpawnSafeZone(x,y,72)) continue;

      const probe={x,y,r:16};
      if(obstacles.some(o =>
        Math.abs((o.y+o.h/2)-y)<60 && circleIntersectsRect(probe,o)
      )) continue;
      if(cops.some(c=>dist(c.x,c.y,x,y)<50)) continue;
      if(cameras.some(c=>dist(c.x,c.y,x,y)<105)) continue;
      if(powerUps.some(p=>dist(p.x,p.y,x,y)<38)) continue;

      let face=cardinal[Math.floor(random()*cardinal.length)];
      let baseFace=face;

      if(mode==="fixed2"){
        // Somente horizontal ou vertical.
        face=random()<.5 ? 0 : Math.PI/2;
        baseFace=face;
      }else if(mode==="rotate"){
        // Direção de giro e velocidade são sorteadas UMA vez no spawn
        // e nunca mudam durante a vida desta câmera.
        face=rand(-Math.PI,Math.PI);
        baseFace=face;
      }

      cameras.push({
        x,y,
        r:8,
        mode,
        face,
        baseFace,
        vision:rand(120,160),
        fov:Math.PI/3.1,
        phase:rand(0,Math.PI*2),
        sweepSpeed:rand(.65,1.05),
        rotationDir:random()<.5 ? -1 : 1,
        rotationSpeed:rand(.55,.9),
        seeingPlayer:false,
        spottedPlayer:false,
        everOnScreen:false
      });

      return;
    }
  }

  function overlapsObstacleArea(x,y,w,h,pad=8){
    return obstacles.some(o =>
      x < o.x + o.w + pad &&
      x + w > o.x - pad &&
      y < o.y + o.h + pad &&
      y + h > o.y - pad
    );
  }

  function spawnObstacle(startY, chunkH){
    // Hitbox = N×M SQMs; posição sempre no canto inferior-esquerdo da célula.
    const types = [
      {type:"bench", sqmW:2, sqmH:1},
      {type:"trash", sqmW:1, sqmH:1},
      {type:"planter", sqmW:1, sqmH:1},
      {type:"barrier", sqmW:2, sqmH:1},
      {type:"crate", sqmW:1, sqmH:1}
    ];

    const edgePad = SQM;

    for(let attempt=0; attempt<12; attempt++){
      const spec = types[Math.floor(random()*types.length)];
      const w = spec.sqmW * SQM;
      const h = spec.sqmH * SQM;

      const minX = edgePad;
      const maxX = Math.floor((W - edgePad - w) / SQM) * SQM;
      if(maxX < minX) continue;

      const minY = Math.ceil((startY + SQM) / SQM) * SQM;
      const maxY = Math.floor((startY + chunkH - h - SQM) / SQM) * SQM;
      if(maxY < minY) continue;

      const xSteps = Math.floor((maxX - minX) / SQM);
      const ySteps = Math.floor((maxY - minY) / SQM);
      const x = minX + Math.floor(random() * (xSteps + 1)) * SQM;
      const y = minY + Math.floor(random() * (ySteps + 1)) * SQM;

      // Nunca gera obstáculos no ponto de spawn do jogador.
      if(rectTouchesPlayerSpawnSafeZone(x,y,w,h,10)) continue;

      // Evita empilhar obstáculos (folga ~½ SQM entre caixas).
      if(overlapsObstacleArea(x,y,w,h, SQM * .5)) continue;

      obstacles.push({
        x, y,
        w, h,
        type: spec.type
      });
      return;
    }
  }

  function circleIntersectsRect(entity, obstacle){
    const nearestX = clamp(entity.x, obstacle.x, obstacle.x + obstacle.w);
    const nearestY = clamp(entity.y, obstacle.y, obstacle.y + obstacle.h);
    const dx = entity.x - nearestX;
    const dy = entity.y - nearestY;
    return (dx*dx + dy*dy) < entity.r*entity.r;
  }

  function circlesOverlap(ax,ay,ar,bx,by,br){
    const dx=ax-bx;
    const dy=ay-by;
    const rr=ar+br;
    return dx*dx + dy*dy < rr*rr;
  }

  // Player vs civis: barreiras sólidas (ignoradas com Sabonete).
  // Bloqueia só se ainda há overlap e o passo não está afastando.
  function playerOverlapsBlockingNpc(px, py, fromX, fromY){
    if(soapTimer>0) return false;
    for(const npc of npcs){
      if(Math.abs(npc.y-py)>32 && Math.abs(npc.y-fromY)>32) continue;
      if(!circlesOverlap(px,py,player.r,npc.x,npc.y,npc.r)) continue;
      const previousDistance = dist(npc.x,npc.y,fromX,fromY);
      const candidateDistance = dist(npc.x,npc.y,px,py);
      if(candidateDistance > previousDistance + 0.001) continue;
      return true;
    }
    return false;
  }

  // Corpo do policial (hitbox física; dangerRadius é só BUSTED).
  function playerOverlapsCopBody(px, py, fromX, fromY){
    for(const cop of cops){
      if(Math.abs(cop.y-py)>40 && Math.abs(cop.y-fromY)>40) continue;
      const bodyRadius = cop.r + 4;
      if(!circlesOverlap(px,py,player.r,cop.x,cop.y,bodyRadius)) continue;
      const previousDistance = dist(cop.x,cop.y,fromX,fromY);
      const candidateDistance = dist(cop.x,cop.y,px,py);
      if(candidateDistance > previousDistance + 0.001) continue;
      return true;
    }
    return false;
  }

  function playerHitsObstacleAt(px, py){
    const probe = { x:px, y:py, r:player.r };
    for(const o of obstacles){
      if(Math.abs((o.y+o.h/2)-py) > 70) continue;
      if(circleIntersectsRect(probe,o)) return true;
    }
    return false;
  }

  function resolveCircleRect(entity, obstacle, softness=1){
    const nearestX = clamp(entity.x, obstacle.x, obstacle.x + obstacle.w);
    const nearestY = clamp(entity.y, obstacle.y, obstacle.y + obstacle.h);
    let dx = entity.x - nearestX;
    let dy = entity.y - nearestY;
    let d = Math.hypot(dx,dy);

    if(d >= entity.r) return false;

    if(d < 0.001){
      const left = Math.abs(entity.x - obstacle.x);
      const right = Math.abs(entity.x - (obstacle.x + obstacle.w));
      const bottom = Math.abs(entity.y - obstacle.y);
      const top = Math.abs(entity.y - (obstacle.y + obstacle.h));
      const m = Math.min(left,right,bottom,top);

      if(m===left){ dx=-1; dy=0; d=1; }
      else if(m===right){ dx=1; dy=0; d=1; }
      else if(m===bottom){ dx=0; dy=-1; d=1; }
      else { dx=0; dy=1; d=1; }
    }

    const push = (entity.r - d) * softness;
    entity.x += dx/d * push;
    entity.y += dy/d * push;
    return true;
  }

  function copPathBlocked(cop, vx, vy, lookAhead=.42){
    const probe = {
      x: cop.x + vx*lookAhead,
      y: cop.y + vy*lookAhead,
      r: cop.r
    };

    return obstacles.some(o => {
      if(Math.abs((o.y+o.h/2)-probe.y) > 80) return false;
      return circleIntersectsRect(probe,o);
    });
  }

  function startCopDetour(cop, targetX, targetY, speed){
    const currentHorizontal = Math.abs(cop.vx) > Math.abs(cop.vy);
    const candidates = [];

    if(currentHorizontal){
      const preferred = Math.sign(targetY-cop.y) || 1;
      candidates.push([0, preferred*speed], [0, -preferred*speed]);
    }else{
      const preferred = Math.sign(targetX-cop.x) || 1;
      candidates.push([preferred*speed, 0], [-preferred*speed, 0]);
    }

    // Escolhe um caminho perpendicular que não bata imediatamente
    // em outro obstáculo.
    for(const [vx,vy] of candidates){
      if(!copPathBlocked(cop,vx,vy)){
        cop.vx=vx;
        cop.vy=vy;
        cop.axis = vx !== 0 ? "h" : "v";
        cop.avoidTimer=.72;
        return;
      }
    }

    // Se os dois lados estiverem fechados, recua pelo próprio eixo
    // por um instante para sair do canto antes de recalcular.
    if(currentHorizontal){
      const sign = Math.sign(cop.vx) || 1;
      cop.vx=-sign*speed;
      cop.vy=0;
      cop.axis="h";
    }else{
      const sign = Math.sign(cop.vy) || 1;
      cop.vx=0;
      cop.vy=-sign*speed;
      cop.axis="v";
    }
    cop.avoidTimer=.5;
  }

  function generateChunk(startY){
    const chunkH = 192;
    const cfg = difficultyConfig();
    const npcCount = Math.max(1, Math.floor(rand(8,12) * cfg.npcMultiplier));
    let copCount = random() < .28 ? 2 : 1;

    if(cfg.copMultiplier > 1){
      const baseCopCount = copCount;
      const extraChance = (cfg.copMultiplier - 1) * baseCopCount;
      if(random() < extraChance) copCount += 1;
    }

    const obstacleCount = Math.floor(rand(2,5));
    for(let i=0;i<obstacleCount;i++) spawnObstacle(startY,chunkH);

    for(let i=0;i<npcCount;i++) spawnNPC(startY + rand(15,chunkH-15));
    for(let i=0;i<copCount;i++) spawnCop(startY + rand(40,chunkH-40));

    // Vigilância fixa: normalmente 0–1 câmera por chunk.
    // Uma segunda câmera é rara para não transformar o mapa em uma parede de cones.
    if(random()<.46) spawnCamera(startY,chunkH);
    if(random()<.07) spawnCamera(startY,chunkH);

    // Distribuição mais previsível:
    // - nunca deixa passar mais de 2 chunks sem power-up;
    // - evita excesso de itens em sequência;
    // - ainda mantém uma pequena aleatoriedade no ritmo.
    chunksSincePowerUp++;

    const mustSpawn = chunksSincePowerUp >= 2;
    const maySpawn = chunksSincePowerUp >= 1 && random() < .58;

    if(mustSpawn || maySpawn){
      if(spawnPowerUp(startY,chunkH)){
        chunksSincePowerUp=0;
      }
    }

    for(let i=0;i<5;i++){
      decor.push({
        x:rand(10,W-10),
        y:startY+rand(0,chunkH),
        type:random()<.5?"paper":"drain"
      });
    }

    generatedUntil = startY + chunkH;
  }

  function ensureWorld(){
    const target = cameraY + H + W;
    while(generatedUntil < target){
      generateChunk(generatedUntil);
    }
  }

  function screenY(worldY){
    return H - 110 - (worldY - cameraY);
  }

  function inputVector(){
    let x=0, y=0;
    if(keys.has("ArrowLeft")||keys.has("KeyA")) x-=1;
    if(keys.has("ArrowRight")||keys.has("KeyD")) x+=1;
    if(keys.has("ArrowUp")||keys.has("KeyW")) y+=1;
    if(keys.has("ArrowDown")||keys.has("KeyS")) y-=1;

    if(input.active){
      x += input.x;
      y += -input.y;
    }

    // Movimento em 4 direções: escolhe sempre o eixo dominante.
    if(Math.abs(x) > Math.abs(y)){
      return {x: Math.sign(x), y: 0};
    }
    if(Math.abs(y) > 0){
      return {x: 0, y: Math.sign(y)};
    }
    return {x: 0, y: 0};
  }

  function crowdDensity(){
    let n=0;
    for(const npc of npcs){
      if(Math.abs(npc.y-player.y)>52) continue;
      if(dist(npc.x,npc.y,player.x,player.y)<44) n++;
    }
    return n;
  }

  function effectiveDangerRadius(cop){
    return alert ? cop.dangerRadius + 16 : cop.dangerRadius;
  }

  function effectiveFov(cop){
    // Durante a perseguição, mantém o mesmo ângulo da lanterna normal.
    return cop.fov;
  }

  function pointInCone(cop, px, py){
    const dx = px-cop.x;
    const dy = py-cop.y;
    const d = Math.hypot(dx,dy);
    if(d > cop.vision || d < 0.001) return false;
    const a = Math.atan2(dy,dx);
    let da = Math.atan2(Math.sin(a-cop.face),Math.cos(a-cop.face));
    return Math.abs(da) <= effectiveFov(cop)/2;
  }

  function update(dt){
    if(!started || gameOver || paused) return;

    elapsed += dt;
    spawnIndicator = Math.max(0, spawnIndicator - dt);

    escapeImmunityTimer=Math.max(0,escapeImmunityTimer-dt);
    soapTimer=Math.max(0,soapTimer-dt);
    skatesTimer=Math.max(0,skatesTimer-dt);
    staffTimer=Math.max(0,staffTimer-dt);
    invisibilityTimer=Math.max(0,invisibilityTimer-dt);
    shieldPulseTimer=Math.max(0,shieldPulseTimer-dt);
    timeFreezeTimer=Math.max(0,timeFreezeTimer-dt);
    if(timeFreezeTimer<=0) cameraAnimTime += dt;
    powerPickupFlash=Math.max(0,powerPickupFlash-dt);
    powerPickupCooldown=Math.max(0,powerPickupCooldown-dt);

    const v = inputVector();
    const density = crowdDensity();

    const isPlayerTryingToMove = Math.abs(v.x) > 0 || Math.abs(v.y) > 0;
    let dirKey = null;
    if(Math.abs(v.x) > Math.abs(v.y) && Math.abs(v.x) > 0) dirKey = v.x > 0 ? "r" : "l";
    else if(Math.abs(v.y) > 0) dirKey = v.y > 0 ? "u" : "d";
    if(dirKey){
      if(runLastDir && runLastDir !== dirKey) runStats.directionChanges += 1;
      runLastDir = dirKey;
      if(alert) runDirsInEscape.add(dirKey);
    }

    if(isPlayerTryingToMove){
      playerIdleTimer = 0;
      if(idleHunterCop){
        idleHunterCop.avoidTimer = 0;
        if(runStats.antiCamp) runStats.antiCampSurvived = true;
      }
      idleHunterCop = null;
    }else if(!alert){
      playerIdleTimer += dt;

      // Depois de 3 segundos parado, o policial mais próximo em tela
      // abandona temporariamente a patrulha e vai na direção do player.
      if(playerIdleTimer >= 3 && !idleHunterCop){
        idleHunterCop = nearestOnScreenCop();
        if(idleHunterCop) runStats.antiCamp = true;
      }
    }

    // A multidão influencia apenas a visibilidade.
    // Ficar perto de NPCs não reduz mais a velocidade do player.
    const playerSpeedMultiplier = skatesTimer>0 ? 1.5 : 1;
    player.vx = v.x * player.speed * playerSpeedMultiplier;
    player.vy = v.y * player.speed * playerSpeedMultiplier;

    const previousPlayerX = player.x;
    const previousPlayerY = player.y;

    // Slide por eixo vs NPC/cop: bloqueia só o eixo que entra no contato,
    // para o player deslizar ao longo da multidão em vez de grudar.
    player.x = clamp(previousPlayerX + player.vx*dt, 16, W-16);
    if(
      playerOverlapsBlockingNpc(player.x, previousPlayerY, previousPlayerX, previousPlayerY) ||
      playerOverlapsCopBody(player.x, previousPlayerY, previousPlayerX, previousPlayerY)
    ){
      player.x = previousPlayerX;
      player.vx = 0;
    }

    player.y = previousPlayerY + player.vy*dt;
    if(
      playerOverlapsBlockingNpc(player.x, player.y, player.x, previousPlayerY) ||
      playerOverlapsCopBody(player.x, player.y, player.x, previousPlayerY)
    ){
      player.y = previousPlayerY;
      player.vy = 0;
    }

    // Obstáculos fixos: hard-stop do frame inteiro (parede sólida).
    if(playerHitsObstacleAt(player.x, player.y)){
      player.x = previousPlayerX;
      player.y = previousPlayerY;
      player.vx = 0;
      player.vy = 0;
      runStats.obstacleHit = true;
    }

    // câmera nunca recua.
    const cfg = difficultyConfig();
    const desiredCamera = player.y - H*.47;

    if(desiredCamera > cameraY){
      cameraY += Math.min(desiredCamera-cameraY, 210*dt);
    }

    // Difícil/Pro/Impossível: scroll automático para cima.
    if(cfg.autoScroll > 0){
      cameraY += cfg.autoScroll * dt;
    }

    // No Médio/Fácil o player pode tocar o limite inferior da tela.
    // Nos modos com auto-scroll, ficar para trás ainda elimina.
    const playerScreenY = screenY(player.y);

    if(cfg.allowBottomTouch){
      if(playerScreenY > H - 12){
        // Mantém o personagem dentro da viewport sem mover a câmera para trás.
        player.y = cameraY + (H - 110 - (H - 12));
        player.vy = 0;
      }
    }else if(playerScreenY > H + 28){
      end("behind");
      return;
    }

    // Mede apenas deslocamento realmente percorrido pelo player neste frame.
    // Teletransporte não entra na conta, porque altera a posição fora deste movimento.
    distanceTravelledUnits += dist(
      previousPlayerX,
      previousPlayerY,
      player.x,
      player.y
    );
    const frameMeters = dist(previousPlayerX, previousPlayerY, player.x, player.y) / DISTANCE_UNITS_PER_METER;
    if(!runStats.obstacleHit) runStats.cleanDistanceMeters += frameMeters;
    if(skatesTimer > 0) runStats.skatesMeters += frameMeters;

    // Distância de tela: mede somente o avanço da câmera pelo mundo.
    // Como a câmera nunca recua, contamos apenas deltas positivos.
    const cameraAdvance = cameraY - lastMeasuredCameraY;
    if(cameraAdvance > 0){
      screenDistanceTravelledUnits += cameraAdvance;
    }
    lastMeasuredCameraY = cameraY;

    // Impossível: perseguição constante desde o início.
    if(cfg.constantPursuit){
      if(escapeImmunityTimer>0){
        alert=false;
        suspicion=0;
        pursuitEscapeTimer=0;
        pursuitGraceTimer=0;
        mainPursuer=null;
        for(const cop of cops) cop.chase=false;
      }else if(!impossiblePursuitStarted){
        impossiblePursuitStarted = true;
        alert = true;
        suspicion = 100;
        pursuitEscapeTimer = 0;
        mainPursuer = nearestOnScreenCop();

        for(const cop of cops){
          cop.chase = true;
        }
      }else{
        alert = true;
        suspicion = 100;
        pursuitEscapeTimer = 0;
        pursuitGraceTimer = 0;
        if(!mainPursuer) mainPursuer = nearestOnScreenCop();
      }
    }

    // NPCs
    for(const npc of npcs){
      npc.stunTimer=Math.max(0,(npc.stunTimer||0)-dt);

      if(timeFreezeTimer>0){
        npc.vx=0;
        npc.vy=0;
      }else if(npc.stunTimer>0){
        npc.vx=0;
        npc.vy=0;
      }else if(staffTimer>0){
        // Cajado e Moisés: abre um corredor no centro do mapa.
        const center=W/2;
        const corridorHalf=Math.max(72,W*.18);
        const side=Math.sign(npc.x-center) || (random()<.5?-1:1);
        const targetX=center + side*(corridorHalf+35);

        if(Math.abs(npc.x-center)<corridorHalf+30){
          npc.axis="h";
          npc.vx=Math.sign(targetX-npc.x)*72;
          npc.vy=0;
        }else{
          npc.vx=0;
          npc.vy=0;
        }
      }else{
        npc.turn -= dt;
      }

      if(timeFreezeTimer<=0 && npc.stunTimer<=0 && staffTimer<=0 && npc.turn<=0){
        npc.turn = rand(1.2,3.2);

        const sp = clamp(Math.hypot(npc.vx,npc.vy),22,50);
        const sign = random() < .5 ? -1 : 1;

        // Idle em quatro direções, mas alternando obrigatoriamente o eixo.
        // Se estava andando na horizontal, a próxima decisão será vertical
        // e vice-versa. Assim a multidão cria um labirinto realmente dinâmico.
        if(npc.axis === "h"){
          npc.axis = "v";
          npc.vx = 0;
          npc.vy = sign*sp;
        }else{
          npc.axis = "h";
          npc.vx = sign*sp;
          npc.vy = 0;
        }
      }

      const previousNpcX = npc.x;
      const previousNpcY = npc.y;

      npc.x += npc.vx*dt;
      npc.y += npc.vy*dt;
      if(npc.x<16){
        npc.x=16;
        if(npc.axis==="h") npc.vx=Math.abs(npc.vx);
      }
      if(npc.x>W-16){
        npc.x=W-16;
        if(npc.axis==="h") npc.vx=-Math.abs(npc.vx);
      }

      for(const o of obstacles){
        if(Math.abs((o.y+o.h/2)-npc.y) > 60) continue;
        if(resolveCircleRect(npc,o,.9)){
          const sp = clamp(Math.hypot(npc.vx,npc.vy),22,50);
          const sign = random() < .5 ? -1 : 1;

          if(npc.axis === "h"){
            npc.axis = "v";
            npc.vx = 0;
            npc.vy = sign*sp;
          }else{
            npc.axis = "h";
            npc.vx = sign*sp;
            npc.vy = 0;
          }

          npc.turn = rand(.7,1.8);
        }
      }

      // Se o NPC tentou entrar no player, quem para/desvia é o NPC.
      // Com Sabonete ativo, player e multidão atravessam um ao outro.
      const playerContact = npc.r + player.r;
      if(soapTimer<=0 && dist(npc.x,npc.y,player.x,player.y) < playerContact){
        npc.x = previousNpcX;
        npc.y = previousNpcY;

        const sp = clamp(Math.hypot(npc.vx,npc.vy),22,50);
        const sign = random() < .5 ? -1 : 1;

        if(npc.axis === "h"){
          npc.axis = "v";
          npc.vx = 0;
          npc.vy = sign*sp;
        }else{
          npc.axis = "h";
          npc.vx = sign*sp;
          npc.vy = 0;
        }

        npc.turn = rand(.45,1.1);
      }
    }

    // Evita civis (e civis vs policial) empilharem uns nos outros.
    separateOverlappingCrowd();

    let seen = false;
    let nearestSeeingCop = null;
    let nearestSeenDist = Infinity;
    let touchingPolice = false;

    for(const cop of cops){
      const copScreenYForLifecycle = screenY(cop.y);

      if(copScreenYForLifecycle >= -20 && copScreenYForLifecycle <= H + 20){
        cop.hasBeenOnScreen = true;
      }

      cop.seeingPlayer = false;
      cop.suspicionLock = Math.max(0, (cop.suspicionLock || 0) - dt);
      cop.avoidTimer = Math.max(0, (cop.avoidTimer || 0) - dt);
      cop.stunTimer = Math.max(0, (cop.stunTimer || 0) - dt);

      if(timeFreezeTimer>0){
        cop.vx=0;
        cop.vy=0;
        cop.chase=alert;
      }else if(cop.stunTimer>0){
        cop.vx=0;
        cop.vy=0;
        cop.chase=alert;
      }else if(alert && invisibilityTimer>0){
        // Invisível: policiais não conseguem recalcular a posição do player.
        // Mantêm a última direção, mais lentamente, até conseguirem vê-lo de novo.
        const current=Math.max(38,Math.hypot(cop.vx,cop.vy));
        if(cop.axis==="h"){
          cop.vx=(Math.sign(cop.vx)||1)*Math.min(current,58);
          cop.vy=0;
        }else{
          cop.vx=0;
          cop.vy=(Math.sign(cop.vy)||1)*Math.min(current,58);
        }
        cop.chase=true;
      }else if(alert){
        const dx = player.x-cop.x;
        const dy = player.y-cop.y;
        let speed = 92 + Math.min(36,elapsed*.7);

        // O perseguidor principal perde 15% da velocidade quando perde a visão.
        if(cop===mainPursuer && !canCopSeePlayer(cop)){
          speed *= .85;
        }

        // Durante um desvio, mantém a direção por alguns décimos de segundo.
        // Isso impede o policial de oscilar contra a mesma barreira.
        if(cop.avoidTimer<=0){
          if(Math.abs(dx) > Math.abs(dy)){
            cop.axis = "h";
            cop.vx = Math.sign(dx || 1)*speed;
            cop.vy = 0;
          }else{
            cop.axis = "v";
            cop.vx = 0;
            cop.vy = Math.sign(dy || 1)*speed;
          }
        }
        cop.chase = true;
      }else if(cop === idleHunterCop && playerIdleTimer >= 3){
        const dx = player.x-cop.x;
        const dy = player.y-cop.y;
        const speed = 62;

        // Anti-camping respeita o desvio já escolhido até terminar o lock.
        if(cop.avoidTimer<=0){
          if(Math.abs(dx) > Math.abs(dy)){
            cop.axis = "h";
            cop.vx = Math.sign(dx || 1)*speed;
            cop.vy = 0;
          }else{
            cop.axis = "v";
            cop.vx = 0;
            cop.vy = Math.sign(dy || 1)*speed;
          }
        }
        cop.chase = false;
      }else{
        cop.turn -= dt;

        if(cop.turn<=0){
          cop.turn = rand(1.6,3.4);

          const sp = clamp(Math.hypot(cop.vx,cop.vy),34,56);
          const sign = random() < .5 ? -1 : 1;

          // Patrulha em 4 direções com troca obrigatória de eixo.
          if(cop.axis === "h"){
            cop.axis = "v";
            cop.vx = 0;
            cop.vy = sign*sp;
          }else{
            cop.axis = "h";
            cop.vx = sign*sp;
            cop.vy = 0;
          }
        }
      }

      const previousCopX = cop.x;
      const previousCopY = cop.y;

      cop.x += cop.vx*dt;
      cop.y += cop.vy*dt;

      // Policiais também não atravessam o player.
      if(circlesOverlap(cop.x,cop.y,cop.r+4,player.x,player.y,player.r)){
        cop.x = previousCopX;
        cop.y = previousCopY;

        // Se estava perseguindo/anti-camping, tenta contornar em vez de empurrar o player.
        if(alert || (cop === idleHunterCop && playerIdleTimer >= 3)){
          const sp = alert ? Math.max(75,Math.hypot(cop.vx,cop.vy)) : 62;
          startCopDetour(cop,player.x,player.y,sp);
        }else{
          cop.vx *= -1;
          cop.vy *= -1;
          cop.turn = rand(.6,1.3);
        }
      }

      if(cop.x<16){
        cop.x=16;
        if(cop.axis==="h") cop.vx=Math.abs(cop.vx);
      }
      if(cop.x>W-16){
        cop.x=W-16;
        if(cop.axis==="h") cop.vx=-Math.abs(cop.vx);
      }

      for(const o of obstacles){
        if(Math.abs((o.y+o.h/2)-cop.y) > 65) continue;
        if(resolveCircleRect(cop,o,1)){
          if(alert){
            const sp = Math.max(75,Math.hypot(cop.vx,cop.vy));
            startCopDetour(cop,player.x,player.y,sp);
          }else if(cop === idleHunterCop && playerIdleTimer >= 3){
            // Anti-camping: faz um desvio estável e só depois volta
            // a mirar no jogador.
            startCopDetour(cop,player.x,player.y,62);
          }else{
            // Patrulha comum: vira 90 graus normalmente.
            const sp = clamp(Math.hypot(cop.vx,cop.vy),34,56);
            const sign = random()<.5 ? -1 : 1;

            if(cop.axis === "h"){
              cop.axis = "v";
              cop.vx = 0;
              cop.vy = sign*sp;
            }else{
              cop.axis = "h";
              cop.vx = sign*sp;
              cop.vy = 0;
            }

            cop.turn = rand(.8,1.8);
          }
        }
      }

      const d = dist(cop.x,cop.y,player.x,player.y);

      // Reconhecimento tem prioridade sobre a direção de patrulha.
      // Uma vez que o player entra no cone, o policial continua mirando nele
      // até o reconhecimento ser quebrado (distância/efeito especial/perseguição).
      const recognitionAllowed =
        timeFreezeTimer<=0 &&
        !alert &&
        escapeImmunityTimer<=0 &&
        invisibilityTimer<=0 &&
        d <= cop.vision;

      if(cop.recognizing && recognitionAllowed){
        const targetFace = Math.atan2(player.y-cop.y, player.x-cop.x);
        cop.face = turnTowardAngle(cop.face,targetFace,6.2*dt);
        cop.seeingPlayer = true;
      }else{
        cop.recognizing = false;

        // Fora do reconhecimento, o cone sempre aponta para onde o policial anda.
        if(Math.hypot(cop.vx,cop.vy)>.1){
          cop.face = Math.atan2(cop.vy,cop.vx);
        }

        // O reconhecimento só começa se o player entrar no cone normal de patrulha.
        if(recognitionAllowed && pointInCone(cop,player.x,player.y)){
          cop.recognizing = true;
          cop.seeingPlayer = true;

          const targetFace = Math.atan2(player.y-cop.y, player.x-cop.x);
          cop.face = turnTowardAngle(cop.face,targetFace,6.2*dt);
        }
      }

      if(cop.seeingPlayer){
        const crowdCover = clamp(density*.13,0,.62);
        const distanceFactor = 1 - clamp(d/cop.vision,0,.75)*.38;
        suspicion += 72 * distanceFactor * (1-crowdCover) * dt;
        seen = true;

        if(d<nearestSeenDist){
          nearestSeenDist=d;
          nearestSeeingCop=cop;
        }
      }

      // Área de BUSTED (maior que a hitbox física): o jogador pode permanecer
      // nela por no máximo 1,5s. A hitbox sólida do corpo já foi tratada acima.
      // O tempo é acumulado uma única vez por frame, mesmo se tocar em mais de um policial.
      if(d < effectiveDangerRadius(cop) + player.r){
        touchingPolice = true;
      }
    }

    // Câmeras de vigilância.
    let cameraSeeing = false;
    for(const camera of cameras){
      camera.seeingPlayer=false;
      const camSy = screenY(camera.y);
      if(camSy >= -40 && camSy <= H + 40) camera.everOnScreen = true;

      // Rotação 360º: direção definida no spawn e mantida para sempre.
      // Com o tempo parado, o cone também congela.
      if(camera.mode==="rotate" && timeFreezeTimer<=0){
        camera.face += camera.rotationDir * camera.rotationSpeed * dt;
        camera.face = Math.atan2(Math.sin(camera.face),Math.cos(camera.face));
      }

      if(timeFreezeTimer<=0 && !alert && pointInCameraVision(camera,player.x,player.y)){
        camera.seeingPlayer=true;
        camera.spottedPlayer=true;
        cameraSeeing = true;

        const d=dist(camera.x,camera.y,player.x,player.y);
        const crowdCover=clamp(density*.13,0,.62);
        const distanceFactor=1-clamp(d/camera.vision,0,.75)*.38;

        // Mesmo ritmo-base de reconhecimento utilizado pelos policiais.
        suspicion += 72 * distanceFactor * (1-crowdCover) * dt;
        seen=true;
      }
    }
    if(!cameraSeeing) runStats.noCameraTime += dt;

    if(idleHunterCop && !alert){
      const hunterScreenY = screenY(idleHunterCop.y);
      if(hunterScreenY < -30 || hunterScreenY > H + 30){
        idleHunterCop = nearestOnScreenCop();
      }
    }

    if(touchingPolice){
      bustedTimer += dt;
      runStats.touchedPolice = true;
      runStats.maxBusted = Math.max(runStats.maxBusted, bustedTimer);
      if(alert) runMaxBustedInAlert = Math.max(runMaxBustedInAlert, bustedTimer);

      if(bustedTimer >= 1.5){
        bustedTimer = 1.5;

        end("caught");
        return;
      }
    }else{
      bustedTimer = 0;
    }

    if(!seen && !alert){
      suspicion -= 48*dt;
    }

    suspicion = clamp(suspicion,0,100);
    if(suspicion >= 99) runStats.suspicionHit99 = true;
    if(runStats.suspicionHit99 && suspicion < 50) runStats.suspicionRecovered = true;
    if(!alert && suspicion <= 50) runStats.suspicionLow50Time += dt;
    if(!alert && suspicion < 20) runStats.suspicionLow20Time += dt;

    const coverStrength = clamp(density * .13, 0, .62);
    if(coverStrength >= .2){
      runStats.crowdCoverTime += dt;
      runStats.crowdCoverStreak += dt;
      runStats.crowdCoverStreakMax = Math.max(
        runStats.crowdCoverStreakMax,
        runStats.crowdCoverStreak,
      );
    }else{
      runStats.crowdCoverStreak = 0;
    }
    if(inventory.length >= 3) runStats.inventoryFull = true;

    if(suspicion>=100 && !alert && escapeImmunityTimer<=0){
      alert = true;
      runStats.alertEver = true;
      runAlertItemsUsed = 0;
      runMaxBustedInAlert = 0;
      runSoapInAlert = false;
      runDirsInEscape = new Set();
      pursuitEscapeTimer = 0;
      pursuitGraceTimer = .5;

      // Só o policial que efetivamente identificou o jogador controla a barra de fuga.
      // Se não houver um identificador claro, usa o policial visível mais próximo.
      mainPursuer = nearestSeeingCop || cops.reduce((best,cop)=>{
        const sy=screenY(cop.y);
        if(sy<0 || sy>H) return best;
        if(!best) return cop;
        return dist(cop.x,cop.y,player.x,player.y) < dist(best.x,best.y,player.x,player.y) ? cop : best;
      }, null);

      for(const cop of cops){
        cop.recognizing=false;
        cop.seeingPlayer=false;
        if(Math.abs(cop.y-player.y)<H*.8) cop.chase=true;
      }
    }

    // Fuga considera o perseguidor principal: 3s no Fácil/Médio,
    // 4s no Difícil/Pro; Impossível não permite fuga normal.
    if(alert){
      if(cfg.constantPursuit){
        // Impossível: não existe condição de fuga.
        pursuitEscapeTimer = 0;
        pursuitGraceTimer = 0;
        suspicion = 100;
        alert = true;
        for(const c of cops) c.chase = true;
      }else{
        if(!mainPursuer || !cops.includes(mainPursuer)){
          mainPursuer = nearestOnScreenCop();
        }

        const mainSeesPlayer = timeFreezeTimer<=0 && !!mainPursuer && canCopSeePlayer(mainPursuer);
        const escapeTarget = pursuitEscapeTarget();

        if(mainSeesPlayer){
          // Ser visto pelo perseguidor principal reduz o progresso,
          // mas não zera instantaneamente.
          pursuitGraceTimer = .5;
          pursuitEscapeTimer = Math.max(0, pursuitEscapeTimer - 2*dt);
          suspicion = Math.max(suspicion,90);
        }else{
          // 0,5s de tolerância após quebrar a linha de visão.
          if(pursuitGraceTimer > 0){
            pursuitGraceTimer = Math.max(0, pursuitGraceTimer-dt);
          }else{
            pursuitEscapeTimer += dt;
          }

          suspicion = Math.max(18, suspicion - 10*dt);

          if(pursuitEscapeTimer >= escapeTarget){
            alert = false;
            suspicion = 0;
            pursuitEscapeTimer = 0;
            pursuitGraceTimer = 0;
            mainPursuer = null;
            noteEscape(true);

            for(const c of cops){
              c.chase = false;
              c.turn = rand(.8,1.8);
            }
          }
        }
      }
    }else{
      pursuitEscapeTimer = 0;
      pursuitGraceTimer = 0;
      mainPursuer = null;
    }

    // Coleta de power-ups. Com inventário cheio eles continuam no mapa
    // e são renderizados em escala de cinza.
    // Há um pequeno cooldown após cada coleta para impedir que dois itens
    // próximos sejam capturados praticamente ao mesmo tempo.
    if(powerPickupCooldown<=0 && inventory.length<3){
      for(let i=powerUps.length-1;i>=0;i--){
        const p=powerUps[i];
        if(dist(p.x,p.y,player.x,player.y) > p.r+player.r+3) continue;

        inventory.push(p.type);
        rememberType(runStats.pickedTypes, p.type);
        powerUps.splice(i,1);
        powerPickupFlash=.22;
        powerPickupCooldown=.45;
        onPowerPickup(p.type);

        break;
      }
    }

    ensureWorld();

    // cleanup
    const minY = cameraY-260;
    for(let i=npcs.length-1;i>=0;i--) if(npcs[i].y<minY) npcs.splice(i,1);

    // Policiais deixam de existir depois de já terem aparecido na tela
    // e saírem da viewport com uma margem de segurança.
    // Policiais recém-gerados fora da tela não são removidos antes de entrar.
    for(let i=cops.length-1;i>=0;i--){
      const cop=cops[i];
      const sy=screenY(cop.y);

      if(cop.hasBeenOnScreen && (sy < -140 || sy > H + 140)){
        if(mainPursuer===cop) mainPursuer=null;
        if(idleHunterCop===cop) idleHunterCop=null;
        cops.splice(i,1);
      }
    }

    for(let i=cameras.length-1;i>=0;i--){
      if(cameras[i].y<minY){
        const cam = cameras[i];
        if(cam.everOnScreen && !cam.spottedPlayer) runStats.camerasClean += 1;
        cameras.splice(i,1);
      }
    }
    for(let i=decor.length-1;i>=0;i--) if(decor[i].y<minY) decor.splice(i,1);
    for(let i=obstacles.length-1;i>=0;i--) if(obstacles[i].y+obstacles[i].h<minY) obstacles.splice(i,1);
    for(let i=powerUps.length-1;i>=0;i--) if(powerUps[i].y<minY) powerUps.splice(i,1);

    enforceOnScreenActorLimit();
    enforceOnScreenCameraLimit();


  }



  function drawBackground(context){
    if(context) ctx = context;
    ctx.fillStyle="#1f2630";
    ctx.fillRect(0,0,W,H);

    // sidewalk tiles (1 SQM)
    const tile=SQM;
    const offset = ((cameraY%tile)+tile)%tile;
    ctx.strokeStyle="#2d3642";
    ctx.lineWidth=1;
    ctx.beginPath();
    for(let y=-tile+offset;y<H+tile;y+=tile){
      ctx.moveTo(0,y);ctx.lineTo(W,y);
    }
    for(let x=0;x<W;x+=tile){
      ctx.moveTo(x,0);ctx.lineTo(x,H);
    }
    ctx.stroke();

    // side gutters
    ctx.fillStyle="#151a21";
    ctx.fillRect(0,0,12,H);
    ctx.fillRect(W-12,0,12,H);
    ctx.fillStyle="#323d49";
    ctx.fillRect(12,0,3,H);
    ctx.fillRect(W-15,0,3,H);

    // direction arrows
    ctx.globalAlpha=.16;
    ctx.fillStyle="#8da2b8";
    for(let i=0;i<6;i++){
      const yy = ((i*150 + (cameraY*.45))%(H+170))-80;
      ctx.beginPath();
      ctx.moveTo(W/2,yy-24);ctx.lineTo(W/2-16,yy);ctx.lineTo(W/2-6,yy);ctx.lineTo(W/2-6,yy+26);
      ctx.lineTo(W/2+6,yy+26);ctx.lineTo(W/2+6,yy);ctx.lineTo(W/2+16,yy);ctx.closePath();ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  function drawDecor(){
    for(const d of decor){
      const sy=screenY(d.y);
      if(sy<-30||sy>H+30) continue;
      if(d.type==="drain"){
        ctx.fillStyle="#11161c";ctx.fillRect(d.x-8,sy-5,16,10);
        ctx.strokeStyle="#3c4651";ctx.strokeRect(d.x-8,sy-5,16,10);
        ctx.strokeStyle="#29323b";
        for(let k=-5;k<=5;k+=5){ctx.beginPath();ctx.moveTo(d.x+k,sy-4);ctx.lineTo(d.x+k,sy+4);ctx.stroke()}
      }else{
        ctx.fillStyle="#8d8b76";ctx.fillRect(d.x-3,sy-2,7,5);
      }
    }
  }

  function drawCone(cop){
    const sy=screenY(cop.y);
    if(sy<-220||sy>H+220) return;

    const x=cop.x, y=sy;
    const r=cop.vision;
    const currentFov = effectiveFov(cop);
    const a1 = -cop.face - currentFov/2;
    const a2 = -cop.face + currentFov/2;

    ctx.save();

    if(alert && cop.chase){
      // Durante a perseguição, o mesmo cone da lanterna fica branco
      // para ser imediatamente legível pelo jogador.
      ctx.fillStyle="rgba(255,255,255,.22)";
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.arc(x,y,r,a1,a2,false);
      ctx.closePath();
      ctx.fill();

    }else{
      // Feixe normal de patrulha/suspeita (fills sólidos — sem gradiente por frame).
      const p = cop.seeingPlayer ? clamp(suspicion/100, 0, 1) : 0;
      const red = 244;
      const green = Math.round(205 - 145*p);
      const blue = Math.round(72 - 35*p);

      ctx.fillStyle="rgba(255,224,104,.20)";
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.arc(x,y,r,a1,a2,false);
      ctx.closePath();
      ctx.fill();

      if(cop.seeingPlayer && p > 0){
        const chargedR = Math.max(18, r*p);
        ctx.fillStyle=`rgba(${red},${green},${blue},${.18 + .22 * p})`;
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.arc(x,y,chargedR,a1,a2,false);
        ctx.closePath();
        ctx.fill();

        const bx=x+Math.cos(cop.face)*17;
        const by=y-Math.sin(cop.face)*17;
        const bw=30,bh=5;

        ctx.save();
        ctx.translate(bx,by);
        ctx.rotate(-cop.face);
        ctx.fillStyle="#10151c";
        ctx.fillRect(-bw/2,-bh/2,bw,bh);
        ctx.fillStyle=`rgb(${red},${green},${blue})`;
        ctx.fillRect(-bw/2+1,-bh/2+1,(bw-2)*p,bh-2);
        ctx.strokeStyle="rgba(255,255,255,.22)";
        ctx.lineWidth=1;
        ctx.strokeRect(-bw/2-.5,-bh/2-.5,bw+1,bh+1);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function drawPerson(x,sy,tone,police=false,playerChar=false){
    // pixel body (~1.5×, larguras em múltiplos de 8)
    const skin=["#f1c7a2","#c98f66","#8e5e42","#e1aa7d","#6b4937"][tone%5];

    // shadow
    ctx.fillStyle="#0005";ctx.fillRect(Math.round(x-12),Math.round(sy+16),24,8);

    // legs
    ctx.fillStyle=playerChar?"#1f1f24":police?"#18283a":"#26313d";
    ctx.fillRect(Math.round(x-10),Math.round(sy+4),8,16);
    ctx.fillRect(Math.round(x+2),Math.round(sy+4),8,16);

    // torso
    if(playerChar){
      // roupa listrada de bandido
      ctx.fillStyle="#f4f4f4";
      ctx.fillRect(Math.round(x-12),Math.round(sy-12),24,20);
      ctx.fillStyle="#111";
      ctx.fillRect(Math.round(x-12),Math.round(sy-12),24,3);
      ctx.fillRect(Math.round(x-12),Math.round(sy-6),24,3);
      ctx.fillRect(Math.round(x-12),Math.round(sy),24,3);
      ctx.fillRect(Math.round(x-12),Math.round(sy+6),24,2);
      // listras verticais sutis para lembrar uniforme clássico
      ctx.fillRect(Math.round(x-6),Math.round(sy-12),3,20);
      ctx.fillRect(Math.round(x+2),Math.round(sy-12),3,20);
    }else{
      ctx.fillStyle=police?"#3e79a8":["#6f8f5a","#9e5f79","#8a774e","#5b7c9e","#795b9b"][tone%5];
      ctx.fillRect(Math.round(x-12),Math.round(sy-12),24,20);
    }

    // head
    ctx.fillStyle=skin;
    ctx.fillRect(Math.round(x-8),Math.round(sy-24),16,12);

    // hair/hat
    if(playerChar){
      // gorrinho/boina escura
      ctx.fillStyle="#111";
      ctx.fillRect(Math.round(x-10),Math.round(sy-32),20,8);
      ctx.fillRect(Math.round(x-6),Math.round(sy-24),12,2);
    }else{
      ctx.fillStyle=police?"#1e3045":"#3a3029";
      ctx.fillRect(Math.round(x-8),Math.round(sy-28),16,4);
      if(police){
        ctx.fillStyle="#6ca1cc";ctx.fillRect(Math.round(x-12),Math.round(sy-32),24,4);
      }
    }
  }

  function drawObstacles(){
    for(const o of obstacles){
      const sy = screenY(o.y + o.h);
      const top = sy;
      if(top < -80 || top > H+80) continue;

      const x = Math.round(o.x);
      const y = Math.round(top);
      const w = Math.round(o.w);
      const h = Math.round(o.h);

      ctx.save();

      // sombra
      ctx.fillStyle="rgba(0,0,0,.28)";
      ctx.fillRect(x+3,y+h-2,w,6);

      if(o.type==="bench"){
        ctx.fillStyle="#7b5639";
        ctx.fillRect(x,y+4,w,h-7);
        ctx.fillStyle="#9b6d47";
        ctx.fillRect(x,y,w,6);
        ctx.fillStyle="#4a3628";
        ctx.fillRect(x+6,y+h-4,5,6);
        ctx.fillRect(x+w-11,y+h-4,5,6);
      }else if(o.type==="trash"){
        ctx.fillStyle="#4e5b66";
        ctx.fillRect(x+2,y+3,w-4,h-3);
        ctx.fillStyle="#6d7b87";
        ctx.fillRect(x,y,w,6);
        ctx.fillStyle="#252d33";
        ctx.fillRect(x+6,y+8,w-12,4);
      }else if(o.type==="planter"){
        ctx.fillStyle="#8a5e43";
        ctx.fillRect(x,y+8,w,h-8);
        ctx.fillStyle="#5d3d2c";
        ctx.fillRect(x+3,y+11,w-6,h-11);
        ctx.fillStyle="#4f9c55";
        ctx.fillRect(x+5,y,w-10,9);
        ctx.fillStyle="#69b567";
        ctx.fillRect(x+10,y-5,8,8);
        ctx.fillRect(x+w-18,y-4,8,8);
      }else if(o.type==="barrier"){
        ctx.fillStyle="#d7dce1";
        ctx.fillRect(x,y+5,w,h-5);
        ctx.fillStyle="#e95045";
        for(let k=3;k<w;k+=18){
          ctx.fillRect(x+k,y+5,9,h-5);
        }
        ctx.fillStyle="#606a74";
        ctx.fillRect(x+4,y+h-2,8,5);
        ctx.fillRect(x+w-12,y+h-2,8,5);
      }else{
        ctx.fillStyle="#8c663e";
        ctx.fillRect(x,y,w,h);
        ctx.strokeStyle="#b88854";
        ctx.lineWidth=3;
        ctx.strokeRect(x+2,y+2,w-4,h-4);
        ctx.beginPath();
        ctx.moveTo(x+3,y+3);ctx.lineTo(x+w-3,y+h-3);
        ctx.moveTo(x+w-3,y+3);ctx.lineTo(x+3,y+h-3);
        ctx.stroke();
      }

      ctx.restore();
    }
  }


  function drawCameraConeShape(camera, face){
    const sy=screenY(camera.y);
    const x=camera.x;
    const y=sy;
    const r=camera.vision;
    const a1=-face-camera.fov/2;
    const a2=-face+camera.fov/2;

    const p=camera.seeingPlayer ? clamp(suspicion/100,0,1) : 0;

    ctx.save();

    ctx.fillStyle="rgba(95,190,255,.16)";
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.arc(x,y,r,a1,a2,false);
    ctx.closePath();
    ctx.fill();

    if(camera.seeingPlayer && p>0){
      const chargedR=Math.max(20,r*p);
      const red=244;
      const green=Math.round(195-125*p);
      const blue=Math.round(75-30*p);

      ctx.fillStyle=`rgba(${red},${green},${blue},${.16 + .2 * p})`;
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.arc(x,y,chargedR,a1,a2,false);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function drawCameraCones(){
    for(const camera of cameras){
      const sy=screenY(camera.y);
      if(sy<-220||sy>H+220) continue;

      for(const face of cameraFaces(camera)){
        drawCameraConeShape(camera,face);
      }
    }
  }

  function drawCameras(){
    for(const camera of cameras){
      const sy=screenY(camera.y);
      if(sy<-40||sy>H+40) continue;

      const faces=cameraFaces(camera);

      ctx.save();
      ctx.translate(camera.x,sy);

      // Poste/base.
      ctx.fillStyle="#202936";
      ctx.fillRect(-3,5,6,12);
      ctx.fillStyle="#5c6b7d";
      ctx.fillRect(-6,14,12,4);

      // Corpo principal da câmera.
      ctx.fillStyle=camera.seeingPlayer ? "#ff7b59" : "#d6e2ef";
      ctx.strokeStyle="#0b1018";
      ctx.lineWidth=2;
      ctx.fillRect(-8,-8,16,12);
      ctx.strokeRect(-8,-8,16,12);

      // Luz indicadora.
      ctx.fillStyle=camera.seeingPlayer ? "#ff394b" : "#55d9ff";
      ctx.fillRect(-2,-5,4,4);

      // Pequena etiqueta visual para indicar o padrão.
      ctx.fillStyle="#0b1018";
      ctx.font="900 7px ui-monospace, monospace";
      ctx.textAlign="center";
      ctx.textBaseline="middle";

      const modeLabel={
        fixed1:"1",
        fixed2:"2",
        sweep:"↔",
        rotate:"⟳"
      }[camera.mode];

      ctx.fillText(modeLabel,0,1);

      ctx.restore();

      // Cabeça/lente aponta para a direção atual.
      // No modo de duas direções desenhamos uma lente em cada lado.
      for(const face of faces){
        const fx=Math.cos(face)*10;
        const fy=-Math.sin(face)*10;

        ctx.save();
        ctx.translate(camera.x+fx,sy+fy);
        ctx.rotate(-face);
        ctx.fillStyle="#7fa7c6";
        ctx.fillRect(-2,-3,8,6);
        ctx.fillStyle="#111722";
        ctx.fillRect(4,-2,3,4);
        ctx.restore();
      }
    }
  }


  function drawPowerVectorIcon(ctx,type,size,color){
    const s=size/24;
    ctx.save();
    ctx.scale(s,s);
    ctx.lineCap="round";
    ctx.lineJoin="round";
    ctx.strokeStyle="rgba(255,255,255,.82)";
    ctx.fillStyle=color;
    ctx.lineWidth=1.15;

    const line=(x1,y1,x2,y2,w=1.2)=>{
      ctx.save();
      ctx.lineWidth=w;
      ctx.beginPath();
      ctx.moveTo(x1,y1);
      ctx.lineTo(x2,y2);
      ctx.stroke();
      ctx.restore();
    };

    if(type==="escape"){
      ctx.beginPath();
      ctx.moveTo(12,2.8);ctx.lineTo(6.4,12);ctx.lineTo(10.1,12);
      ctx.lineTo(8.9,21.2);ctx.lineTo(17.6,10.7);ctx.lineTo(13.8,10.7);
      ctx.lineTo(17,2.8);ctx.closePath();ctx.fill();ctx.stroke();

    }else if(type==="soap"){
      ctx.beginPath();
      ctx.roundRect(4.2,6.2,15.6,11.6,4.3);
      ctx.fill();ctx.stroke();
      ctx.fillStyle="rgba(255,255,255,.78)";
      ctx.beginPath();ctx.arc(8.2,8.1,1.1,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(11.2,6.6,.8,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(14.6,8.3,.9,0,Math.PI*2);ctx.fill();

    }else if(type==="skates"){
      ctx.beginPath();
      ctx.moveTo(5,13.4);ctx.lineTo(15.2,13.4);
      ctx.quadraticCurveTo(17.8,13.4,18.6,16);
      ctx.lineTo(19.3,17.8);ctx.lineTo(5.6,17.8);
      ctx.quadraticCurveTo(4,17.8,4,16);ctx.closePath();
      ctx.fill();ctx.stroke();
      ctx.fillStyle="#0b1020";
      for(const x of [8.2,12.2,16.2]){
        ctx.beginPath();ctx.arc(x,19.1,1.45,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
      ctx.fillStyle=color;
      ctx.beginPath();ctx.moveTo(7.1,11.4);ctx.lineTo(9.1,7.7);ctx.lineTo(14.2,7.7);ctx.stroke();

    }else if(type==="staff"){
      line(12,3.2,12,19.3,1.7);
      ctx.beginPath();
      ctx.moveTo(8.6,6.1);
      ctx.quadraticCurveTo(12,2.9,15.4,6.1);
      ctx.quadraticCurveTo(12,9.3,8.6,6.1);
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(5.3,15.6);
      ctx.quadraticCurveTo(8.8,12.5,12,12.5);
      ctx.quadraticCurveTo(15.2,12.5,18.7,15.6);
      ctx.stroke();

    }else if(type==="invis"){
      ctx.beginPath();
      ctx.moveTo(3.2,12);
      ctx.quadraticCurveTo(6.5,6.7,12,6.7);
      ctx.quadraticCurveTo(17.5,6.7,20.8,12);
      ctx.quadraticCurveTo(17.5,17.3,12,17.3);
      ctx.quadraticCurveTo(6.5,17.3,3.2,12);
      ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.arc(12,12,2.9,0,Math.PI*2);ctx.fill();ctx.stroke();
      line(5,19,19,5,1.4);

    }else if(type==="teleport"){
      ctx.save();
      ctx.setLineDash([2,2]);
      ctx.beginPath();ctx.arc(12,12,7.1,0,Math.PI*2);ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(11.8,4.7);ctx.lineTo(13.4,8.7);ctx.lineTo(17.5,10.2);
      ctx.lineTo(13.4,11.7);ctx.lineTo(11.8,15.7);ctx.lineTo(10.2,11.7);
      ctx.lineTo(6.1,10.2);ctx.lineTo(10.2,8.7);ctx.closePath();ctx.fill();ctx.stroke();

    }else if(type==="shield"){
      ctx.beginPath();
      ctx.moveTo(12,3.2);ctx.lineTo(18.7,5.6);ctx.lineTo(18.7,11.4);
      ctx.quadraticCurveTo(18.7,17,12,20.8);
      ctx.quadraticCurveTo(5.3,17,5.3,11.4);
      ctx.lineTo(5.3,5.6);ctx.closePath();ctx.fill();ctx.stroke();
      line(12,7.2,12,14.3,1.2);
      line(8.8,10.3,15.2,10.3,1.2);

    }else if(type==="time"){
      ctx.beginPath();ctx.arc(12,12,7.5,0,Math.PI*2);ctx.stroke();
      line(12,12,12,7.6,1.5);
      line(12,12,15.5,14.1,1.5);
      line(8.7,2.9,15.3,2.9,1.3);
      line(9.3,20.2,14.7,20.2,1.1);
    }

    ctx.restore();
  }

  function drawPowerUps(){
    const inventoryFull=inventory.length>=3;

    for(const p of powerUps){
      const sy=screenY(p.y);
      if(sy<-45||sy>H+45) continue;

      const def=POWER_TYPES[p.type];
      const bob=Math.sin(elapsed*4+p.phase)*3;

      ctx.save();
      ctx.translate(p.x,sy+bob);

      if(inventoryFull){
        ctx.globalAlpha=.48;
        ctx.filter="grayscale(1)";
      }

      // Glow/placa coletável.
      ctx.fillStyle=inventoryFull ? "#666" : def.color+"33";
      ctx.beginPath();
      ctx.arc(0,0,24,0,Math.PI*2);
      ctx.fill();

      ctx.fillStyle="#0b1020";
      ctx.fillRect(-16,-16,32,32);
      ctx.strokeStyle=inventoryFull ? "#888" : def.color;
      ctx.lineWidth=2;
      ctx.strokeRect(-16,-16,32,32);

      // Mesmo ícone vetorial usado no inventário da UI.
      ctx.save();
      ctx.translate(-12,-12);
      drawPowerVectorIcon(
        ctx,
        p.type,
        24,
        inventoryFull ? "#aaa" : def.color
      );
      ctx.restore();

      if(inventoryFull){
        ctx.filter="none";
        ctx.fillStyle="rgba(15,18,24,.88)";
        ctx.fillRect(-16,16,32,10);
        ctx.fillStyle="#b8bec8";
        ctx.font="900 7px ui-monospace, monospace";
        ctx.fillText("CHEIO",0,24);
      }

      ctx.restore();
    }
  }

  function drawNPCs(){
    const soapActive = soapTimer > 0;
    for(const npc of npcs){
      const sy=screenY(npc.y);
      if(sy<-40||sy>H+40) continue;
      if(soapActive){
        ctx.save();
        ctx.globalAlpha = .42;
        drawPerson(npc.x,sy,npc.tone,false,false);
        ctx.restore();
      }else{
        drawPerson(npc.x,sy,npc.tone,false,false);
      }
    }
  }

  function drawCops(){
    for(const cop of cops){
      const sy=screenY(cop.y);
      if(sy<-50||sy>H+50) continue;
      // Área circular de contato do policial.
      // O jogador não pode entrar neste círculo em nenhuma direção.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cop.x,sy-3,effectiveDangerRadius(cop),0,Math.PI*2);
      ctx.fillStyle = cop.chase ? "rgba(255,70,70,.08)" : "rgba(255,255,255,.035)";
      ctx.fill();
      ctx.strokeStyle = cop.chase ? "rgba(255,85,85,.42)" : "rgba(220,230,240,.18)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3,3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      if(cop.chase){
        const strobeBlue = Math.floor(elapsed * 7) % 2 === 0;
        const strobeColor = strobeBlue ? "#3f7cff" : "#ff3f4f";
        ctx.strokeStyle=strobeColor;
        ctx.lineWidth=3;
        ctx.beginPath();ctx.arc(cop.x,sy-3,24,0,Math.PI*2);ctx.stroke();

        // Pequenos flashes laterais simulando giroflex.
        ctx.fillStyle=strobeBlue ? "#3f7cff" : "#ff3f4f";
        ctx.fillRect(Math.round(cop.x-16),Math.round(sy-40),8,4);
        ctx.fillStyle=strobeBlue ? "#ff3f4f" : "#3f7cff";
        ctx.fillRect(Math.round(cop.x+8),Math.round(sy-40),8,4);
      }
      if(cop === idleHunterCop && !alert && playerIdleTimer >= 3){
        ctx.save();
        ctx.font="900 12px ui-monospace, monospace";
        ctx.textAlign="center";
        ctx.lineWidth=3;
        ctx.strokeStyle="rgba(0,0,0,.7)";
        ctx.strokeText("!",cop.x,sy-48);
        ctx.fillStyle="#ffd45a";
        ctx.fillText("!",cop.x,sy-48);
        ctx.restore();
      }

      drawPerson(cop.x,sy,2,true,false);

      // facing marker
      ctx.fillStyle=alert?"#ff4444":"#f3cf55";
      const fx=Math.cos(cop.face)*16;
      const fy=-Math.sin(cop.face)*16;
      ctx.fillRect(Math.round(cop.x+fx-2),Math.round(sy+fy-2),4,4);
    }
  }

  function drawSpawnIndicator(){
    if(!started || spawnIndicator<=0) return;

    const sy = screenY(player.y);
    const age = 2.6 - spawnIndicator;
    const fade = clamp(spawnIndicator / .65, 0, 1);
    const pulse = (Math.sin(age * 8) + 1) / 2;
    const pulse2 = (Math.sin(age * 8 + Math.PI) + 1) / 2;

    ctx.save();
    ctx.globalAlpha = fade;

    // Dois anéis pulsantes para localizar rapidamente o personagem.
    ctx.strokeStyle = "rgba(255,232,92,.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, sy-3, 24 + pulse*8, 0, Math.PI*2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, sy-3, 32 + pulse2*8, 0, Math.PI*2);
    ctx.stroke();

    // Seta animada acima do player.
    const bob = Math.sin(age*9)*4;
    const arrowY = sy - 64 + bob;
    ctx.fillStyle = "#ffe75c";
    ctx.beginPath();
    ctx.moveTo(player.x, arrowY + 16);
    ctx.lineTo(player.x - 8, arrowY);
    ctx.lineTo(player.x + 8, arrowY);
    ctx.closePath();
    ctx.fill();

    // Etiqueta em pixel-style.
    ctx.font = "900 11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,.72)";
    ctx.strokeText("VOCÊ", player.x, arrowY - 8);
    ctx.fillStyle = "#fff7b0";
    ctx.fillText("VOCÊ", player.x, arrowY - 8);

    ctx.restore();
  }

  function drawPlayer(){
    const sy=screenY(player.y);

    ctx.save();
    if(invisibilityTimer>0){
      // O jogador ainda se enxerga, mas de forma fantasmagórica.
      ctx.globalAlpha=.28 + Math.sin(elapsed*8)*.07;
    }
    drawPerson(player.x,sy,1,false,true);
    ctx.restore();

    if(shieldPulseTimer>0){
      const progress=1-shieldPulseTimer/.45;
      const radius=24+progress*128;
      ctx.save();
      ctx.globalAlpha=1-progress;
      ctx.strokeStyle="#79aaff";
      ctx.lineWidth=4;
      ctx.beginPath();
      ctx.arc(player.x,sy-3,radius,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    if(powerPickupFlash>0){
      ctx.save();
      ctx.globalAlpha=powerPickupFlash/.22;
      ctx.strokeStyle="#fff6a8";
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.arc(player.x,sy-3,24+(1-powerPickupFlash/.22)*16,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    // marker permanente discreto
    ctx.fillStyle=alert?"#ff4c4c":"#fff";
    ctx.beginPath();
    ctx.moveTo(player.x,sy-40);
    ctx.lineTo(player.x-8,sy-48);
    ctx.lineTo(player.x+8,sy-48);
    ctx.closePath();ctx.fill();
  }

  function drawDanger(){
    const y = H-6;
    ctx.fillStyle=alert?"#6b1010":"#402218";
    ctx.fillRect(0,y,W,6);
    ctx.globalAlpha=.32;
    ctx.fillStyle="#ff5a42";
    for(let x=-20;x<W+30;x+=24){
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+10,y);ctx.lineTo(x+20,H);ctx.lineTo(x+10,H);ctx.closePath();ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  function backgroundKey(){
    return Math.floor(cameraY / 32);
  }

  function drawForeground(context){
    ctx = context;
    drawDecor();
    for(const cop of cops) drawCone(cop);
    drawCameraCones();
    drawObstacles();
    drawCameras();
    drawPowerUps();
    drawNPCs();
    drawCops();
    drawPlayer();
    drawSpawnIndicator();
    drawDanger();

    if(timeFreezeTimer>0 && started){
      ctx.save();
      ctx.fillStyle="rgba(190,220,255,.055)";
      ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(255,209,102,.38)";
      ctx.lineWidth=3;
      ctx.strokeRect(7.5,7.5,W-15,H-15);
      ctx.restore();
    }

    if(alert && started){
      ctx.save();

      const strobeBlue = Math.floor(elapsed * 7) % 2 === 0;
      const primary = strobeBlue ? "rgba(55,105,255,.62)" : "rgba(255,55,70,.62)";
      const secondary = strobeBlue ? "rgba(255,55,70,.28)" : "rgba(55,105,255,.28)";

      // Contorno principal piscando como luzes de viatura.
      ctx.strokeStyle=primary;
      ctx.lineWidth=7;
      ctx.strokeRect(3.5,3.5,W-7,H-7);

      // Segunda borda mais suave, na cor oposta.
      ctx.strokeStyle=secondary;
      ctx.lineWidth=3;
      ctx.strokeRect(10.5,10.5,W-21,H-21);

      // Flashes nos cantos superiores.
      ctx.fillStyle=strobeBlue ? "rgba(55,105,255,.35)" : "rgba(255,55,70,.35)";
      ctx.fillRect(0,0,W*.32,20);
      ctx.fillStyle=strobeBlue ? "rgba(255,55,70,.35)" : "rgba(55,105,255,.35)";
      ctx.fillRect(W*.68,0,W*.32,20);

      ctx.restore();
    }
  }

  function draw(context){
    ctx = context;
    drawBackground();
    drawForeground(context);
  }



  function snapshot(){
    return {
      width: W, height: H, started, paused, gameOver, reason, difficulty,
      allowsPause: allowsPause(),
      elapsed, time: fmt(elapsed), best, bestTime: fmt(best),
      distance: distanceMeters(), screenDistance: screenDistanceMeters(),
      distanceLabel: fmtDistance(distanceMeters()), screenDistanceLabel: fmtDistance(screenDistanceMeters()),
      suspicion, alert, bustedTimer, pursuitEscapeTimer, pursuitGraceTimer,
      escapeTarget: pursuitEscapeTarget(),
      inventory: [...inventory],
      runStats: {
        ...runStats,
        dirsInEscape: [...runStats.dirsInEscape],
        pickedTypes: [...runStats.pickedTypes],
        usedTypes: [...runStats.usedTypes],
      },
      player: {x: player.x, y: player.y}, cameraY,
      effects: [
        ["IMUNE", escapeImmunityTimer, "#f6d64a"],
        ["SABÃO", soapTimer, "#64d9ff"],
        ["PATINS", skatesTimer, "#ff8bd5"],
        ["MOISÉS", staffTimer, "#e9c878"],
        ["INVISÍVEL", invisibilityTimer, "#b9a7ff"],
        ["TEMPO PARADO", timeFreezeTimer, "#ffd166"]
      ].filter(([,t]) => t > 0).map(([label,remaining,color]) => ({label,remaining,color}))
    };
  }

  reset();
  return {
    start, setPaused, togglePause, usePowerUp, draw, drawBackground, drawForeground,
    backgroundKey, snapshot, allowsPause,
    isPlaying: () => started && !paused && !gameOver,
    describeDifficulty: difficultyDescription,
    powers: POWER_TYPES,
    step(dt){
      if(!Number.isFinite(dt) || dt < 0) throw new Error("Delta inválido");
      update(Math.min(dt, 1/30));
    },
    setInput(x,y){
      input.active = started && !paused && !gameOver;
      input.x = Number.isFinite(x) ? clamp(x,-1,1) : 0;
      input.y = Number.isFinite(y) ? clamp(y,-1,1) : 0;
    },
    setBest(value){
      if(Number.isFinite(value)) best = Math.max(best, value);
    }
  };
}
