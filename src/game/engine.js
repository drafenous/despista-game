/**
 * Motor portado do MVP v44. Sem DOM, timers globais ou armazenamento.
 * Coordenadas de mundo: y cresce para cima. Input touch: y cresce para baixo.
 * Os desenhos recebem um contexto compatível implementado sobre Skia nativo.
 */
/**
 * @param {{width?: number, height?: number, initialBest?: number,
 * random?: () => number, onBest?: (best: number) => void}} options
 */
export function createGame({width = 420, height = 780, initialBest = 0,
  random = Math.random, onBest = () => {}} = {}) {
  const W = width, H = height;
  let ctx;
  let reason = null;
  let cameraY = 0;
  let generatedUntil = 0;
  let elapsed = 0;
  let distanceTravelledUnits = 0;
  let screenDistanceTravelledUnits = 0;
  let lastMeasuredCameraY = 0;
  const DISTANCE_UNITS_PER_METER = 20;
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
  let powerPickupFlash = 0;
  let powerPickupCooldown = 0;

  const inventory = [];
  const powerUps = [];

  let powerBag = [];
  let chunksSincePowerUp = 0;
  let lastPowerType = null;
  let lastPowerSpawnY = -Infinity;

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
    x: W/2, y: 0, r: 10, speed: 185, vx:0, vy:0
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
      hard:"Como o Médio, porém a tela sobe automaticamente devagar.",
      pro:"Como o Difícil, com 10% mais policiais em tela.",
      impossible:"Como o Pro, mas a perseguição é permanente. O objetivo é sobreviver o máximo possível."
    }[value];
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
    paused = !!value;
    keys.clear();
    input.active = false;
    input.x = input.y = 0;
  }
  function togglePause(){ setPaused(!paused); }

  function clearPursuit(){
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

    const repel=(entity,extraPush=0)=>{
      let dx=entity.x-player.x;
      let dy=entity.y-player.y;
      let d=Math.hypot(dx,dy);
      if(d>radius) return;
      if(d<.001){ dx=1;dy=0;d=1; }

      const push=58 + (1-d/radius)*48 + extraPush;
      entity.x=clamp(entity.x+(dx/d)*push,18,W-18);
      entity.y+=(dy/d)*push;
      entity.stunTimer=1;

      for(const o of obstacles){
        if(Math.abs((o.y+o.h/2)-entity.y)>70) continue;
        resolveCircleRect(entity,o,1);
      }
    };

    for(const npc of npcs) repel(npc);
    for(const cop of cops) repel(cop,12);
  }

  function usePowerUp(slotIndex){
    if(!started || gameOver || paused) return;
    const type=inventory[slotIndex];
    if(!type) return;

    if(type==="escape"){
      clearPursuit();
      escapeImmunityTimer=3;
      // No Impossível, a perseguição volta somente quando a imunidade acabar.
      impossiblePursuitStarted=false;
    }else if(type==="soap"){
      soapTimer=5;
    }else if(type==="skates"){
      skatesTimer=10;
    }else if(type==="staff"){
      staffTimer=5;
    }else if(type==="invis"){
      invisibilityTimer=10;
    }else if(type==="teleport"){
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
    }

    inventory.splice(slotIndex,1);


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

      const probe={x,y,r:14};
      if(obstacles.some(o => Math.abs((o.y+o.h/2)-y)<60 && circleIntersectsRect(probe,o))) continue;
      if(cops.some(c => dist(c.x,c.y,x,y)<48)) continue;
      if(npcs.some(n => dist(n.x,n.y,x,y)<36)) continue;
      if(powerUps.some(p => dist(p.x,p.y,x,y)<95)) continue;

      powerUps.push({
        x,y,type,r:13,
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

  function spawnNPC(y){
    const horizontal = random() < .5;
    const sign = random() < .5 ? -1 : 1;
    const speed = rand(24,48);

    let x = rand(24,W-24);
    let spawnY = y;

    // Durante o começo do mapa, evita qualquer NPC grudado no player.
    for(let attempt=0; attempt<12 && isInsidePlayerSpawnSafeZone(x,spawnY,12); attempt++){
      x = rand(24,W-24);
      spawnY = y + rand(-26,26);
    }

    if(isInsidePlayerSpawnSafeZone(x,spawnY,12)){
      spawnY = 40 + 100;
    }

    npcs.push({
      x, y:spawnY,
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
    const horizontal = random() < .5;
    const sign = random() < .5 ? -1 : 1;
    const s = rand(34,52);

    let spawnY = y;

    // No início da partida, policiais só podem aparecer na metade superior da tela.
    if(elapsed < 1.0 && cameraY < 10){
      spawnY = Math.max(spawnY, initialPoliceMinWorldY() + rand(0,90));
    }

    cops.push({
      x: rand(34,W-34), y:spawnY,
      vx: horizontal ? sign*s : 0,
      vy: horizontal ? 0 : sign*s,
      axis: horizontal ? "h" : "v",
      r:10,
      dangerRadius:22,
      face: horizontal
        ? (sign < 0 ? Math.PI : 0)
        : (sign < 0 ? -Math.PI/2 : Math.PI/2),
      vision: rand(125,165),
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
      const sweep = Math.sin(elapsed*camera.sweepSpeed + camera.phase) * (Math.PI/2);
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

      if(isInsidePlayerSpawnSafeZone(x,y,72)) continue;

      const probe={x,y,r:12};
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
        r:9,
        mode,
        face,
        baseFace,
        vision:rand(135,170),
        fov:Math.PI/3.1,
        phase:rand(0,Math.PI*2),
        sweepSpeed:rand(.65,1.05),
        rotationDir:random()<.5 ? -1 : 1,
        rotationSpeed:rand(.55,.9),
        seeingPlayer:false
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
    const types = [
      {type:"bench", w:54, h:20},
      {type:"trash", w:24, h:24},
      {type:"planter", w:34, h:34},
      {type:"barrier", w:62, h:18},
      {type:"crate", w:30, h:30}
    ];

    for(let attempt=0; attempt<12; attempt++){
      const spec = types[Math.floor(random()*types.length)];
      const x = rand(22, Math.max(23, W-spec.w-22));
      const y = startY + rand(28, chunkH-spec.h-24);

      // Nunca gera obstáculos no ponto de spawn do jogador.
      if(rectTouchesPlayerSpawnSafeZone(x,y,spec.w,spec.h,10)) continue;

      // Evita bloquear totalmente a passagem e concentra os objetos nas laterais/miolo.
      if(overlapsObstacleArea(x,y,spec.w,spec.h,14)) continue;

      obstacles.push({
        x, y,
        w: spec.w,
        h: spec.h,
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
    const chunkH = 220;
    const cfg = difficultyConfig();
    const npcCount = Math.max(1, Math.floor(rand(10,16) * cfg.npcMultiplier));
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
    const target = cameraY + H + 420;
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
    return alert ? cop.dangerRadius + 12 : cop.dangerRadius;
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
    powerPickupFlash=Math.max(0,powerPickupFlash-dt);
    powerPickupCooldown=Math.max(0,powerPickupCooldown-dt);

    const v = inputVector();
    const density = crowdDensity();

    const isPlayerTryingToMove = Math.abs(v.x) > 0 || Math.abs(v.y) > 0;

    if(isPlayerTryingToMove){
      playerIdleTimer = 0;
      if(idleHunterCop) idleHunterCop.avoidTimer = 0;
      idleHunterCop = null;
    }else if(!alert){
      playerIdleTimer += dt;

      // Depois de 3 segundos parado, o policial mais próximo em tela
      // abandona temporariamente a patrulha e vai na direção do player.
      if(playerIdleTimer >= 3 && !idleHunterCop){
        idleHunterCop = nearestOnScreenCop();
      }
    }

    // A multidão influencia apenas a visibilidade.
    // Ficar perto de NPCs não reduz mais a velocidade do player.
    const playerSpeedMultiplier = skatesTimer>0 ? 1.5 : 1;
    player.vx = v.x * player.speed * playerSpeedMultiplier;
    player.vy = v.y * player.speed * playerSpeedMultiplier;

    const previousPlayerX = player.x;
    const previousPlayerY = player.y;

    player.x = clamp(player.x + player.vx*dt, 14, W-14);
    player.y += player.vy*dt;

    // Colisão seca com obstáculos fixos:
    // se tentou entrar no objeto, cancela todo o movimento daquele frame.
    let playerBlocked = false;

    for(const o of obstacles){
      if(Math.abs((o.y+o.h/2)-player.y) > 70) continue;
      if(circleIntersectsRect(player,o)){
        playerBlocked = true;
        break;
      }
    }

    // NPCs funcionam como barreiras, mas sem "grudar" o player.
    // Bloqueia somente se o movimento atual estiver aproximando/entrando no NPC.
    if(!playerBlocked && soapTimer<=0){
      for(const npc of npcs){
        if(Math.abs(npc.y-player.y)>32) continue;

        const contact = npc.r + player.r;
        const previousDistance = dist(npc.x,npc.y,previousPlayerX,previousPlayerY);
        const candidateDistance = dist(npc.x,npc.y,player.x,player.y);

        if(candidateDistance < contact && candidateDistance <= previousDistance + 0.001){
          playerBlocked = true;
          break;
        }
      }
    }

    // O corpo do policial é uma hitbox física sólida.
    // A dangerRadius continua sendo apenas a área de BUSTED.
    if(!playerBlocked){
      for(const cop of cops){
        if(Math.abs(cop.y-player.y)>40) continue;

        const bodyRadius = cop.r + 2;
        const previousDistance = dist(cop.x,cop.y,previousPlayerX,previousPlayerY);
        const candidateDistance = dist(cop.x,cop.y,player.x,player.y);
        const contact = bodyRadius + player.r;

        if(candidateDistance < contact && candidateDistance <= previousDistance + 0.001){
          playerBlocked = true;
          break;
        }
      }
    }

    if(playerBlocked){
      player.x = previousPlayerX;
      player.y = previousPlayerY;
      player.vx = 0;
      player.vy = 0;
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
      if(npc.x<14){
        npc.x=14;
        if(npc.axis==="h") npc.vx=Math.abs(npc.vx);
      }
      if(npc.x>W-14){
        npc.x=W-14;
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
      if(circlesOverlap(cop.x,cop.y,cop.r+2,player.x,player.y,player.r)){
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

      if(cop.x<18){
        cop.x=18;
        if(cop.axis==="h") cop.vx=Math.abs(cop.vx);
      }
      if(cop.x>W-18){
        cop.x=W-18;
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
    for(const camera of cameras){
      camera.seeingPlayer=false;

      // Rotação 360º: direção definida no spawn e mantida para sempre.
      if(camera.mode==="rotate"){
        camera.face += camera.rotationDir * camera.rotationSpeed * dt;
        camera.face = Math.atan2(Math.sin(camera.face),Math.cos(camera.face));
      }

      if(!alert && pointInCameraVision(camera,player.x,player.y)){
        camera.seeingPlayer=true;

        const d=dist(camera.x,camera.y,player.x,player.y);
        const crowdCover=clamp(density*.13,0,.62);
        const distanceFactor=1-clamp(d/camera.vision,0,.75)*.38;

        // Mesmo ritmo-base de reconhecimento utilizado pelos policiais.
        suspicion += 72 * distanceFactor * (1-crowdCover) * dt;
        seen=true;
      }
    }

    if(idleHunterCop && !alert){
      const hunterScreenY = screenY(idleHunterCop.y);
      if(hunterScreenY < -30 || hunterScreenY > H + 30){
        idleHunterCop = nearestOnScreenCop();
      }
    }

    if(touchingPolice){
      bustedTimer += dt;

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

    if(suspicion>=100 && !alert && escapeImmunityTimer<=0){
      alert = true;
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
        powerUps.splice(i,1);
        powerPickupFlash=.22;
        powerPickupCooldown=.45;

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

    for(let i=cameras.length-1;i>=0;i--) if(cameras[i].y<minY) cameras.splice(i,1);
    for(let i=decor.length-1;i>=0;i--) if(decor[i].y<minY) decor.splice(i,1);
    for(let i=obstacles.length-1;i>=0;i--) if(obstacles[i].y+obstacles[i].h<minY) obstacles.splice(i,1);
    for(let i=powerUps.length-1;i>=0;i--) if(powerUps[i].y<minY) powerUps.splice(i,1);


  }



  function drawBackground(){
    ctx.fillStyle="#1f2630";
    ctx.fillRect(0,0,W,H);

    // sidewalk tiles
    const tile=32;
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
      const pursuit = ctx.createRadialGradient(x,y,4,x,y,r);
      pursuit.addColorStop(0,"rgba(255,255,255,.34)");
      pursuit.addColorStop(.68,"rgba(255,255,255,.20)");
      pursuit.addColorStop(1,"rgba(255,255,255,.055)");

      ctx.fillStyle=pursuit;
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.arc(x,y,r,a1,a2,false);
      ctx.closePath();
      ctx.fill();

    }else{
      // Feixe normal de patrulha/suspeita.
      const p = cop.seeingPlayer ? clamp(suspicion/100, 0, 1) : 0;
      const red = 244;
      const green = Math.round(205 - 145*p);
      const blue = Math.round(72 - 35*p);

      const base = ctx.createRadialGradient(x,y,5,x,y,r);
      base.addColorStop(0,"rgba(255,224,104,.22)");
      base.addColorStop(1,"rgba(255,224,104,.025)");
      ctx.fillStyle=base;
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.arc(x,y,r,a1,a2,false);
      ctx.closePath();
      ctx.fill();

      if(cop.seeingPlayer && p > 0){
        const chargedR = Math.max(18, r*p);
        const charged = ctx.createRadialGradient(x,y,3,x,y,chargedR);
        charged.addColorStop(0,`rgba(${red},${green},${blue},.48)`);
        charged.addColorStop(.72,`rgba(${red},${green},${blue},.28)`);
        charged.addColorStop(1,`rgba(${red},${green},${blue},.03)`);
        ctx.fillStyle=charged;
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
    // pixel body
    const skin=["#f1c7a2","#c98f66","#8e5e42","#e1aa7d","#6b4937"][tone%5];

    // shadow
    ctx.fillStyle="#0005";ctx.fillRect(Math.round(x-8),Math.round(sy+10),16,5);

    // legs
    ctx.fillStyle=playerChar?"#1f1f24":police?"#18283a":"#26313d";
    ctx.fillRect(Math.round(x-6),Math.round(sy+3),5,10);
    ctx.fillRect(Math.round(x+1),Math.round(sy+3),5,10);

    // torso
    if(playerChar){
      // roupa listrada de bandido
      ctx.fillStyle="#f4f4f4";
      ctx.fillRect(Math.round(x-7),Math.round(sy-8),14,13);
      ctx.fillStyle="#111";
      ctx.fillRect(Math.round(x-7),Math.round(sy-8),14,2);
      ctx.fillRect(Math.round(x-7),Math.round(sy-4),14,2);
      ctx.fillRect(Math.round(x-7),Math.round(sy),14,2);
      ctx.fillRect(Math.round(x-7),Math.round(sy+4),14,1);
      // listras verticais sutis para lembrar uniforme clássico
      ctx.fillRect(Math.round(x-4),Math.round(sy-8),2,13);
      ctx.fillRect(Math.round(x+1),Math.round(sy-8),2,13);
    }else{
      ctx.fillStyle=police?"#3e79a8":["#6f8f5a","#9e5f79","#8a774e","#5b7c9e","#795b9b"][tone%5];
      ctx.fillRect(Math.round(x-7),Math.round(sy-8),14,13);
    }

    // head
    ctx.fillStyle=skin;
    ctx.fillRect(Math.round(x-5),Math.round(sy-17),10,9);

    // hair/hat
    if(playerChar){
      // gorrinho/boina escura
      ctx.fillStyle="#111";
      ctx.fillRect(Math.round(x-6),Math.round(sy-20),12,4);
      ctx.fillRect(Math.round(x-4),Math.round(sy-17),8,1);
    }else{
      ctx.fillStyle=police?"#1e3045":"#3a3029";
      ctx.fillRect(Math.round(x-5),Math.round(sy-19),10,3);
      if(police){
        ctx.fillStyle="#6ca1cc";ctx.fillRect(Math.round(x-7),Math.round(sy-21),14,3);
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

    const base=ctx.createRadialGradient(x,y,4,x,y,r);
    base.addColorStop(0,"rgba(95,190,255,.24)");
    base.addColorStop(.72,"rgba(95,190,255,.12)");
    base.addColorStop(1,"rgba(95,190,255,.025)");

    ctx.fillStyle=base;
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

      const charged=ctx.createRadialGradient(x,y,3,x,y,chargedR);
      charged.addColorStop(0,`rgba(${red},${green},${blue},.46)`);
      charged.addColorStop(.72,`rgba(${red},${green},${blue},.24)`);
      charged.addColorStop(1,`rgba(${red},${green},${blue},.025)`);

      ctx.fillStyle=charged;
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
      ctx.arc(0,0,18,0,Math.PI*2);
      ctx.fill();

      ctx.fillStyle="#0b1020";
      ctx.fillRect(-13,-13,26,26);
      ctx.strokeStyle=inventoryFull ? "#888" : def.color;
      ctx.lineWidth=2;
      ctx.strokeRect(-13,-13,26,26);

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
        ctx.fillRect(-15,15,30,10);
        ctx.fillStyle="#b8bec8";
        ctx.font="900 7px ui-monospace, monospace";
        ctx.fillText("CHEIO",0,20);
      }

      ctx.restore();
    }
  }

  function drawNPCs(){
    for(const npc of npcs){
      const sy=screenY(npc.y);
      if(sy<-40||sy>H+40) continue;
      drawPerson(npc.x,sy,npc.tone,false,false);
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
        ctx.beginPath();ctx.arc(cop.x,sy-3,17,0,Math.PI*2);ctx.stroke();

        // Pequenos flashes laterais simulando giroflex.
        ctx.fillStyle=strobeBlue ? "#3f7cff" : "#ff3f4f";
        ctx.fillRect(Math.round(cop.x-12),Math.round(sy-26),8,4);
        ctx.fillStyle=strobeBlue ? "#ff3f4f" : "#3f7cff";
        ctx.fillRect(Math.round(cop.x+4),Math.round(sy-26),8,4);
      }
      if(cop === idleHunterCop && !alert && playerIdleTimer >= 3){
        ctx.save();
        ctx.font="900 12px ui-monospace, monospace";
        ctx.textAlign="center";
        ctx.lineWidth=3;
        ctx.strokeStyle="rgba(0,0,0,.7)";
        ctx.strokeText("!",cop.x,sy-31);
        ctx.fillStyle="#ffd45a";
        ctx.fillText("!",cop.x,sy-31);
        ctx.restore();
      }

      drawPerson(cop.x,sy,2,true,false);

      // facing marker
      ctx.fillStyle=alert?"#ff4444":"#f3cf55";
      const fx=Math.cos(cop.face)*12;
      const fy=-Math.sin(cop.face)*12;
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
    ctx.arc(player.x, sy-3, 21 + pulse*11, 0, Math.PI*2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, sy-3, 31 + pulse2*10, 0, Math.PI*2);
    ctx.stroke();

    // Seta animada acima do player.
    const bob = Math.sin(age*9)*4;
    const arrowY = sy - 54 + bob;
    ctx.fillStyle = "#ffe75c";
    ctx.beginPath();
    ctx.moveTo(player.x, arrowY + 12);
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
    ctx.strokeText("VOCÊ", player.x, arrowY - 5);
    ctx.fillStyle = "#fff7b0";
    ctx.fillText("VOCÊ", player.x, arrowY - 5);

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
      const radius=25+progress*125;
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
      ctx.arc(player.x,sy-3,24+(1-powerPickupFlash/.22)*18,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    // marker permanente discreto
    ctx.fillStyle=alert?"#ff4c4c":"#fff";
    ctx.beginPath();
    ctx.moveTo(player.x,sy-31);
    ctx.lineTo(player.x-5,sy-39);
    ctx.lineTo(player.x+5,sy-39);
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

  function draw(context){
    ctx = context;
    drawBackground();
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



  function snapshot(){
    return {
      width: W, height: H, started, paused, gameOver, reason, difficulty,
      elapsed, time: fmt(elapsed), best, bestTime: fmt(best),
      distance: distanceMeters(), screenDistance: screenDistanceMeters(),
      distanceLabel: fmtDistance(distanceMeters()), screenDistanceLabel: fmtDistance(screenDistanceMeters()),
      suspicion, alert, bustedTimer, pursuitEscapeTimer, pursuitGraceTimer,
      escapeTarget: pursuitEscapeTarget(),
      inventory: [...inventory],
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
    start, setPaused, togglePause, usePowerUp, draw, snapshot,
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
