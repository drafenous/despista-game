const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const engine = fs.readFileSync(path.join(root, 'src/game/engine.js'), 'utf8');
function rng(seed = 1234) {
  return () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
}
function makeGame(options = {}) {
  const context = vm.createContext({});
  // Test-only fixture injection: production engine exposes no mutation/debug APIs.
  const source = engine.replace('export function createGame', 'function createGame').replace(
    /start, setPaused, togglePause, usePowerUp, draw, drawBackground, drawForeground,\r?\n\s*backgroundKey, snapshot,/,
    `start, setPaused, togglePause, usePowerUp, draw, drawBackground, drawForeground,
    backgroundKey, snapshot,
     fixture(fn) { fn({player, cops, npcs, obstacles, cameras, inventory, powerUps}); },`);
  vm.runInContext(source + '\nglobalThis.createGame = createGame;', context);
  return context.createGame({ random: rng(), ...options });
}
function original() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: 'medium', style: {}, textContent: '', innerHTML: '',
      classList: { add(){}, remove(){}, toggle(){} },
      setAttribute(){}, addEventListener(){}, querySelector(name){ return element(id + name); },
      getBoundingClientRect(){ return {width:360,height:640}; },
      getContext(){ return {setTransform(){}}; },
    });
    return elements.get(id);
  }
  const html = fs.readFileSync(path.join(__dirname, 'original-v44.html'), 'utf8');
  let script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  script = script.replace('})();', `
    globalThis.original = {
      start(mode){ difficultyEl.value=mode; start(); },
      step:update,
      setInput(x,y){input.active=true;input.x=x;input.y=y;},
      snapshot(){return {elapsed, suspicion, alert, bustedTimer, pursuitEscapeTimer,
        player:{x:player.x,y:player.y},cameraY,gameOver,
        distance:distanceMeters(),screenDistance:screenDistanceMeters(),inventory:[...inventory]};}
    };
  })();`);
  const math = Object.create(Math); math.random = rng();
  const context = vm.createContext({
    Math: math, performance: {now:()=>0}, requestAnimationFrame(){},
    document: {getElementById:element, querySelectorAll:()=>[element('s0'),element('s1'),element('s2')]},
    window: {devicePixelRatio:1,addEventListener(){}},
    localStorage: {getItem:()=>null,setItem(){}},
  });
  vm.runInContext(script, context);
  return context.original;
}
function comparable(snapshot) {
  const keys = ['elapsed','suspicion','alert','bustedTimer','pursuitEscapeTimer','player','cameraY',
    'gameOver','distance','screenDistance','inventory'];
  return JSON.parse(JSON.stringify(Object.fromEntries(keys.map(k=>[k,snapshot[k]]))));
}
for (const mode of ['easy','medium','hard','pro','impossible']) {
  // Port adds crowd separation / on-screen caps beyond v44; bit-exact parity no longer holds.
  test.skip('parity with original v44: ' + mode, () => {
    const a = original(), b = makeGame();
    for (let run=0;run<3;run++) {
      a.start(mode); b.start(mode);
      for(let frame=0;frame<1800;frame++) {
        const direction = [[0,-1],[1,0],[0,-1],[-1,0],[0,0]][Math.floor(frame/75)%5];
        a.setInput(...direction); b.setInput(...direction);
        a.step(1/60); b.step(1/60);
        assert.deepEqual(comparable(b.snapshot()),comparable(a.snapshot()),'frame '+frame);
        if(a.snapshot().gameOver) break;
      }
    }
  });
}
test('pause freezes simulation, rejects items, and clears stale movement on restart', () => {
  const game = makeGame(); game.start();
  game.fixture(({inventory}) => inventory.push('skates'));
  game.setInput(1,0); game.setPaused(true);
  const before = JSON.stringify(game.snapshot());
  game.step(1/60); game.usePowerUp(0);
  assert.equal(JSON.stringify(game.snapshot()),before);
  game.setPaused(false); game.start(); game.step(1/60);
  assert.equal(game.snapshot().player.x,180);
});
test('hard and above refuse pause from API and keep simulation running', () => {
  for (const mode of ['hard', 'pro', 'impossible']) {
    const game = makeGame(); game.start(mode);
    assert.equal(game.allowsPause(), false);
    assert.equal(game.snapshot().allowsPause, false);
    game.setPaused(true);
    assert.equal(game.snapshot().paused, false);
    const before = game.snapshot().elapsed;
    game.step(1/60);
    assert.ok(game.snapshot().elapsed > before);
  }
});
test('easy and medium still allow pause', () => {
  for (const mode of ['easy', 'medium']) {
    const game = makeGame(); game.start(mode);
    assert.equal(game.allowsPause(), true);
    game.setPaused(true);
    assert.equal(game.snapshot().paused, true);
  }
});
test('all eight powers activate and consume exactly one slot', () => {
  for(const type of ['escape','soap','skates','staff','invis','teleport','shield','time']) {
    const game = makeGame(); game.start('impossible');
    game.fixture(({inventory}) => inventory.push(type));
    const before = game.snapshot();
    game.usePowerUp(0);
    const after = game.snapshot();
    assert.equal(after.inventory.length,0);
    if(type==='escape') assert.equal(after.alert,false);
    else if(type==='teleport') { assert.ok(after.player.y > before.player.y); assert.equal(after.distance,before.distance); }
    else if(type!=='shield') assert.equal(after.effects.length,1);
  }
});
test('freeze does not restart NPCs with an expired patrol timer', () => {
  const game = makeGame(); game.start();
  let npc;
  game.fixture(state => {
    state.inventory.push('time');
    npc = state.npcs[0]; npc.x=70; npc.y=400; npc.turn=-1;
    state.obstacles.length=0;
  });
  game.usePowerUp(0);
  const {x,y} = npc;
  game.step(1/60);
  assert.equal(npc.x,x); assert.equal(npc.y,y);
});
test('inventory caps at three; full inventory leaves pickups in world', () => {
  const game = makeGame(); game.start();
  game.fixture(({inventory,powerUps,player})=>{
    inventory.push('soap','skates','invis');
    powerUps.splice(0,powerUps.length,{x:player.x,y:player.y,type:'shield',r:16,phase:0});
  });
  game.step(1/60);
  assert.equal(game.snapshot().inventory.length,3);
  game.fixture(({powerUps}) => assert.equal(powerUps.length,1));
});
test('capture at 1.5s saves record once and restart resets run', () => {
  const saved=[]; const game=makeGame({onBest:value=>saved.push(value)});
  game.start();
  game.fixture(({npcs,obstacles,cameras,cops,player})=>{
    npcs.length=obstacles.length=cameras.length=0;
    cops.splice(1);
    Object.assign(cops[0],{x:player.x+30,y:player.y,stunTimer:10,vision:0,dangerRadius:40});
  });
  for(let i=0;i<100;i++) game.step(1/60);
  assert.equal(game.snapshot().reason,'caught');
  assert.equal(saved.length,1);
  assert.ok(saved[0]>=1.5);
  game.start();
  assert.equal(game.snapshot().elapsed,0); assert.equal(game.snapshot().gameOver,false);
  assert.equal(game.snapshot().best,saved[0]);
});
test('bottom boundary survives on easy and ends hard run', () => {
  for(const mode of ['easy','hard']) {
    const game=makeGame(); game.start(mode);
    game.fixture(({player,cops,npcs,obstacles,cameras})=>{
      cops.length=npcs.length=obstacles.length=cameras.length=0; player.y=-200;
    });
    game.step(1/60);
    assert.equal(game.snapshot().gameOver,mode==='hard');
    if(mode==='hard') assert.equal(game.snapshot().reason,'behind');
  }
});
test('obstacles spawn snapped to SQM grid with integer cell hitboxes', () => {
  const SQM = 32;
  const onGrid = (n) => Number.isInteger(n / SQM);
  const game = makeGame();
  game.start('medium');
  // Gera mais mundo para ter uma amostra boa de obstáculos.
  for (let i = 0; i < 180; i++) game.step(1 / 60);
  game.fixture(({ obstacles }) => {
    assert.ok(obstacles.length > 0, 'expected spawned obstacles');
    for (const o of obstacles) {
      assert.ok(onGrid(o.x), `x not on grid: ${o.x}`);
      assert.ok(onGrid(o.y), `y not on grid: ${o.y}`);
      assert.ok(onGrid(o.w), `w not SQM multiple: ${o.w}`);
      assert.ok(onGrid(o.h), `h not SQM multiple: ${o.h}`);
      assert.ok(o.w >= SQM && o.h >= SQM, `hitbox smaller than 1 SQM: ${o.w}x${o.h}`);
    }
  });
});
test('draw uses supported context operations and balances save/restore', () => {
  const game=makeGame(); game.start('impossible');
  const methods=['fillRect','strokeRect','beginPath','moveTo','lineTo','quadraticCurveTo','closePath',
    'arc','roundRect','fill','stroke','translate','rotate','scale','setLineDash','fillText','strokeText'];
  let depth=0,calls=0;
  const ctx=Object.fromEntries(methods.map(name=>[name,()=>{calls++;}]));
  ctx.save=()=>depth++;ctx.restore=()=>{assert.ok(depth>0);depth--;};
  ctx.createRadialGradient=()=>({addColorStop(){}});
  game.draw(ctx);assert.equal(depth,0);assert.ok(calls>100);
});
