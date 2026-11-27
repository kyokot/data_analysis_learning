/** 正規分布（標準化、上側・下側の確率、平均をはさむ区間の確率）の類題 */
import type { Rng } from '../../engine/rng.ts';
import { choicesFrom, distinctInts, fixed, int, num, pick, round, type Candidate } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

/** 標準正規分布の P(0 ≦ Z ≦ z)（小数第4位） */
const PHI0: Record<string, number> = {
  '0.4': 0.1554,
  '0.5': 0.1915,
  '0.8': 0.2881,
  '1': 0.3413,
  '1.2': 0.3849,
  '1.4': 0.4192,
  '1.5': 0.4332,
  '1.6': 0.4452,
  '1.8': 0.4641,
  '2': 0.4772,
  '2.4': 0.4918,
  '2.5': 0.4938,
};
const zKey = (z: number) => String(round(z, 2));
const zText = (z: number) => fixed(z, 1);

/** 小数第 d 位に丸めるとき、四捨五入の境目に近すぎる */
function nearHalf(v: number, d: number): boolean {
  const s = Math.abs(v) * 10 ** d;
  return Math.abs(s - Math.floor(s) - 0.5) < 0.05;
}

interface NormCtx {
  /** N(μ,σ^2) の文字列を受け取って、分布の説明文を返す */
  lead: (dist: string) => string;
  /** 条件（「70g以上」など）を受け取って、問う割合・確率を返す */
  ask: (cond: string) => string;
  unit: string;
  mu: [number, number];
  sigma: number[];
}

const CONTEXTS: NormCtx[] = [
  { lead: (d) => `ある養鶏場で採れる卵1個の重さは、正規分布${d}に従う（単位はg）。`, ask: (c) => `重さが${c}の卵の割合`, unit: 'g', mu: [56, 66], sigma: [2, 3, 4, 5] },
  { lead: (d) => `ある資格試験の受験者の得点は、正規分布${d}に従う（単位は点）。`, ask: (c) => `得点が${c}の受験者の割合`, unit: '点', mu: [50, 65], sigma: [8, 10, 12, 15] },
  { lead: (d) => `ある路線バスの始発から終点までの所要時間は、正規分布${d}に従う（単位は分）。`, ask: (c) => `所要時間が${c}となる確率`, unit: '分', mu: [30, 50], sigma: [2, 3, 4, 5] },
  { lead: (d) => `ある飲料工場で充填されるペットボトル1本の内容量は、正規分布${d}に従う（単位はmL）。`, ask: (c) => `内容量が${c}となるボトルの割合`, unit: 'mL', mu: [501, 510], sigma: [2, 3, 4] },
  { lead: (d) => `ある地域の高校1年生の身長は、正規分布${d}に従う（単位はcm）。`, ask: (c) => `身長が${c}の生徒の割合`, unit: 'cm', mu: [160, 170], sigma: [4, 5, 6, 8] },
];

const STD_CONTEXTS = [
  { lead: (d: string) => `ある高校の生徒の通学時間$X$（分）は、正規分布${d}に従う。`, who: (x: number) => `通学時間が${x}分の生徒`, mu: [20, 45], sigma: [4, 5, 6, 8, 10] },
  { lead: (d: string) => `ある養鶏場で採れる卵1個の重さ$X$（g）は、正規分布${d}に従う。`, who: (x: number) => `重さが${x}gの卵`, mu: [56, 66], sigma: [2, 3, 4, 5] },
  { lead: (d: string) => `ある試験の受験者の得点$X$（点）は、正規分布${d}に従う。`, who: (x: number) => `得点が${x}点の受験者`, mu: [50, 65], sigma: [8, 10, 12, 15] },
  { lead: (d: string) => `ある地域の高校1年生の身長$X$（cm）は、正規分布${d}に従う。`, who: (x: number) => `身長が${x}cmの生徒`, mu: [160, 170], sigma: [4, 5, 6, 8] },
  { lead: (d: string) => `ある路線バスの所要時間$X$（分）は、正規分布${d}に従う。`, who: (x: number) => `所要時間が${x}分の運行`, mu: [30, 50], sigma: [3, 4, 5, 6] },
];

