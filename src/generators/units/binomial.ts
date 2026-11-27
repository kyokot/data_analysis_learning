/** 二項分布（P(X=k)、期待値・分散、標準偏差）の類題 */
import type { Rng } from '../../engine/rng.ts';
import { choicesFrom, fixed, frac, int, num, pick, round, shuffledChoices, type Candidate } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

function comb(n: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

function perm(n: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) r *= n - i;
  return r;
}

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 小数第 d 位までで表せるか */
const exactAt = (v: number, d: number) => Math.abs(round(v, d) - v) < 1e-9;

/** 小数第 d 位に丸めるとき、四捨五入の境目に近すぎる（丸め方で表示が変わりうる） */
function nearHalf(v: number, d: number): boolean {
  const s = Math.abs(v) * 10 ** d;
  return Math.abs(s - Math.floor(s) - 0.5) < 0.05;
}

const PMF_CONTEXTS = [
  { setup: (p: string) => `あるゲームの宝箱は、1回開けるごとに確率${p}でレアアイテムが出る。`, trial: (n: number) => `宝箱を${n}回開ける`, event: (k: number) => `レアアイテムがちょうど${k}回出る`, ps: [[1, 3], [1, 4], [1, 5], [2, 5]] },
  { setup: (p: string) => `あるクイズで、でたらめに答えると1問ごとに確率${p}で正解する。`, trial: (n: number) => `${n}問すべてにでたらめに答える`, event: (k: number) => `ちょうど${k}問正解する`, ps: [[1, 3], [1, 4], [1, 5]] },
  { setup: (p: string) => `ある選手のフリースローは、1本ごとに確率${p}で成功する。`, trial: (n: number) => `${n}本打つ`, event: (k: number) => `ちょうど${k}本成功する`, ps: [[2, 3], [3, 4], [3, 5], [4, 5]] },
  { setup: (p: string) => `ある花の種は、1粒ごとに確率${p}で発芽する。`, trial: (n: number) => `${n}粒まく`, event: (k: number) => `ちょうど${k}粒発芽する`, ps: [[1, 2], [2, 3], [3, 4], [4, 5]] },
  { setup: (p: string) => `1個のさいころを投げると、確率${p}で1の目が出る。`, trial: (n: number) => `さいころを${n}回投げる`, event: (k: number) => `1の目がちょうど${k}回出る`, ps: [[1, 6]] },
];

const MAX_N: Record<number, number> = { 2: 6, 3: 6, 4: 5, 5: 4, 6: 4 };

const MV_CONTEXTS = [
  { lead: (p: string) => `ある果樹園で収穫されるりんごは、1個ごとに独立に確率${p}で規格外になるとする。`, body: (n: number) => `収穫したりんご${n}個のうち、規格外のりんごの個数を$X$とする`, ns: [40, 60, 80, 100, 120, 200] },
  { lead: (p: string) => `ある花の種は、1粒ごとに独立に確率${p}で発芽するとする。`, body: (n: number) => `この種を${n}粒まいたとき、発芽する粒数を$X$とする`, ns: [20, 40, 50, 60, 100, 150] },
  { lead: (p: string) => `ある市が行う郵送調査では、依頼した世帯は1世帯ごとに独立に確率${p}で回答するとする。`, body: (n: number) => `${n}世帯に依頼するとき、回答する世帯の数を$X$とする`, ns: [100, 200, 300, 400, 500] },
  { lead: (p: string) => `ある工場の製品は、1個ごとに独立に確率${p}で検査に不合格となるとする。`, body: (n: number) => `製品${n}個を検査するとき、不合格となる個数を$X$とする`, ns: [60, 100, 120, 200, 300, 400] },
];

const P_LIST = [5, 10, 15, 20, 25, 30, 35, 40, 60, 70, 75, 80];

/** n·p(1−p) が平方数になる (n, p) の組（p は百分率） */
const SQUARE_CASES: { n: number; P: number; s: number }[] = [];
for (const P of [10, 20, 25, 40, 50, 60, 75, 80, 90]) {
  for (let n = 10; n <= 600; n++) {
    if ((n * P) % 100 !== 0) continue;
    const v = (n * P * (100 - P)) / 10000;
    const s = Math.round(Math.sqrt(v));
    if (s * s === v && s >= 2 && s <= 12 && Number.isInteger(v)) SQUARE_CASES.push({ n, P, s });
  }
}

