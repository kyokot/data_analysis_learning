/** 標本分布（標本平均の標準偏差 σ/√n、標本比率の期待値と標準偏差）の類題 */
import { choicesFrom, fixed, num, pick, shuffledChoices } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

const MEAN_CONTEXTS = [
  { place: 'ある養鶏場で出荷される卵', what: '重さ', unit: 'g', count: '個', mu: [58, 66], sdMax: 10 },
  { place: 'ある工場で袋詰めされるコーヒー豆', what: '内容量', unit: 'g', count: '袋', mu: [200, 260], sdMax: 16 },
  { place: 'ある市の中学生', what: '1日の通学時間', unit: '分', count: '人', mu: [15, 35], sdMax: 15 },
  { place: 'ある果樹園で収穫されるなし', what: '重さ', unit: 'g', count: '個', mu: [320, 420], sdMax: 40 },
  { place: 'ある会社の従業員', what: '1か月の残業時間', unit: '時間', count: '人', mu: [10, 25], sdMax: 10 },
];

const PROP_CONTEXTS = [
  { pop: 'ある通販サイトの会員全体', trait: 'スマートフォン用アプリを利用している会員', who: '人' },
  { pop: 'ある市の有権者全体', trait: '新しい公園の整備に賛成の人', who: '人' },
  { pop: 'ある工場で作られる部品全体', trait: '検査で手直しが必要になる部品', who: '個' },
  { pop: 'ある県の高校生全体', trait: '毎朝朝食を食べる生徒', who: '人' },
  { pop: 'ある町の世帯全体', trait: '家庭菜園をしている世帯', who: '世帯' },
];

/** p(1−p) の平方根がきりのよい値になる母比率 */
const CLEAN_P = [0.1, 0.2, 0.36, 0.5, 0.64, 0.8, 0.9];

const isClean = (x: number, digits: number) => Math.abs(x * 10 ** digits - Math.round(x * 10 ** digits)) < 1e-6;

