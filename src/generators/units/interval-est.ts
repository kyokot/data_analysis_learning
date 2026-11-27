/** 区間推定（母平均・母比率の95%信頼区間）の類題 */
import { choicesFrom, fixed, int, num, pick } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

const MEAN_CONTEXTS = [
  { place: 'あるパン工場で作られる食パン1斤', what: '重さ', unit: 'g', count: '斤', verb: '重さを量った', mu: [370, 400], sdMax: 30 },
  { place: 'ある農園で収穫されるりんご', what: '重さ', unit: 'g', count: '個', verb: '重さを量った', mu: [280, 320], sdMax: 40 },
  { place: 'ある市の高校生', what: '1日のスマートフォン利用時間', unit: '分', count: '人', verb: '利用時間を調べた', mu: [120, 180], sdMax: 60 },
  { place: 'ある工場で作られる電池', what: '連続使用時間', unit: '時間', count: '個', verb: '連続使用時間を測った', mu: [40, 60], sdMax: 10 },
  { place: 'ある湖にすむ魚', what: '体長', unit: 'cm', count: '匹', verb: '体長を測った', mu: [24, 36], sdMax: 6 },
];

const PROP_CONTEXTS = [
  { pop: '人口の多いある市の住民', ask: 'この1年間に市立図書館を利用したかどうか', yes: 'が「利用した」と答えた', target: '図書館を利用した人', who: '人', popName: 'この市の住民' },
  { pop: 'ある学習アプリの利用者', ask: 'アプリに満足しているかどうか', yes: 'が「満足」と答えた', target: '「満足」と答える人', who: '人', popName: 'このアプリの利用者全体' },
  { pop: 'ある県の有権者', ask: '新しい条例案に賛成かどうか', yes: 'が「賛成」と答えた', target: '賛成の人', who: '人', popName: 'この県の有権者全体' },
  { pop: 'ある産地で収穫された大量のみかん', ask: '糖度が基準を超えるかどうか', yes: 'の糖度が基準を超えた', target: '糖度が基準を超えるみかん', who: '個', popName: 'この産地のみかん全体' },
  { pop: 'ある大学の学生', ask: '自転車で通学しているかどうか', yes: 'が「自転車で通学している」と答えた', target: '自転車で通学する学生', who: '人', popName: 'この大学の学生全体' },
];

const CLEAN_P = [0.1, 0.2, 0.36, 0.5, 0.64, 0.8, 0.9];

const r8 = (x: number) => Math.round(x * 1e8) / 1e8;

/** 四捨五入の境目（…5）にごく近い値なら true（丸め方で表示が変わりうる） */
function nearHalf(x: number, digits: number): boolean {
  const s = Math.abs(x) * 10 ** digits;
  return Math.abs(s - Math.floor(s) - 0.5) < 0.02;
}

