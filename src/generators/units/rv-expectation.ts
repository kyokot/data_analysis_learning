/** 確率変数の期待値・分散（確率分布表、aX+b）の類題 */
import type { Rng } from '../../engine/rng.ts';
import { choicesFrom, distinctInts, fixed, int, num, pick, round, shuffledChoices, type Candidate } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

/** 小数第何位までで表せるか（0〜4。それ以上は 5） */
function decimals(v: number): number {
  for (let d = 0; d <= 4; d++) if (Math.abs(round(v, d) - v) < 1e-9) return d;
  return 5;
}

/** 合計が total になる正の整数 m 個（確率を total 分の 1 単位で作る） */
function composition(rng: Rng, m: number, total: number): number[] {
  const cuts = distinctInts(rng, m - 1, 1, total - 1).sort((a, b) => a - b);
  const pts = [0, ...cuts, total];
  return pts.slice(1).map((p, i) => p - pts[i]!);
}

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * 誤答候補から k 個を選ぶ。正答より小さいものと大きいものの個数を乱数で決め、
 * 値の小さい順に並べたときの正答の位置が偏らないようにする。
 */
function balanced(rng: Rng, correct: Candidate, wrongs: Candidate[], k = 3): Candidate[] {
  const seen = new Set([correct.label]);
  const uniq = wrongs.filter((w) => {
    if (seen.has(w.label) || Math.abs(w.value - correct.value) < 1e-9) return false;
    seen.add(w.label);
    return true;
  });
  const below = shuffle(rng, uniq.filter((w) => w.value < correct.value));
  const above = shuffle(rng, uniq.filter((w) => w.value > correct.value));
  const lo = Math.max(0, k - above.length);
  const hi = Math.min(k, below.length);
  if (lo > hi) throw new Reject();
  const b = lo + Math.floor(rng() * (hi - lo + 1));
  return [...below.slice(0, b), ...above.slice(0, k - b)];
}

interface DistCtx {
  intro: string;
  title: string;
  unit: string;
  /** 値の候補（小さい順） */
  values: (rng: Rng) => number[];
  /** 確率の刻み（10 なら 0.1 刻み、20 なら 0.05 刻み） */
  total: number;
}

const MEAN_CONTEXTS: DistCtx[] = [
  {
    intro: 'ある商店街のくじを1回引いたときの賞金',
    title: '賞金',
    unit: '円',
    values: (rng) => [0, pick(rng, [50, 100]), pick(rng, [200, 300, 500]), pick(rng, [1000, 2000])],
    total: 20,
  },
  { intro: 'ある洋菓子店で、限定ケーキが開店後1時間に売れる個数', title: '売れる個数', unit: '個', values: () => [0, 1, 2, 3], total: 10 },
  { intro: 'ある図書館で、利用者1人が1回に借りる本の冊数', title: '借りる冊数', unit: '冊', values: () => [1, 2, 3, 4], total: 10 },
  { intro: 'あるバスケットボール選手がフリースローを3本打ったときに決まる本数', title: '決まる本数', unit: '本', values: () => [0, 1, 2, 3], total: 10 },
  { intro: '的当てゲームを1回行ったときの得点', title: '得点', unit: '点', values: (rng) => pick(rng, [[0, 2, 5, 10], [1, 3, 5], [0, 5, 10, 20], [2, 4, 6, 8]]), total: 10 },
];

const VAR_CONTEXTS: DistCtx[] = MEAN_CONTEXTS.filter((c) => c.unit !== '円');

function makeDist(rng: Rng, c: DistCtx) {
  const xs = c.values(rng);
  const counts = composition(rng, xs.length, c.total);
  const ps = counts.map((k) => round(k / c.total, 2));
  const E = round(xs.reduce((s, x, i) => s + x * ps[i]!, 0), 6);
  const E2 = round(xs.reduce((s, x, i) => s + x * x * ps[i]!, 0), 6);
  const figure = {
    type: 'table' as const,
    title: `${c.title}$X$の確率分布`,
    columns: [`$X$（${c.unit}）`, ...xs.map(String), '計'],
    rows: [['確率', ...ps, 1] as (string | number)[]],
    headerColumn: true,
  };
  return { xs, ps, E, E2, figure };
}