export const generators: QuestionGenerator[] = [
  {
    id: 'sampling-dist-mean-se',
    unitId: 'sampling-dist',
    skill: '標本平均の標準偏差の計算',
    grade: 3,
    difficulty: 1,
    replaces: ['sampling-dist-q02'],
    build(rng) {
      const c = pick(rng, MEAN_CONTEXTS);
      const root = pick(rng, [3, 4, 5, 6, 8, 10]);
      const n = root * root;
      const se = pick(rng, [0.5, 1, 1.5, 2, 2.5, 3, 4]);
      const sigma = se * root;
      if (!Number.isInteger(sigma) || sigma > c.sdMax) throw new Reject();
      const mu = c.mu[0]! + Math.floor(rng() * (c.mu[1]! - c.mu[0]! + 1));
      const label = (v: number) => `${fixed(v, 2)}${c.unit}`;
      return {
        stem: `${c.place}の${c.what}は、平均${mu}${c.unit}、標準偏差${sigma}${c.unit}である。この中から${n}${c.count}を無作為に抽出するとき、標本平均の標準偏差として正しいものを一つ選べ。ただし、割り切れない値は小数第3位を四捨五入してある。`,
        ...choicesFrom(
          { value: se, label: label(se), note: `正しい。$${sigma}\\div\\sqrt{${n}}=${sigma}\\div ${root}=${num(se)}$。` },
          [
            { value: sigma / n, label: label(sigma / n), note: `$\\sqrt{n}$ ではなく $n$ で割った値（$${sigma}\\div ${n}$）。割るのは標本の大きさの平方根である。` },
            { value: sigma, label: label(sigma), note: '母標準偏差をそのまま答えた値。平均をとると散らばりは小さくなる。' },
            { value: sigma * root, label: label(sigma * root), note: `$\\sqrt{n}$ で割るところを、掛けてしまった値（$${sigma}\\times ${root}$）。` },
            { value: (sigma * sigma) / n, label: label((sigma * sigma) / n), note: `標準偏差ではなく、標本平均の分散 $\\sigma^2/n=${sigma * sigma}\\div ${n}$ を答えた値。` },
            { value: sigma / 2, label: label(sigma / 2), note: '標本の大きさに関係なく、母標準偏差を2で割った値。標本平均の標準偏差は $\\sigma/\\sqrt{n}$ で求める。' },
            // 小数第3位がちょうど5の値は表示の丸めがぶれるので使わない
          ].filter((w) => Math.abs(w.value * 100 - Math.floor(w.value * 100) - 0.5) > 0.02),
          { rng },
        ),
        explanation: `標本平均の標準偏差は${num(se)}${c.unit}である。\n母標準偏差を $\\sigma$、標本の大きさを $n$ とすると、標本平均の標準偏差は $\\dfrac{\\sigma}{\\sqrt{n}}$。\n$\\sigma=${sigma}$、$n=${n}$ を代入すると、$\\dfrac{${sigma}}{\\sqrt{${n}}}=\\dfrac{${sigma}}{${root}}=${num(se)}$（${c.unit}）。母平均${mu}${c.unit}は標準偏差の計算には使わない。`,
      };
    },
  },
  {
    id: 'sampling-dist-prop-sd',
    unitId: 'sampling-dist',
    skill: '標本比率の期待値と標準偏差',
    grade: 3,
    difficulty: 2,
    replaces: ['sampling-dist-q03'],
    build(rng) {
      const c = pick(rng, PROP_CONTEXTS);
      const p = pick(rng, CLEAN_P);
      // 手直しが必要な部品が大半を占める、のような不自然な設定は避ける
      if (c.who === '個' && p > 0.2) throw new Reject();
      const root = pick(rng, [10, 20, 25, 30, 40, 50]);
      const n = root * root;
      const q = round6(1 - p);
      const s = Math.sqrt(p * q); // 0.3, 0.4, 0.48, 0.5
      const sd = s / root;
      if (!isClean(sd, 5)) throw new Reject();
      const np = round6(n * p);
      if (!Number.isInteger(np)) throw new Reject();
      const pq = round6(p * q);
      const v = round6(pq / n);
      const s6 = round6(s);
      const sdN = round6(s / n);
      const lab = (e: number, d: number) => `期待値は${num(e, 6)}、標準偏差は${num(d, 8)}`;
      return {
        stem: `${c.pop}のうち、${c.trait}の割合は${p}である。この中から${n}${c.who}を無作為に抽出し、その中で${c.trait}の割合（標本比率）を求める。標本比率の期待値と標準偏差の組合せとして、正しいものを一つ選べ。`,
        ...shuffledChoices(
          rng,
          { label: lab(p, sd), note: `正しい。期待値は母比率と同じ${p}、標準偏差は $\\sqrt{${pq}\\div ${n}}=${num(sd, 8)}$。` },
          [
            { label: lab(np, round6(Math.sqrt(np * q))), note: `比率ではなく、該当する${c.who === '人' ? '人数' : c.who === '世帯' ? '世帯数' : '個数'}の期待値 $np=${np}$ と標準偏差 $\\sqrt{np(1-p)}=${num(Math.sqrt(np * q), 6)}$ を答えたもの。` },
            { label: lab(p, v), note: `標準偏差ではなく分散 $\\dfrac{p(1-p)}{n}=${num(v, 8)}$ を答えたもの。平方根をとり忘れている。` },
            { label: lab(p, s6), note: `$n$ で割るのを忘れ、$\\sqrt{p(1-p)}=\\sqrt{${pq}}=${num(s6, 6)}$ とした値。` },
            { label: lab(p, sdN), note: `$\\sqrt{p(1-p)}=${num(s6, 6)}$ を $\\sqrt{n}$ ではなく $n=${n}$ で割った値。` },
          ],
        ),
        explanation: `期待値は${p}、標準偏差は${num(sd, 8)}である。\n母比率を $p$、標本の大きさを $n$ とすると、標本比率の期待値は $p$、標準偏差は $\\sqrt{\\dfrac{p(1-p)}{n}}$。\n$p=${p}$、$n=${n}$ を代入すると、標準偏差は $\\sqrt{\\dfrac{${p}\\times ${q}}{${n}}}=\\sqrt{${num(v, 8)}}=${num(sd, 8)}$ となる。`,
      };
    },
  },
];

function round6(x: number): number {
  return Math.round(x * 1e8) / 1e8;
}
