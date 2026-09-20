import { Platform } from 'react-native';
import { matchFont, Skia, PaintStyle, StrokeCap, StrokeJoin, TileMode,
  type SkCanvas, type SkPathBuilder, type SkFont, type SkColorFilter } from '@shopify/react-native-skia';

const fonts = new Map<number, SkFont>();
const colorCache = new Map<string, Float32Array>();
const GRAYSCALE_MATRIX = [
  .2126, .7152, .0722, 0, 0,
  .2126, .7152, .0722, 0, 0,
  .2126, .7152, .0722, 0, 0,
  0, 0, 0, 1, 0,
];
let grayscaleFilter: SkColorFilter | null = null;

function cachedColor(style: string): Float32Array {
  let color = colorCache.get(style);
  if (!color) {
    color = Skia.Color(style);
    colorCache.set(style, color);
  }
  return color;
}

function getGrayscaleFilter(): SkColorFilter {
  if (!grayscaleFilter) grayscaleFilter = Skia.ColorFilter.MakeMatrix(GRAYSCALE_MATRIX);
  return grayscaleFilter;
}

class RadialGradient {
  stops: { offset: number; color: string }[] = [];
  stopColors: Float32Array[] = [];
  stopPositions: number[] = [];
  private prepared = false;
  constructor(public x: number, public y: number, public inner: number, public outer: number) {}
  addColorStop(offset: number, color: string) {
    this.stops.push({ offset, color });
    this.prepared = false;
  }
  prepare() {
    if (this.prepared) return;
    const sorted = this.stops.length > 1
      ? [...this.stops].sort((a, b) => a.offset - b.offset)
      : this.stops;
    this.stopColors = sorted.map(s => cachedColor(s.color));
    const denom = this.outer || 1;
    this.stopPositions = sorted.map(s => (this.inner + s.offset * (this.outer - this.inner)) / denom);
    this.prepared = true;
  }
}
type Style = string | RadialGradient;
type DrawingState = {
  fillStyle: Style; strokeStyle: Style; globalAlpha: number; lineWidth: number;
  lineCap: string; lineJoin: string; font: string; textAlign: string;
  textBaseline: string; filter: string; dash: number[];
};

const DEFAULT_STATE: DrawingState = {
  fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1,
  lineCap: 'butt', lineJoin: 'miter', font: '12px monospace',
  textAlign: 'start', textBaseline: 'alphabetic', filter: 'none', dash: [],
};

/** The subset of Canvas 2D used by the original artwork, backed entirely by Skia.
 * No HTML, DOM, WebView or browser runtime is involved.
 */
export class SkiaContext implements DrawingState {
  fillStyle: Style = '#000';
  strokeStyle: Style = '#000';
  globalAlpha = 1;
  lineWidth = 1;
  lineCap = 'butt';
  lineJoin = 'miter';
  font = '12px monospace';
  textAlign = 'start';
  textBaseline = 'alphabetic';
  filter = 'none';
  dash: number[] = [];
  private stack: DrawingState[] = [];
  private path: SkPathBuilder = Skia.PathBuilder.Make();
  private reusablePaint = Skia.Paint();
  private hasPoint = false;
  private canvas: SkCanvas | null = null;

  constructor(canvas?: SkCanvas) {
    if (canvas) this.canvas = canvas;
  }

  attach(canvas: SkCanvas) {
    this.canvas = canvas;
    Object.assign(this, DEFAULT_STATE);
    this.dash = [];
    this.stack.length = 0;
    this.path.reset();
    this.hasPoint = false;
  }

  detach() {
    this.canvas = null;
    this.stack.length = 0;
  }