export const generators: QuestionGenerator[] = [
  {
    id: 'interval-est-mean-ci',
    unitId: 'interval-est',
    skill: '母平均の95%信頼区間の計算（母標準偏差が既知）',
    grade: 3,
    difficulty: 1,
    replaces: ['interval-est-q01'],
    build(rng) {
      const c = pick(rng, MEAN_CONTEXTS);
      const root = pick(rng, [4, 5, 6, 8, 10]);
      const n = root * root;
      const se = pick(rng, [0.5, 1, 1.5, 2, 2.5, 3]);
      const sigma = se * root;
      if (!Number.isInteger(sigma) || sigma > c.sdMax) throw new Reject();
      const xbar = int(rng, c.mu[0]! * 10, c.mu[1]! * 10) / 10;
      const half = r8(1.96 * se);
      const iv = (h: number) => `${fixed(xbar - h, 2)}〜${fixed(xbar + h, 2)}`;
      const xb = num(xbar, 1);
      return {
        stem: `${c.place}の${c.what}は、母標準偏差が${sigma}${c.unit}であることがわかっている。無作為に選んだ${n}${c.count}の${c.verb}ところ、標本平均は${xb}${c.unit}であった。${c.what}の母平均の95%信頼区間（単位は${c.unit}）として正しいものを一つ選べ。ただし、標準正規分布に従う $Z$ について $P(-1.96\\leqq Z\\leqq 1.96)=0.95$ としてよい。また、区間の両端は小数第3位を四捨五入してある。`,
        ...choicesFrom(
          { value: half, label: iv(half), note: `正しい。標準誤差 $${sigma}/\\sqrt{${n}}=${num(se)}$ に1.96を掛けた${num(half)}を、${xb}から引いて足す。` },
          [
            ...(xbar - 1.96 * sigma > 0 ? [{ value: 1.96 * sigma, label: iv(1.96 * sigma), note: `$\\sqrt{n}$ で割らずに $${xb}\\pm 1.96\\times ${sigma}$ とした区間。これは1つ1つの値が散らばる範囲に近い。` }] : []),
            { value: se, label: iv(se), note: `標準誤差${num(se)}を求めたあと、1.96を掛けずに $${xb}\\pm ${num(se)}$ とした区間。` },
            { value: 1.64 * se, label: iv(1.64 * se), note: `1.96の代わりに、90%信頼区間で使う約1.64を掛けた区間（$${xb}\\pm 1.64\\times ${num(se)}$）。` },
            { value: (1.96 * sigma) / n, label: iv((1.96 * sigma) / n), note: `$\\sqrt{${n}}=${root}$ ではなく${n}で割って $1.96\\times ${sigma}\\div ${n}$ を半幅とした区間。` },
            { value: half / 2, label: iv(half / 2), note: `$1.96\\times ${num(se)}=${num(half)}$ を区間の幅（上限−下限）と取り違え、その半分の${num(half / 2, 3)}だけを足し引きした区間。` },
            // 両端が四捨五入の境目（…5）に当たる区間は表示の丸めがぶれるので使わない
          ].filter((w) => !nearHalf(xbar - w.value, 2) && !nearHalf(xbar + w.value, 2)),
          { rng },
        ),
        explanation: `${iv(half)}が正しい。\n母平均の95%信頼区間は $\\bar{x}\\pm 1.96\\times\\dfrac{\\sigma}{\\sqrt{n}}$。\n標準誤差は $\\dfrac{${sigma}}{\\sqrt{${n}}}=\\dfrac{${sigma}}{${root}}=${num(se)}$。\n半幅は $1.96\\times ${num(se)}=${num(half)}$。\n下限は $${xb}-${num(half)}=${num(xbar - half, 2)}$、上限は $${xb}+${num(half)}=${num(xbar + half, 2)}$ となる。`,
      };
    },
  },
  {
    id: 'interval-est-prop-ci',
    unitId: 'interval-est',
    skill: '母比率の95%信頼区間の計算',
    grade: 3,
    difficulty: 2,
    replaces: ['interval-est-q03'],
    build(rng) {
      const c = pick(rng, PROP_CONTEXTS);
      const ph = pick(rng, CLEAN_P);
      const root = pick(rng, [10, 20, 25, 30, 40, 50]);
      const n = root * root;
      const x = r8(n * ph);
      if (!Number.isInteger(x)) throw new Reject();
      const q = r8(1 - ph);
      const pq = r8(ph * q);
      const s = r8(Math.sqrt(pq));
      const se = r8(s / root);
      if (Math.abs(se * 1e5 - Math.round(se * 1e5)) > 1e-6) throw new Reject();
      const half = r8(1.96 * se);
      // 正答の両端が四捨五入の境目に近いものは使わない
      if (nearHalf(ph - half, 3) || nearHalf(ph + half, 3)) throw new Reject();
      const iv = (h: number) => `${fixed(ph - h, 3)}〜${fixed(ph + h, 3)}`;
      const wrongs = [
        { value: se, label: iv(se), note: `標準誤差${num(se, 6)}を求めたあと、1.96を掛けずに $${ph}\\pm ${num(se, 6)}$ とした区間。` },
        { value: 1.64 * se, label: iv(1.64 * se), note: `1.96の代わりに、90%信頼区間で使う約1.64を掛けた区間（$${ph}\\pm 1.64\\times ${num(se, 6)}$）。` },
        { value: (1.96 * pq) / root, label: iv((1.96 * pq) / root), note: `分子の平方根をとらずに $1.96\\times\\dfrac{${pq}}{\\sqrt{${n}}}=${num((1.96 * pq) / root, 6)}$ を半幅とした区間。` },
        { value: (1.96 * s) / n, label: iv((1.96 * s) / n), note: `$\\sqrt{${pq}}=${num(s, 4)}$ を $\\sqrt{${n}}$ ではなく${n}で割り、$1.96\\times ${num(s, 4)}\\div ${n}$ を半幅とした区間。` },
        { value: half / 2, label: iv(half / 2), note: `$1.96\\times ${num(se, 6)}=${num(half, 6)}$ を区間の幅（上限−下限）と取り違え、その半分だけを足し引きした区間。` },
        { value: 2 * half, label: iv(2 * half), note: `区間の幅 $2\\times 1.96\\times ${num(se, 6)}=${num(2 * half, 6)}$ を、半幅と取り違えて${ph}から引いて足した区間。` },
        { value: 2.58 * se, label: iv(2.58 * se), note: `1.96の代わりに、99%信頼区間で使う約2.58を掛けた区間（$${ph}\\pm 2.58\\times ${num(se, 6)}$）。` },
      ].filter((w) => ph - w.value > 0 && ph + w.value < 1 && !nearHalf(ph - w.value, 3) && !nearHalf(ph + w.value, 3));
      return {
        stem: `${c.pop}から無作為に${n}${c.who}を選び、${c.ask}を調べたところ、${x}${c.who}${c.yes}。${c.popName}のうち${c.target}の割合（母比率）の95%信頼区間として正しいものを一つ選べ。ただし、標準正規分布に従う $Z$ について $P(-1.96\\leqq Z\\leqq 1.96)=0.95$ としてよい。また、区間の両端は小数第4位を四捨五入してある。`,
        ...choicesFrom({ value: half, label: iv(half), note: `正しい。標準誤差${num(se, 6)}に1.96を掛けた${num(half, 6)}を、${ph}から引いて足す。` }, wrongs, { rng }),
        explanation: `${iv(half)}が正しい。\n母比率の95%信頼区間は $\\hat{p}\\pm 1.96\\sqrt{\\dfrac{\\hat{p}(1-\\hat{p})}{n}}$。\n標本比率は $\\hat{p}=${x}/${n}=${ph}$。\n標準誤差は $\\sqrt{\\dfrac{${ph}\\times ${q}}{${n}}}=\\dfrac{\\sqrt{${pq}}}{${root}}=\\dfrac{${num(s, 4)}}{${root}}=${num(se, 6)}$。\n半幅は $1.96\\times ${num(se, 6)}=${num(half, 6)}$。\n下限は $${ph}-${num(half, 6)}=${num(ph - half, 6)}$、上限は $${ph}+${num(half, 6)}=${num(ph + half, 6)}$ で、小数第4位を四捨五入すると${iv(half)}となる。`,
      };
    },
  },
];