const SD_CONTEXTS = [
  { lead: (p: string) => `ある市が行う郵送調査では、依頼した世帯は1世帯ごとに独立に確率${p}で回答するとする。`, body: (n: number) => `${n}世帯に依頼するとき、回答する世帯の数$X$` },
  { lead: (p: string) => `あるバスケットボール選手は、フリースローを1本ごとに独立に確率${p}で決めるとする。`, body: (n: number) => `この選手が${n}本打つとき、決まる本数$X$` },
  { lead: (p: string) => `ある花の種は、1粒ごとに独立に確率${p}で発芽するとする。`, body: (n: number) => `この種を${n}粒まいたとき、発芽する粒数$X$` },
  { lead: (p: string) => `ある通販サイトの案内メールは、1通ごとに独立に確率${p}で開封されるとする。`, body: (n: number) => `${n}通送ったとき、開封される数$X$` },
];

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
    id: 'binomial-pmf',
    unitId: 'binomial',
    skill: 'ちょうどk回起こる確率（分数）',
    grade: 3,
    difficulty: 2,
    replaces: ['binomial-q03'],
    build(rng) {
      const c = pick(rng, PMF_CONTEXTS);
      const [a, b] = pick(rng, c.ps) as [number, number];
      const n = int(rng, 3, MAX_N[b]!);
      const k = int(rng, 1, n - 1);
      const q = b - a;
      const C = comb(n, k);
      const den = b ** n;
      const seq = a ** k * q ** (n - k);
      const num1 = C * seq;
      const pT = `$\\dfrac{${a}}{${b}}$`;
      const pS = `\\dfrac{${a}}{${b}}`;
      const qS = `\\dfrac{${q}}{${b}}`;
      const cS = `{}_${n}\\mathrm{C}_${k}`;
      const fl = (x: number, y: number) => `$${frac(x, y)}$`;
      const cand = (x: number, y: number, note: string): Candidate => ({ value: x / y, label: fl(x, y), note });
      const pw = (base: string, e: number) => (e === 1 ? base : `\\left(${base}\\right)^${e}`);
      const wrongs: Candidate[] = [
        cand(seq, den, `並び方の数$${cS}=${C}$を掛けず、特定の並び1通りの確率$${pw(pS, k)}\\times ${pw(qS, n - k)}$だけを答えた値。`),
        cand(C * a ** n, den, `起こらない${n - k}回にも$${qS}$ではなく$${pS}$を使い、$${C}\\times ${pw(pS, n)}$とした値。`),
        cand(C * a ** k, b ** k, `起こらない${n - k}回分の確率$${pw(qS, n - k)}$を掛け忘れ、$${C}\\times ${pw(pS, k)}$とした値。`),
        cand(C * q ** k * a ** (n - k), den, `起こる確率と起こらない確率を取り違え、$${C}\\times ${pw(qS, k)}\\times ${pw(pS, n - k)}$とした値。`),
      ];
      if (k >= 2) wrongs.push(cand(perm(n, k) * seq, den, `$${cS}$を順列の数${perm(n, k)}と数え、$${perm(n, k)}\\times ${pw(pS, k)}\\times ${pw(qS, n - k)}$とした値。`));
      const valid = wrongs.filter((w) => w.value < 1);
      return {
        stem: `${c.setup(pT)}各回の結果は互いに独立であるとする。${c.trial(n)}とき、${c.event(k)}確率として正しいものを一つ選べ。`,
        ...balancedChoices(rng, cand(num1, den, `正しい。$${cS}\\times ${pw(pS, k)}\\times ${pw(qS, n - k)}=${C}\\times ${frac(seq, den)}$。`), valid),
        explanation: `確率は$${frac(num1, den)}$である。\n起こる回数$X$は二項分布$B\\left(${n},\\ ${pS}\\right)$に従う。\n${n}回のうち起こる${k}回の選び方は$${cS}=${C}$通り。\n特定の並び1通り（起こる${k}回・起こらない${n - k}回）の確率は$${pw(pS, k)}\\times ${pw(qS, n - k)}=${frac(seq, den)}$。\nよって$P(X=${k})=${C}\\times ${frac(seq, den)}=${frac(num1, den)}$。`,
      };
    },
  },
  {
    id: 'binomial-mean-var',
    unitId: 'binomial',
    skill: '二項分布の期待値と分散の計算',
    grade: 3,
    difficulty: 1,
    replaces: ['binomial-q02'],
    build(rng) {
      const c = pick(rng, MV_CONTEXTS);
      const n = pick(rng, c.ns);
      const P = pick(rng, P_LIST);
      const p = P / 100;
      const E = round((n * P) / 100, 6);
      const V = round((n * P * (100 - P)) / 10000, 6);
      const npp = round((n * P * P) / 10000, 6);
      const nq = round((n * (100 - P)) / 100, 6);
      if (!exactAt(E, 2) || !exactAt(V, 2)) throw new Reject();
      const lab = (e: number, v: number) => `期待値${num(e, 4)}、分散${num(v, 4)}`;
      const ws = [
        { label: lab(V, E), note: `期待値$np=${num(E, 4)}$と分散$np(1-p)=${num(V, 4)}$を逆に答えた組合せ。` },
        { label: lab(E, E), note: `分散にも期待値と同じ$np=${num(E, 4)}$を使い、$(1-p)$を掛け忘れた組合せ。` },
        { label: lab(nq, V), note: `期待値を$n(1-p)=${n}\\times ${num(1 - p, 2)}=${num(nq, 4)}$とし、起こらない方の回数で計算した組合せ。` },
      ];
      if (exactAt(npp, 4)) ws.push({ label: lab(E, npp), note: `分散で$1-p$の代わりに$p$を掛け、$${n}\\times ${num(p, 2)}\\times ${num(p, 2)}=${num(npp, 4)}$とした組合せ。` });
      return {
        stem: `${c.lead(String(p))}${c.body(n)}とき、$X$の期待値と分散の組合せとして正しいものを一つ選べ。`,
        ...shuffledChoices(rng, { label: lab(E, V), note: `正しい。期待値は$${n}\\times ${num(p, 2)}=${num(E, 4)}$、分散は$${num(E, 4)}\\times ${num(1 - p, 2)}=${num(V, 4)}$。` }, shuffle(rng, ws)),
        explanation: `期待値は${num(E, 4)}、分散は${num(V, 4)}である。\n$X$は二項分布$B(${n},\\ ${num(p, 2)})$に従う。\n期待値は$np=${n}\\times ${num(p, 2)}=${num(E, 4)}$。\n分散は$np(1-p)=${n}\\times ${num(p, 2)}\\times ${num(1 - p, 2)}=${num(E, 4)}\\times ${num(1 - p, 2)}=${num(V, 4)}$。`,
      };
    },
  },
  {
    id: 'binomial-sd',
    unitId: 'binomial',
    skill: '二項分布の標準偏差',
    grade: 3,
    difficulty: 2,
    replaces: ['binomial-q06'],
    build(rng) {
      const c = pick(rng, SD_CONTEXTS);
      const { n, P, s } = pick(rng, SQUARE_CASES);
      const p = P / 100;
      const E = (n * P) / 100;
      const V = s * s;
      const label = (v: number) => fixed(v, 1);
      const cands: Candidate[] = [
        { value: V, label: label(V), note: `分散$np(1-p)=${V}$を求めたところで止め、平方根をとり忘れた値。` },
        { value: E, label: label(E), note: `期待値$np=${num(E, 2)}$を答えた値。標準偏差は分散$np(1-p)$の平方根である。` },
        { value: Math.sqrt(E), label: label(Math.sqrt(E)), note: `$(1-p)$を掛け忘れ、$\\sqrt{np}=\\sqrt{${num(E, 2)}}$とした値。` },
        { value: Math.sqrt(p * (1 - p)), label: label(Math.sqrt(p * (1 - p))), note: `試行回数$n=${n}$を掛け忘れ、$\\sqrt{p(1-p)}=\\sqrt{${num(p * (1 - p), 4)}}$とした値（1回分の標準偏差）。` },
        { value: Math.sqrt(n * p * p), label: label(Math.sqrt(n * p * p)), note: `$1-p$の代わりに$p$を掛け、$\\sqrt{${n}\\times ${num(p, 2)}\\times ${num(p, 2)}}$とした値。` },
        { value: n * Math.sqrt(p * (1 - p)), label: label(n * Math.sqrt(p * (1 - p))), note: `平方根を$p(1-p)$にだけかけて$n$にかけず、$${n}\\times\\sqrt{${num(p * (1 - p), 4)}}$とした値。` },
      ];
      const wrongs = cands.filter((w) => !nearHalf(w.value, 1));
      return {
        stem: `${c.lead(String(p))}${c.body(n)}の標準偏差として正しいものを一つ選べ。ただし、必要ならば小数第2位を四捨五入した値で答えよ。`,
        ...balancedChoices(rng, { value: s, label: label(s), note: `正しい。分散は$${n}\\times ${num(p, 2)}\\times ${num(1 - p, 2)}=${V}$で、その平方根は${s}。` }, wrongs),
        explanation: `標準偏差は${s}である。\n$X$は二項分布$B(${n},\\ ${num(p, 2)})$に従うので、分散は$np(1-p)=${n}\\times ${num(p, 2)}\\times ${num(1 - p, 2)}=${V}$。\n標準偏差は分散の正の平方根なので、$\\sqrt{${V}}=${s}$。`,
      };
    },
  },
];