  save() {
    this.stack.push({
      fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, globalAlpha: this.globalAlpha,
      lineWidth: this.lineWidth, lineCap: this.lineCap, lineJoin: this.lineJoin,
      font: this.font, textAlign: this.textAlign, textBaseline: this.textBaseline,
      filter: this.filter, dash: this.dash.length ? [...this.dash] : [],
    });
    this.canvas!.save();
  }
  restore() {
    const state = this.stack.pop();
    if (state) { Object.assign(this, state); this.canvas!.restore(); }
  }
  translate(x: number, y: number) { this.canvas!.translate(x, y); }
  rotate(radians: number) { this.canvas!.rotate(radians * 180 / Math.PI, 0, 0); }
  scale(x: number, y: number) { this.canvas!.scale(x, y); }
  setLineDash(values: number[]) { this.dash = values; }
  dispose() {
    this.path.dispose();
    this.reusablePaint.dispose();
    this.canvas = null;
    this.stack.length = 0;
  }
  beginPath() { this.path.reset(); this.hasPoint = false; }
  moveTo(x: number, y: number) { this.path.moveTo(x, y); this.hasPoint = true; }
  lineTo(x: number, y: number) { this.path.lineTo(x, y); this.hasPoint = true; }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    this.path.quadTo(cx, cy, x, y); this.hasPoint = true;
  }
  closePath() { this.path.close(); }
  arc(x: number, y: number, r: number, start: number, end: number, ccw = false) {
    const tau = Math.PI * 2;
    let sweep = end - start;
    if (!ccw && sweep >= tau) sweep = tau;
    else if (ccw && -sweep >= tau) sweep = -tau;
    else if (!ccw) sweep = ((sweep % tau) + tau) % tau;
    else sweep = -(((-sweep % tau) + tau) % tau);
    const sx = x + Math.cos(start) * r, sy = y + Math.sin(start) * r;
    if (this.hasPoint) this.lineTo(sx, sy); else this.moveTo(sx, sy);
    // Cubic segments preserve full circles and the original screen-space direction.
    const count = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    for (let i = 0; i < count; i++) {
      const a = start + sweep * i / count, b = start + sweep * (i + 1) / count;
      const k = 4 / 3 * Math.tan((b - a) / 4);
      this.path.cubicTo(
        x + r * (Math.cos(a) - k * Math.sin(a)),
        y + r * (Math.sin(a) + k * Math.cos(a)),
        x + r * (Math.cos(b) + k * Math.sin(b)),
        y + r * (Math.sin(b) - k * Math.cos(b)),
        x + r * Math.cos(b), y + r * Math.sin(b));
    }
  }
  roundRect(x: number, y: number, w: number, h: number, radius: number) {
    this.path.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), radius, radius));
    this.hasPoint = true;
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    if (x0 !== x1 || y0 !== y1) throw new Error('Only concentric gradients are used by this renderer');
    return new RadialGradient(x1, y1, r0, r1);
  }
  private paint(stroke: boolean) {
    const p = this.reusablePaint;
    p.reset();
    p.setAntiAlias(true);
    p.setStyle(stroke ? PaintStyle.Stroke : PaintStyle.Fill);
    p.setStrokeWidth(this.lineWidth);
    p.setStrokeCap(this.lineCap === 'round' ? StrokeCap.Round : StrokeCap.Butt);
    p.setStrokeJoin(this.lineJoin === 'round' ? StrokeJoin.Round : StrokeJoin.Miter);
    const style = stroke ? this.strokeStyle : this.fillStyle;
    if (typeof style === 'string') {
      const color = cachedColor(style);
      p.setColor(color);
      // setAlphaf replaces alpha; multiply the source alpha instead of losing it.
      if (this.globalAlpha !== 1) p.setAlphaf(color[3] * this.globalAlpha);
    } else {
      style.prepare();
      const shader = Skia.Shader.MakeRadialGradient(
        { x: style.x, y: style.y }, style.outer,
        style.stopColors,
        style.stopPositions,
        TileMode.Clamp);
      p.setShader(shader); shader.dispose();
      p.setAlphaf(this.globalAlpha);
    }
    if (stroke && this.dash.length) {
      const effect = Skia.PathEffect.MakeDash(this.dash, 0);
      p.setPathEffect(effect); effect?.dispose();
    }
    if (this.filter === 'grayscale(1)') p.setColorFilter(getGrayscaleFilter());
    return p;
  }
  private drawPath(stroke: boolean) {
    const p = this.paint(stroke);
    // build() preserves the builder so fill() can be followed by stroke().
    const path = this.path.build();
    try {
      this.canvas!.drawPath(path, p);
    } finally {
      path.dispose();
    }
  }
  fill() { this.drawPath(false); }
  stroke() { this.drawPath(true); }
  fillRect(x: number, y: number, w: number, h: number) {
    const p = this.paint(false); this.canvas!.drawRect(Skia.XYWHRect(x, y, w, h), p);
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    const p = this.paint(true); this.canvas!.drawRect(Skia.XYWHRect(x, y, w, h), p);
  }
  private text(text: string, x: number, y: number, stroke: boolean) {
    const size = Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 12);
    let font = fonts.get(size);
    if (!font) {
      font = matchFont({fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: size, fontWeight: '900'});
      fonts.set(size, font);
    }
    const width = font.getGlyphWidths(font.getGlyphIDs(text)).reduce((sum, width) => sum + width, 0);
    if (this.textAlign === 'center') x -= width / 2;
    else if (this.textAlign === 'right' || this.textAlign === 'end') x -= width;
    const metrics = font.getMetrics();
    if (this.textBaseline === 'middle') y -= (metrics.ascent + metrics.descent) / 2;
    else if (this.textBaseline === 'top') y -= metrics.ascent;
    else if (this.textBaseline === 'bottom') y -= metrics.descent;
    const p = this.paint(stroke); this.canvas!.drawText(text, x, y, p, font);
  }
  fillText(text: string, x: number, y: number) { this.text(text, x, y, false); }
  strokeText(text: string, x: number, y: number) { this.text(text, x, y, true); }
}
