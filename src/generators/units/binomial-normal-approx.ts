/** 二項分布の正規近似（近似する正規分布、標準化、確率）の類題 */
import type { Rng } from '../../engine/rng.ts';
import { choicesFrom, fixed, num, pick, round, shuffledChoices, type Candidate } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 小数第 d 位に丸めるとき、四捨五入の境目に近すぎる */
function nearHalf(v: number, d: number): boolean {
  const s = Math.abs(v) * 10 ** d;
  return Math.abs(s - Math.floor(s) - 0.5) < 0.05;
}

const exactAt = (v: number, d: number) => Math.abs(round(v, d) - v) < 1e-9;

/** n·p(1−p) が平方数になり、np と n(1−p) が十分大きい (n, p) の組（P は百分率） */
interface Case {
  n: number;
  P: number;
  mean: number;
  v: number;
  s: number;
}
const CASES: Case[] = [];
for (const P of [10, 20, 25, 36, 40, 50, 60, 64, 75, 80, 90]) {
  for (let n = 50; n <= 1200; n++) {
    if ((n * P) % 100 !== 0) continue;
    const v = (n * P * (100 - P)) / 10000;
    if (!Number.isInteger(v)) continue;
    const s = Math.round(Math.sqrt(v));
    const mean = (n * P) / 100;
    if (s * s === v && s >= 4 && s <= 16 && mean >= 10 && n - mean >= 10) CASES.push({ n, P, mean, v, s });
  }
}

/** 標準正規分布の上側確率 P(Z ≧ z) */
const UPPER: Record<string, number> = { '0.5': 0.3085, '1': 0.1587, '1.2': 0.1151, '1.5': 0.0668, '2': 0.0228, '2.5': 0.0062 };
const zText = (z: number) => fixed(z, 1);

const CONTEXTS = [
  { lead: (p: string, n: number) => `ある地域の世帯は、1世帯ごとに確率${p}で食材の宅配サービスを利用しているとみなせる。この地域から無作為に${n}世帯を選んだとき、宅配サービスを利用している世帯の数を$X$とする。`, unit: '世帯' },
  { lead: (p: string, n: number) => `ある通販サイトが送る案内メールは、1通ごとに確率${p}で開封される（各メールは独立）。${n}通送ったとき、開封される数を$X$とする。`, unit: '通' },
  { lead: (p: string, n: number) => `ある菓子は、1個ごとに確率${p}で当たり券が入っている（各個は独立）。この菓子を${n}個買ったとき、当たり券の数を$X$とする。`, unit: '個', maxP: 25 },
  { lead: (p: string, n: number) => `ある駅では、利用者1人ごとに確率${p}で定期券を使って改札を通る（各利用者は独立とみなす）。ある日の利用者から無作為に${n}人を選んだとき、定期券を使う人の数を$X$とする。`, unit: '人' },
  { lead: (p: string, n: number) => `ある花の種は、1粒ごとに確率${p}で発芽する（各粒は独立）。この種を${n}粒まいたとき、発芽する粒数を$X$とする。`, unit: '粒' },
];

function setup(rng: Rng) {
  const c = pick(rng, CONTEXTS);
  const k = pick(rng, CASES.filter((x) => !('maxP' in c) || x.P <= (c.maxP ?? 100)));
  const p = k.P / 100;
  return { c, ...k, p, pS: num(p, 2), qS: num(1 - p, 2) };
}

/**
 * choicesFrom の前に誤答を3個に絞る。正答より小さい誤答と大きい誤答の個数を乱数で決め、
 * 値の小さい順に並べたときの正答の位置が偏らないようにする。
 */
function balancedChoices(rng: Rng, correct: Candidate, wrongs: Candidate[]) {
  const seen = new Set([correct.label]);
  const uniq = wrongs.filter((w) => {
    if (!Number.isFinite(w.value) || seen.has(w.label) || Math.abs(w.value - correct.value) < 1e-9) return false;
    seen.add(w.label);
    return true;
  });
  const below = shuffle(rng, uniq.filter((w) => w.value < correct.value));
  const above = shuffle(rng, uniq.filter((w) => w.value > correct.value));
  const k = 3;
  const lo = Math.max(0, k - above.length);
  const hi = Math.min(k, below.length);
  if (lo > hi) throw new Reject();
  const b = lo + Math.floor(rng() * (hi - lo + 1));
  return choicesFrom(correct, [...below.slice(0, b), ...above.slice(0, k - b)], { rng });
}

