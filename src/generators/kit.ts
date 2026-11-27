/** ジェネレーターを書くための道具 */
import type { Rng } from '../engine/rng.ts';
import { Reject, type Draft } from './types.ts';

export function int(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

/** 重複のない整数を n 個 */
export function distinctInts(rng: Rng, n: number, lo: number, hi: number): number[] {
  if (hi - lo + 1 < n) throw new Reject();
  const set = new Set<number>();
  while (set.size < n) set.add(int(rng, lo, hi));
  return [...set];
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => sum(xs) / xs.length;

/** 中央値（並べ替えてから） */
export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

/** 四分位数（高校数学Iの方式: 奇数個なら中央値を上下どちらにも入れない） */
export function quartiles(xs: number[]): { q1: number; q2: number; q3: number } {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  const half = Math.floor(n / 2);
  return { q1: median(s.slice(0, half)), q2: median(s), q3: median(s.slice(n - half)) };
}

/** 分散（n で割る） */
export function variance(xs: number[]): number {
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
}

/** 共分散（n で割る） */
export function covariance(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  return mean(xs.map((x, i) => (x - mx) * (ys[i]! - my)));
}

export function round(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
}

/**
 * 数値を表示用の文字列にする。digits 桁で丸め、末尾の 0 は残す（選択肢の桁をそろえるため）。
 * 負の数は数式の中で使うことを想定して「−」ではなく "-" のまま返す。
 */
export function fixed(x: number, digits: number): string {
  const r = round(x, digits);
  return (Object.is(r, -0) ? 0 : r).toFixed(digits);
}

/** 整数ならそのまま、そうでなければ最大 digits 桁（末尾の 0 は落とす） */
export function num(x: number, digits = 2): string {
  const r = round(x, digits);
  return String(Object.is(r, -0) ? 0 : r);
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** 既約分数の TeX（\dfrac）。分母が 1 なら整数 */
export function frac(n: number, d: number): string {
  const g = gcd(n, d) || 1;
  const nn = n / g;
  const dd = d / g;
  if (dd === 1) return String(nn);
  return `\\dfrac{${nn}}{${dd}}`;
}

export interface Candidate {
  /** 比較・並べ替えに使う値 */
  value: number;
  /** 表示（RichText） */
  label: string;
  /** その選択肢の一言（正答は「正しい。…」、誤答は「どう取り違えるとこの値になるか」） */
  note: string;
}

/**
 * 正答と誤答の候補から、選択肢を組み立てる。
 * - 表示が正答と同じになる誤答・互いに重なる誤答は捨てる
 * - 残った誤答から count−1 個を選ぶ。rng を渡すと選び方を乱数で変える（正答の位置が偏らないように）。
 *   渡さなければ候補の並び順（＝よくある取り違えの順）に取る
 * - 足りなければ Reject（別の数値で作り直す）
 * - 値の小さい順に並べる
 */
export function choicesFrom(
  correct: Candidate,
  wrongs: Candidate[],
  opts: { rng?: Rng; count?: number } = {},
): Pick<Draft, 'choices' | 'choiceNotes' | 'answer'> {
  const count = opts.count ?? 4;
  const seen = new Set([correct.label]);
  const valid: Candidate[] = [];
  for (const w of wrongs) {
    if (!Number.isFinite(w.value) || seen.has(w.label)) continue;
    if (Math.abs(w.value - correct.value) < 1e-9) continue;
    seen.add(w.label);
    valid.push(w);
  }
  if (valid.length < count - 1) throw new Reject();
  let chosen = valid;
  if (opts.rng) {
    const rng = opts.rng;
    chosen = [...valid];
    for (let i = chosen.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [chosen[i], chosen[j]] = [chosen[j]!, chosen[i]!];
    }
  }
  const picked = [correct, ...chosen.slice(0, count - 1)];
  picked.sort((a, b) => a.value - b.value);
  return {
    choices: picked.map((c) => c.label),
    choiceNotes: picked.map((c) => c.note),
    answer: picked.indexOf(correct),
  };
}

/**
 * 値を持たない（文章の）選択肢から組み立てる。正答の位置は乱数で決める。
 */
export function shuffledChoices(rng: Rng, correct: { label: string; note: string }, wrongs: { label: string; note: string }[], count = 4): Pick<Draft, 'choices' | 'choiceNotes' | 'answer'> {
  const ws = wrongs.filter((w, i) => w.label !== correct.label && wrongs.findIndex((x) => x.label === w.label) === i).slice(0, count - 1);
  if (ws.length < count - 1) throw new Reject();
  const all = [correct, ...ws];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return { choices: all.map((c) => c.label), choiceNotes: all.map((c) => c.note), answer: all.indexOf(correct) };
}