const prob = (v: number) => fixed(v, 4);
const pc = (v: number, note: string): Candidate => ({ value: round(v, 4), label: prob(v), note });

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
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
    id: 'normal-standardize',
    unitId: 'normal',
    skill: '標準化の計算（分散から標準偏差を読む）',
    grade: 3,
    difficulty: 2,
    replaces: ['normal-q03'],
    build(rng) {
      const c = pick(rng, STD_CONTEXTS);
      const mu = int(rng, c.mu[0]!, c.mu[1]!);
      const sigma = pick(rng, c.sigma);
      const z = pick(rng, [-2, -1.5, -1.25, -1, -0.75, -0.5, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5]);
      const dx = z * sigma;
      if (!Number.isInteger(dx)) throw new Reject();
      const x = mu + dx;
      const v = sigma * sigma;
      const label = (t: number) => `$${fixed(t, 2)}$`;
      const cands: Candidate[] = [
        { value: -z, label: label(-z), note: `引き算の順を逆にして$\\dfrac{${mu}-${x}}{${sigma}}$とした値。${x > mu ? '平均より大きいのだから$z$は正になる。' : '平均より小さいのだから$z$は負になる。'}` },
        { value: dx / v, label: label(dx / v), note: `標準偏差${sigma}ではなく分散${v}で割った値（$${dx}\\div ${v}$）。$N(\\mu,\\sigma^2)$の第2引数は分散である。` },
        { value: dx, label: label(dx), note: `平均との差$${x}-${mu}=${dx}$を答えただけで、標準偏差で割っていない。` },
        { value: x / sigma, label: label(x / sigma), note: `平均を引かずに、$${x}\\div ${sigma}$とした値。標準化は平均を引いてから標準偏差で割る。` },
        { value: sigma / dx, label: label(sigma / dx), note: `分母と分子を逆にして$\\dfrac{${sigma}}{${x}-${mu}}$とした値。標準化は「平均との差 ÷ 標準偏差」である。` },
      ];
      const wrongs = cands.filter((w) => !nearHalf(w.value, 2));
      return {
        stem: `${c.lead(`$N(${mu},${v})$`)}${c.who(x)}について、$X$を標準化した値$z$として正しいものを一つ選べ。ただし、必要ならば小数第3位を四捨五入した値で答えよ。`,
        ...balancedChoices(rng, { value: z, label: label(z), note: `正しい。標準偏差は$\\sqrt{${v}}=${sigma}$で、$(${x}-${mu})\\div ${sigma}=${num(z, 2)}$。` }, wrongs),
        explanation: `答えは$${num(z, 2)}$である。\n$N(${mu},${v})$の第2引数${v}は分散なので、標準偏差は$\\sqrt{${v}}=${sigma}$。\n標準化は$z=\\dfrac{x-\\mu}{\\sigma}$なので、$z=\\dfrac{${x}-${mu}}{${sigma}}=\\dfrac{${dx}}{${sigma}}=${num(z, 2)}$。\n${x}は、平均より標準偏差${num(Math.abs(z), 2)}個分だけ${z > 0 ? '大きい' : '小さい'}ことを表す。`,
      };
    },
  },
  {
    id: 'normal-tail',
    unitId: 'normal',
    skill: '標準化して片側の確率を求める',
    grade: 3,
    difficulty: 2,
    replaces: ['normal-q04'],
    build(rng) {
      const c = pick(rng, CONTEXTS);
      const mu = int(rng, c.mu[0]!, c.mu[1]!);
      const sigma = pick(rng, c.sigma);
      const z = pick(rng, [0.4, 0.5, 0.8, 1, 1.2, 1.4, 1.5, 1.6, 1.8, 2, 2.4, 2.5]);
      const d = round(z * sigma, 6);
      if (!Number.isInteger(d)) throw new Reject();
      const a = PHI0[zKey(z)]!;
      const u = c.unit;
      const above = rng() < 0.5; // 境界が平均より上か
      const ge = rng() < 0.5; // 「以上」を問うか
      const x = above ? mu + d : mu - d;
      const mirror = above ? mu - d : mu + d;
      const lo = Math.min(x, mirror);
      const hi = Math.max(x, mirror);
      const tailAsked = above === ge;
      const t = round(0.5 - a, 4);
      const cond = `${x}${u}${ge ? '以上' : '以下'}`;
      const tailText = `${x}${u}${above ? '以上' : '以下'}`;
      const compText = `${x}${u}${above ? '以下' : '以上'}`;
      const betweenText = above ? `${mu}${u}以上${x}${u}以下` : `${x}${u}以上${mu}${u}以下`;
      const aS = prob(a);
      const zs = zText(z);
      const pAll: Candidate[] = [
        pc(t, `$0.5-${aS}$とした値。これは${tailText}の割合で、求める側が逆になっている。`),
        pc(0.5 + a, `$0.5+${aS}$とした値。これは${compText}の割合で、求める側が逆になっている。`),
        pc(a, `与えられた$P(0\\leqq Z\\leqq ${zs})$をそのまま答えた値。これは${betweenText}の割合である。`),
        pc(2 * t, `${tailText}の割合$${prob(t)}$を2倍した値。これは「${lo}${u}以下または${hi}${u}以上」という両側の割合になる。`),
        pc(2 * a, `$${aS}$を2倍した値。これは${lo}${u}以上${hi}${u}以下（平均をはさむ範囲）の割合である。`),
        pc(1 - a, `$1-${aS}$とした値。$P(0\\leqq Z\\leqq ${zs})$は平均から片側だけの面積なので、全体の1ではなく片側の0.5を基準に考える。`),
        pc(t / 2, `片側の割合$${prob(t)}$をさらに2で割った値。$0.5-${aS}$はすでに片側だけの割合なので、2で割る必要はない。`),
      ];
      const correctV = tailAsked ? t : round(0.5 + a, 4);
      const correct = tailAsked
        ? pc(t, `正しい。$z=${above ? '' : '-'}${zs}$なので、${above ? '上側' : '下側'}半分の0.5から$${aS}$を引く。`)
        : pc(0.5 + a, `正しい。平均より${above ? '下' : '上'}側の0.5に、平均から${x}${u}までの$${aS}$を足す。`);
      const wrongs = pAll.filter((w) => Math.abs(w.value - correctV) > 1e-9);
      const zSigned = above ? zs : `-${zs}`;
      const stdz = `$z=\\dfrac{${x}-${mu}}{${sigma}}=${zSigned}$`;
      const sym = above ? '' : `\n対称性から、$P(Z\\leqq -${zs})=P(Z\\geqq ${zs})$、$P(Z\\geqq -${zs})=P(Z\\leqq ${zs})$である。`;
      const body = tailAsked
        ? `求める割合は平均から離れた片側の部分で、片側全体の0.5から平均〜${x}${u}の部分を引く。\n$0.5-${aS}=${prob(t)}$`
        : `求める割合は、平均より${above ? '下' : '上'}側の全体0.5と、平均〜${x}${u}の部分を合わせたもの。\n$0.5+${aS}=${prob(0.5 + a)}$`;
      return {
        stem: `${c.lead(`$N(${mu},${sigma}^2)$`)}${c.ask(cond)}として、最も適切なものを一つ選べ。ただし、標準正規分布に従う$Z$について$P(0\\leqq Z\\leqq ${zs})=${aS}$としてよい。`,
        ...balancedChoices(rng, correct, wrongs),
        explanation: `答えは${prob(correctV)}である。\n${x}${u}を標準化すると${stdz}。${sym}\n${body}`,
      };
    },
  },
  {
    id: 'normal-interval',
    unitId: 'normal',
    skill: '平均をはさむ区間の確率（表の値を足す）',
    grade: 3,
    difficulty: 2,
    replaces: ['normal-q07'],
    build(rng) {
      const c = pick(rng, CONTEXTS);
      const mu = int(rng, c.mu[0]!, c.mu[1]!);
      const sigma = pick(rng, c.sigma);
      const ZS = [0.5, 1, 1.5, 2, 2.5];
      const [i1, i2] = distinctInts(rng, 2, 0, ZS.length - 1) as [number, number];
      const z1 = ZS[i1]!;
      const z2 = ZS[i2]!;
      const d1 = z1 * sigma;
      const d2 = z2 * sigma;
      if (!Number.isInteger(d1) || !Number.isInteger(d2)) throw new Reject();
      const x1 = mu - d1;
      const x2 = mu + d2;
      const a1 = PHI0[zKey(z1)]!;
      const a2 = PHI0[zKey(z2)]!;
      const u = c.unit;
      const ans = round(a1 + a2, 4);
      // 表に載せる z（必要な2つ＋ほかを足して4つ）
      const extra = ZS.filter((z) => z !== z1 && z !== z2);
      const others: number[] = [];
      while (others.length < 2) {
        const z = pick(rng, extra);
        if (!others.includes(z)) others.push(z);
      }
      const shown = [z1, z2, ...others].sort((p, q) => p - q);
      const s1 = prob(a1);
      const s2 = prob(a2);
      const wrongs: Candidate[] = [
        pc(Math.abs(a2 - a1), `大きい方から小さい方を引いた値（$${prob(Math.max(a1, a2))}-${prob(Math.min(a1, a2))}$）。${x1}${u}が平均より下にあることを見落としている。`),
        pc(1 - ans, `$1-${prob(ans)}$とした値。これは${x1}${u}未満または${x2}${u}より大きい確率で、求める区間の外側である。`),
        pc(2 * a1, `$${s1}$を2倍した値。これは${mu - d1}${u}以上${mu + d1}${u}以下の割合で、上側の境界${x2}${u}を使っていない。`),
        pc(2 * a2, `$${s2}$を2倍した値。これは${mu - d2}${u}以上${mu + d2}${u}以下の割合で、下側の境界${x1}${u}を使っていない。`),
        pc(0.5 + a2, `$0.5+${s2}$とした値。これは${x2}${u}以下の割合で、下限${x1}${u}より小さい部分まで含めている。`),
        pc(a2, `右側の$P(0\\leqq Z\\leqq ${zText(z2)})$だけを答えた値。${mu}${u}以上${x2}${u}以下の割合で、${x1}${u}から${mu}${u}の部分が抜けている。`),
      ];
      return {
        stem: `${c.lead(`$N(${mu},${sigma}^2)$`)}${c.ask(`${x1}${u}以上${x2}${u}以下`)}として、最も適切なものを一つ選べ。ただし、標準正規分布に従う$Z$について、次の表の値を用いてよい。`,
        figure: {
          type: 'table',
          title: '標準正規分布の確率',
          columns: ['$z$', '$P(0\\leqq Z\\leqq z)$'],
          rows: shown.map((z) => [zText(z), prob(PHI0[zKey(z)]!)]),
          headerColumn: true,
        },
        ...balancedChoices(rng, pc(ans, `正しい。$z=-${zText(z1)}$から0までの${s1}と、0から$z=${zText(z2)}$までの${s2}を足す。`), wrongs),
        explanation: `答えは${prob(ans)}である。\n両端を標準化する。${x1}${u}は$z=\\dfrac{${x1}-${mu}}{${sigma}}=-${zText(z1)}$、${x2}${u}は$z=\\dfrac{${x2}-${mu}}{${sigma}}=${zText(z2)}$。\n求める確率は$P(-${zText(z1)}\\leqq Z\\leqq ${zText(z2)})$。0をはさむので、左側と右側に分けて足す。\n左側は対称性から$P(-${zText(z1)}\\leqq Z\\leqq 0)=P(0\\leqq Z\\leqq ${zText(z1)})=${s1}$。\n右側は$P(0\\leqq Z\\leqq ${zText(z2)})=${s2}$。\n合わせて$${s1}+${s2}=${prob(ans)}$。`,
      };
    },
  },
];
