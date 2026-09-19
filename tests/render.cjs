// Real Skia/CanvasKit offscreen smoke test. This is not a native-device test.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
async function main() {
  const packageRoot = path.dirname(require.resolve('@shopify/react-native-skia/package.json'));
  const { LoadSkiaWeb } = require(path.join(packageRoot, 'lib/commonjs/web/LoadSkiaWeb.js'));
  await LoadSkiaWeb();
  const { JsiSkApi } = require(path.join(packageRoot, 'lib/commonjs/skia/web/JsiSkia.js'));
  const Skia = JsiSkApi(global.CanvasKit);
  const enums = require(path.join(packageRoot, 'lib/commonjs/skia/types/index.js'));
  const fontPath = process.env.DESPISTA_TEST_FONT;
  if (!fontPath) throw new Error('Set DESPISTA_TEST_FONT to a local .ttf font for the offscreen test.');
  const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(fs.readFileSync(fontPath)));
  const context = {
    exports: {},
    require(name) {
      if (name === 'react-native') return {Platform:{OS:'android'}};
      if (name === '@shopify/react-native-skia') return {...enums,Skia,matchFont:({fontSize})=>Skia.Font(typeface,fontSize)};
      throw new Error(name);
    },
  };
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/render/SkiaContext.ts'),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(context.require, context.exports);
  const { SkiaContext } = context.exports;
  const engineContext = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/game/engine.js'),'utf8')
    .replace('export function createGame','function createGame')+
    '\nglobalThis.createGame=createGame;',engineContext);
  let seed = 1234;
  const game=engineContext.createGame({random: () => {
    seed = Math.imul(1664525, seed) + 1013904223 | 0;
    return (seed >>> 0) / 4294967296;
  }});
  game.start('impossible');
  const surface=Skia.Surface.Make(420,780);
  assert.ok(surface);
  const startedAt = performance.now();
  for(let frame=0;frame<120;frame++) {
    game.setInput(0,-1);game.step(1/60);
    const recorder=Skia.PictureRecorder();
    const canvas=recorder.beginRecording(Skia.XYWHRect(0,0,420,780));
    const ctx=new SkiaContext(canvas);game.draw(ctx);ctx.dispose();
    const picture=recorder.finishRecordingAsPicture();
    surface.getCanvas().drawPicture(picture);surface.flush();
    picture.dispose();recorder.dispose();
  }
  const renderMs = performance.now() - startedAt;
  const image=surface.makeImageSnapshot();
  const output=process.env.DESPISTA_RENDER_OUTPUT || '/tmp/despista-scene.png';
  fs.writeFileSync(output,Buffer.from(image.encodeToBytes()));
  assert.ok(fs.statSync(output).size>5000);
  image.dispose();surface.dispose();
  console.log('Rendered 120 frames using real Skia APIs:',output);
  console.log(`Offscreen CPU benchmark: ${renderMs.toFixed(1)} ms total, ${(renderMs / 120).toFixed(2)} ms/frame (not device FPS)`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