export const generators: QuestionGenerator[] = [
  {
    id: 'binomial-normal-approx-params',
    unitId: 'binomial-normal-approx',
    skill: '近似に使う正規分布の平均と分散',
    grade: 3,
    difficulty: 1,
    replaces: ['binomial-normal-approx-q01'],
    build(rng) {
      const { c, n, mean, v, s, p, pS, qS } = setup(rng);
      const N = (m: number, w: number) => `$N(${num(m, 2)},${num(w, 2)})$`;
      const npp = round(n * p * p, 6);
      const ws = [
        { label: N(mean, s), note: `第2引数に標準偏差$\\sqrt{${v}}=${s}$を入れたもの。$N(\\mu,\\sigma^2)$の第2引数は分散である。` },
        { label: N(mean, mean), note: `分散を$np=${num(mean, 2)}$とし、$(1-p)$を掛け忘れたもの。` },
        { label: N(n - mean, v), note: `平均を$n(1-p)=${n}\\times ${qS}=${num(n - mean, 2)}$とし、起こらない方の回数で計算したもの。` },
        { label: N(v, mean), note: `平均と分散を逆にしたもの。平均は$np=${num(mean, 2)}$、分散は$np(1-p)=${v}$である。` },
      ];
      if (exactAt(npp, 2)) ws.push({ label: N(mean, npp), note: `分散で$1-p$の代わりに$p$を掛け、$${n}\\times ${pS}\\times ${pS}=${num(npp, 2)}$としたもの。` });
      return {
        stem: `${c.lead(pS, n)}$X$の分布を近似する正規分布として、最も適切なものを一つ選べ。ただし、$N(\\mu,\\sigma^2)$の第2引数は分散を表す。`,
        ...shuffledChoices(rng, { label: N(mean, v), note: `正しい。平均は$np=${num(mean, 2)}$、分散は$np(1-p)=${v}$。` }, shuffle(rng, ws)),
        explanation: `答えは${N(mean, v)}である。\n$X$は二項分布$B(${n},\\ ${pS})$に従い、$n$が大きいので、平均$np$・分散$np(1-p)$の正規分布で近似できる。\n平均は$np=${n}\\times ${pS}=${num(mean, 2)}$。\n分散は$np(1-p)=${n}\\times ${pS}\\times ${qS}=${v}$。\nよって$X$は近似的に${N(mean, v)}に従う。`,
      };
    },
  },
  {
    id: 'binomial-normal-approx-z',
    unitId: 'binomial-normal-approx',
    skill: '正規近似のための標準化',
    grade: 3,
    difficulty: 2,
    replaces: ['binomial-normal-approx-q05'],
    build(rng) {
      const { c, n, mean, v, s, pS, qS } = setup(rng);
      const z = pick(rng, [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5]);
      const d = z * s;
      if (!Number.isInteger(d)) throw new Reject();
      const x = mean + d;
      const label = (t: number) => `$${fixed(t, 2)}$`;
      const cands: Candidate[] = [
        { value: -z, label: label(-z), note: `引き算の順を逆にして$\\dfrac{${num(mean, 2)}-${x}}{${s}}$とした値。${d > 0 ? '平均より大きいので正になる。' : '平均より小さいので負になる。'}` },
        { value: d / v, label: label(d / v), note: `$\\dfrac{${x}-${num(mean, 2)}}{${v}}$で、標準偏差ではなく分散${v}で割った値。` },
        { value: d / Math.sqrt(mean), label: label(d / Math.sqrt(mean)), note: `$\\dfrac{${x}-${num(mean, 2)}}{\\sqrt{${num(mean, 2)}}}$で、分散を$np=${num(mean, 2)}$として$(1-p)$を掛け忘れた値。` },
        { value: d, label: label(d), note: `$${x}-${num(mean, 2)}=${d}$で、平均を引いただけで標準偏差で割っていない値。` },
        { value: s / d, label: label(s / d), note: `分母と分子を逆にして$\\dfrac{${s}}{${x}-${num(mean, 2)}}$とした値。標準化は「平均との差 ÷ 標準偏差」である。` },
      ];
      const wrongs = cands.filter((w) => !nearHalf(w.value, 2));
      return {
        stem: `${c.lead(pS, n)}$X$の分布を正規分布で近似して考える。$X=${x}$を標準化した値として、最も適切なものを一つ選べ。ただし、値は小数第3位を四捨五入してある。`,
        ...balancedChoices(rng, { value: z, label: label(z), note: `正しい。平均${num(mean, 2)}を引き、標準偏差${s}で割る。` }, wrongs),
        explanation: `答えは${label(z)}である。\n$X$は$B(${n},\\ ${pS})$に従う。平均は$np=${n}\\times ${pS}=${num(mean, 2)}$、分散は$np(1-p)=${n}\\times ${pS}\\times ${qS}=${v}$、標準偏差は$\\sqrt{${v}}=${s}$。\n標準化は「平均を引いて標準偏差で割る」ので、$\\dfrac{${x}-${num(mean, 2)}}{${s}}=\\dfrac{${d}}{${s}}=${num(z, 2)}$。`,
      };
    },
  },
  {
    id: 'binomial-normal-approx-tail',
    unitId: 'binomial-normal-approx',
    skill: '正規近似で片側の確率を求める',
    grade: 3,
    difficulty: 2,
    replaces: ['binomial-normal-approx-q03'],
    build(rng) {
      const { c, n, mean, v, s, pS, qS } = setup(rng);
      const z = pick(rng, [0.5, 1, 1.2, 1.5, 2, 2.5]);
      const d = round(z * s, 6);
      if (!Number.isInteger(d)) throw new Reject();
      const above = rng() < 0.5;
      const ge = rng() < 0.5;
      const x = above ? mean + d : mean - d;
      if (x <= 0 || x >= n) throw new Reject();
      const t = UPPER[String(z)]!;
      const u = c.unit;
      const tailAsked = above === ge;
      const zs = zText(z);
      const P = (v: number) => fixed(v, 4);
      const tailText = `${x}${u}${above ? '以上' : '以下'}`;
      const compText = `${x}${u}${above ? 'より少ない' : 'より多い'}`;
      const mirror = above ? mean - d : mean + d;
      const lo = Math.min(x, mirror);
      const hi = Math.max(x, mirror);
      const cand = (val: number, note: string): Candidate => ({ value: round(val, 4), label: P(val), note });
      const all: Candidate[] = [
        cand(t, `与えられた片側の確率${P(t)}をそのまま答えた値。これは${tailText}となる確率で、求める側が逆になっている。`),
        cand(1 - t, `$1-${P(t)}$とした値。これは${compText}確率で、求める側が逆になっている。`),
        cand(2 * t, `$${P(t)}\\times 2$として両側の確率にした値。これは「${lo}${u}以下または${hi}${u}以上」の確率で、問われているのは片側だけである。`),
        cand(0.5 - t, `$0.5-${P(t)}$とした値。これは平均${num(mean, 2)}と${x}の間に入る確率である。`),
        cand(
          0.5 + t,
          tailAsked
            ? `$0.5+${P(t)}$とした値。求める範囲は平均${num(mean, 2)}から見て${x}${u}よりさらに外側だけなので、確率は0.5より小さく、0.5を足す理由はない。`
            : `$0.5+${P(t)}$とした値。0.5に足すのは平均から${x}までの確率（$0.5-${P(t)}$）であり、片側の確率${P(t)}を足しても求める確率にはならない。`,
        ),
        cand(1 - 2 * t, `$1-2\\times ${P(t)}$とした値。これは${lo}${u}以上${hi}${u}以下（平均をはさむ範囲）の確率である。`),
      ];
      const correctV = tailAsked ? t : round(1 - t, 4);
      const correct = tailAsked
        ? cand(t, `正しい。標準化すると$${above ? '' : '-'}${zs}$で、${above ? '' : '対称性から'}$P(Z\\geqq ${zs})$をそのまま使う。`)
        : cand(1 - t, `正しい。反対側の確率${P(t)}を全体の1から引く。`);
      const wrongs = all.filter((w) => Math.abs(w.value - correctV) > 1e-9);
      const zSigned = above ? zs : `-${zs}`;
      const condText = `${x}${u}${ge ? '以上' : '以下'}`;
      const sym = above ? '' : `対称性から$P(Z\\leqq -${zs})=P(Z\\geqq ${zs})=${P(t)}$。\n`;
      const last = tailAsked
        ? `よって求める確率は${P(t)}。`
        : `求める側は${tailText}の反対側なので、$1-${P(t)}=${P(1 - t)}$。`;
      return {
        stem: `${c.lead(pS, n)}$X$が${condText}となる確率を、正規分布による近似で求めた。最も近い値を一つ選べ。ただし、標準正規分布に従う$Z$について$P(Z\\geqq ${zs})=${P(t)}$としてよい。`,
        ...balancedChoices(rng, correct, wrongs),
        explanation: `答えは${P(correctV)}。\n$X$は$B(${n},\\ ${pS})$に従う。平均は$np=${n}\\times ${pS}=${num(mean, 2)}$、分散は$np(1-p)=${n}\\times ${pS}\\times ${qS}=${v}$、標準偏差は$\\sqrt{${v}}=${s}$。\n$X$は近似的に$N(${num(mean, 2)},${v})$に従うので、${x}を標準化すると$\\dfrac{${x}-${num(mean, 2)}}{${s}}=${zSigned}$。\n${sym}${last}\n（このサイトでは、半整数補正を使わずに近似する。）`,
      };
    },
  },
];