export const generators: QuestionGenerator[] = [
  {
    id: 'rv-expectation-mean',
    unitId: 'rv-expectation',
    skill: '確率分布表から期待値を求める',
    grade: 3,
    difficulty: 1,
    replaces: ['rv-expectation-q01'],
    build(rng) {
      const c = pick(rng, MEAN_CONTEXTS);
      const { xs, ps, E, figure } = makeDist(rng, c);
      const d = c.unit === '円' ? 0 : 1;
      if (decimals(E) > d) throw new Reject();
      const label = (v: number) => `${fixed(v, d)}${c.unit}`;
      const ok = (v: number) => decimals(v) <= d;
      const m = xs.length;
      const simple = xs.reduce((s, x) => s + x, 0) / m;
      const total = xs.reduce((s, x) => s + x, 0);
      const wrongs: Candidate[] = [];
      if (ok(simple)) wrongs.push({ value: simple, label: label(simple), note: `確率を使わず、${m}つの値を足して${m}で割った値。確率が等しくないので単純な平均は使えない。` });
      wrongs.push({ value: total, label: label(total), note: '確率を掛けずに、値をそのまま合計した値。' });
      const maxP = Math.max(...ps);
      if (ps.filter((p) => p === maxP).length === 1) {
        const mode = xs[ps.indexOf(maxP)]!;
        wrongs.push({ value: mode, label: label(mode), note: '確率が最も大きい値（最頻値）を答えたもの。期待値は「値×確率」の合計である。' });
      }
      const mid = (xs[0]! + xs[m - 1]!) / 2;
      if (ok(mid)) wrongs.push({ value: mid, label: label(mid), note: `最小値${xs[0]}と最大値${xs[m - 1]}の平均を答えたもの。期待値は、すべての値に確率を掛けて合計する。` });
      let cum = 0;
      for (let i = 0; i < m; i++) {
        cum = round(cum + ps[i]!, 6);
        if (cum === 0.5) break;
        if (cum > 0.5) {
          wrongs.push({ value: xs[i]!, label: label(xs[i]!), note: `小さい方から確率を足して初めて0.5を超える値（分布の中央値）を答えたもの。期待値は「値×確率」の合計である。` });
          break;
        }
      }
      if (xs[0] === 0) {
        const hit = E / (1 - ps[0]!);
        if (ok(hit)) wrongs.push({ value: hit, label: label(hit), note: `0になる場合を除き、0以外の場合だけの平均（$${num(E, 2)}\\div ${num(1 - ps[0]!, 2)}$）を求めた値。0になる場合も含めて計算する。` });
      }
      const perM = E / m;
      if (ok(perM)) wrongs.push({ value: perM, label: label(perM), note: `「値×確率」の合計をさらに値の個数${m}で割った値。確率を掛けた時点で重みづけは済んでいるので、個数で割らない。` });
      const terms = xs.map((x, i) => `${x}\\times ${num(ps[i]!, 2)}`).join('+');
      const prods = xs.map((x, i) => num(x * ps[i]!, 4)).join('+');
      const correct: Candidate = { value: E, label: label(E), note: `正しい。それぞれの値に確率を掛けて合計すると$${prods}=${num(E, 4)}$になる。` };
      return {
        stem: `${c.intro}$X$（${c.unit}）の確率分布は、次の表のとおりである。$X$の期待値として正しいものを一つ選べ。`,
        figure,
        ...choicesFrom(correct, balanced(rng, correct, wrongs), { rng }),
        explanation: `期待値は${num(E, 4)}${c.unit}である。\n期待値は「値×確率」の合計なので、\n$E(X)=${terms}=${prods}=${num(E, 4)}$（${c.unit}）`,
      };
    },
  },
  {
    id: 'rv-expectation-variance',
    unitId: 'rv-expectation',
    skill: '確率分布表から分散を求める（基本）',
    grade: 3,
    difficulty: 1,
    replaces: ['rv-expectation-q02'],
    build(rng) {
      const c = pick(rng, VAR_CONTEXTS);
      const { xs, ps, E, E2, figure } = makeDist(rng, c);
      const V = round(E2 - E * E, 6);
      if (V <= 0) throw new Reject();
      const d = decimals(V);
      if (d > 2) throw new Reject();
      const label = (v: number) => fixed(v, d);
      const m = xs.length;
      const dev2 = xs.map((x) => round((x - E) ** 2, 6));
      const absDev = round(xs.reduce((s, x, i) => s + Math.abs(x - E) * ps[i]!, 0), 6);
      const unweighted = dev2.reduce((s, v) => s + v, 0) / m;
      const sumDev2 = round(dev2.reduce((s, v) => s + v, 0), 6);
      const cands: Candidate[] = [
        { value: E2, label: label(E2), note: `2乗の期待値$E(X^2)=${num(E2, 4)}$を求めたところで止めた値。ここから期待値の2乗$${num(E, 2)}^2$を引く。` },
        { value: round(E2 - E, 6), label: label(E2 - E), note: `$E(X^2)$から期待値${num(E, 2)}をそのまま引いた値。引くのは期待値の2乗$${num(E, 2)}^2=${num(E * E, 4)}$である。` },
        { value: absDev, label: label(absDev), note: 'ずれ（値−期待値）を2乗せず、ずれの大きさに確率を掛けて合計した値。分散はずれの2乗に確率を掛けて合計する。' },
        { value: unweighted, label: label(unweighted), note: `確率を使わず、ずれの2乗を足して${m}で割った値。${m}つの値の確率は等しくない。` },
        { value: sumDev2, label: label(sumDev2), note: 'ずれの2乗を、確率を掛けずにそのまま合計した値。' },
      ];
      const wrongs = cands.filter((w) => decimals(w.value) <= d);
      const devTerms = xs.map((x, i) => `(${x}-${num(E, 2)})^2\\times ${num(ps[i]!, 2)}`).join('+');
      const devVals = xs.map((_, i) => num(dev2[i]! * ps[i]!, 4)).join('+');
      const sqTerms = xs.map((x, i) => `${x * x}\\times ${num(ps[i]!, 2)}`).join('+');
      return {
        stem: `${c.intro}$X$（${c.unit}）の確率分布は、次の表のとおりである。$X$の期待値は${num(E, 2)}${c.unit}である。$X$の分散として正しいものを一つ選べ。`,
        figure,
        ...choicesFrom({ value: V, label: label(V), note: `正しい。ずれ（値−${num(E, 2)}）の2乗に確率を掛けて合計すると${num(V, 4)}になる。` }, wrongs, { rng }),
        explanation: `分散は${num(V, 4)}である。\n分散は「期待値からのずれの2乗」に確率を掛けて合計する。\n$V(X)=${devTerms}$\n$=${devVals}=${num(V, 4)}$\n別の求め方として、$E(X^2)=${sqTerms}=${num(E2, 4)}$ から $V(X)=E(X^2)-\\{E(X)\\}^2=${num(E2, 4)}-${num(E, 2)}^2=${num(V, 4)}$ としてもよい。`,
      };
    },
  },
  {
    id: 'rv-expectation-linear',
    unitId: 'rv-expectation',
    skill: 'aX+bの期待値と分散を求める',
    grade: 3,
    difficulty: 2,
    replaces: ['rv-expectation-q05'],
    build(rng) {
      const scenes = [
        {
          lead: (m: number, v: number) => `あるイベントの輪投げで、1人が入れる輪の数を$X$（本）とすると、$X$の期待値は${num(m)}、分散は${num(v)}である。`,
          rule: (a: number, b: number) => `景品ポイント$Y$は、参加賞の${b}ポイントに、入れた輪1本につき${a}ポイントを加えた$Y=${a}X+${b}$で決まる。`,
          a: [10, 20, 30, 50],
          b: [50, 100, 200],
        },
        {
          lead: (m: number, v: number) => `ある配達員が1時間に届ける荷物の個数を$X$（個）とすると、$X$の期待値は${num(m)}、分散は${num(v)}である。`,
          rule: (a: number, b: number) => `1時間の報酬$Y$（円）は、基本の${b}円に、1個につき${a}円を加えた$Y=${a}X+${b}$で決まる。`,
          a: [50, 80, 100, 150],
          b: [500, 800, 1000],
        },
        {
          lead: (m: number, v: number) => `ある検定の小テストで、1人が正解する問題の数を$X$（問）とすると、$X$の期待値は${num(m)}、分散は${num(v)}である。`,
          rule: (a: number, b: number) => `換算点$Y$は、基礎点${b}点に、1問につき${a}点を加えた$Y=${a}X+${b}$で決まる。`,
          a: [2, 3, 4, 5],
          b: [10, 20, 30, 40],
        },
        {
          lead: (m: number, v: number) => `あるパン屋で、1日に売れる限定パンの個数を$X$（個）とすると、$X$の期待値は${num(m)}、分散は${num(v)}である。`,
          rule: (a: number, b: number) => `限定パンによる1日の売上$Y$（円）は、セット販売の固定分${b}円に、1個につき${a}円を加えた$Y=${a}X+${b}$で決まる。`,
          a: [200, 250, 300],
          b: [300, 500, 600],
        },
      ];
      const s = pick(rng, scenes);
      const m = int(rng, 12, 60) / 10;
      const v = int(rng, 4, 30) / 10;
      const a = pick(rng, s.a);
      const b = pick(rng, s.b);
      const E = round(a * m + b, 6);
      const V = round(a * a * v, 6);
      const lab = (e: number, w: number) => `期待値${num(e, 2)}、分散${num(w, 2)}`;
      const wrongs = shuffle(rng, [
        { label: lab(a * m, V), note: `分散は正しいが、期待値で${b}を足し忘れて$${a}\\times ${num(m)}$とした組合せ。` },
        { label: lab(E, a * v), note: `分散を$${a}^2$倍ではなく${a}倍（$${a}\\times ${num(v)}$）にした組合せ。` },
        { label: lab(E, a * v + b), note: `分散も期待値と同じ式に当てはめて$${a}\\times ${num(v)}+${b}$とした組合せ。分散は$a^2$倍で、$b$は足さない。` },
        { label: lab(E, V + b), note: `分散を$${a}^2\\times ${num(v)}$まで求めたあと、さらに${b}を足した組合せ。定数$b$は散らばりを変えないので分散には足さない。` },
      ]);
      return {
        stem: `${s.lead(m, v)}${s.rule(a, b)}$Y$の期待値と分散の組合せとして正しいものを一つ選べ。`,
        ...shuffledChoices(rng, { label: lab(E, V), note: `正しい。期待値は$${a}\\times ${num(m)}+${b}$、分散は$${a}^2\\times ${num(v)}$で求める。` }, wrongs),
        explanation: `期待値${num(E, 2)}、分散${num(V, 2)}が正しい。\n$Y=aX+b$ のとき、$E(Y)=aE(X)+b$、$V(Y)=a^2V(X)$（定数$b$は分散に関係しない）。\n期待値は$E(Y)=${a}\\times ${num(m)}+${b}=${num(E, 2)}$。\n分散は$V(Y)=${a}^2\\times ${num(v)}=${a * a}\\times ${num(v)}=${num(V, 2)}$。`,
      };
    },
  },
];
