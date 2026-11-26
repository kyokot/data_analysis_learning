/** 図表の目盛りと座標変換 */

export interface Axis {
  min: number;
  max: number;
  /** 主目盛り */
  ticks: number[];
  /** 補助目盛り（主目盛りを含まない） */
  minor: number[];
  step: number;
}

function niceStep(span: number, target: number): number {
  const raw = span / Math.max(1, target);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * pow;
}

/** 丸め誤差を落とす（-0 は 0 にする） */
const round = (v: number) => Math.round(v * 1e9) / 1e9 + 0;

/**
 * データの範囲を含む、きりのよい軸を作る。
 * fixedMin / fixedMax を指定するとその値を端に使い、目盛りの刻みだけを決める。
 */
export function makeAxis(lo: number, hi: number, opts: { target?: number; includeZero?: boolean; fixedMin?: number; fixedMax?: number } = {}): Axis {
  let min = opts.fixedMin ?? (opts.includeZero ? Math.min(0, lo) : lo);
  let max = opts.fixedMax ?? (opts.includeZero ? Math.max(0, hi) : hi);
  if (!(max > min)) max = min + 1;
  const step = niceStep(max - min, opts.target ?? 5);
  if (opts.fixedMin === undefined) min = round(Math.floor(min / step + 1e-9) * step);
  if (opts.fixedMax === undefined) max = round(Math.ceil(max / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-6; v += step) ticks.push(round(v));
  // 補助目盛り: 主目盛りの間を等分する（刻みが 2 のときは 4 等分、それ以外は 5 等分）
  const lead = Math.round((step / Math.pow(10, Math.floor(Math.log10(step)))) * 10) / 10;
  const sub = step / (lead === 2 ? 4 : 5);
  const minor: number[] = [];
  for (let v = Math.ceil(min / sub - 1e-9) * sub; v <= max + sub * 1e-6; v += sub) {
    const r = round(v);
    if (!ticks.some((t) => Math.abs(t - r) < sub * 1e-6)) minor.push(r);
  }
  return { min, max, ticks, minor, step };
}

export function scaleLinear(axis: { min: number; max: number }, from: number, to: number): (v: number) => number {
  const span = axis.max - axis.min || 1;
  return (v) => from + ((v - axis.min) / span) * (to - from);
}

export function fmt(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString('en-US');
  return String(round(v));
}

/** 全角を 1、半角を 0.58 として文字幅を見積もる（SVG のラベルが重ならないかの判定用） */
export function textWidth(s: string, fontSize = 11): number {
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) > 0xff ? 1 : 0.58;
  return w * fontSize;
}
