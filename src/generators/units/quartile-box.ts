/** 四分位数・四分位範囲（高校数学Iの方式）の類題 */
import { choicesFrom, distinctInts, int, median, num, pick, quartiles, type Candidate } from '../kit.ts';
import type { Rng } from '../../engine/rng.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

const CONTEXTS = [
  { lead: (n: number) => `${n}人の生徒が20点満点の小テストを受けたところ、得点は次のとおりであった。`, unit: '点', lo: 3, hi: 20 },
  { lead: (n: number) => `ある喫茶店で、${n}日間の来店客数を記録したところ、次のとおりであった。`, unit: '人', lo: 18, hi: 60 },
  { lead: (n: number) => `${n}人の中学生に、先月読んだ本の冊数をたずねたところ、次のとおりであった。`, unit: '冊', lo: 0, hi: 16 },
  { lead: (n: number) => `${n}人の社員について、通勤時間を調べたところ、次のとおりであった。`, unit: '分', lo: 8, hi: 75 },
  { lead: (n: number) => `ある農家で、${n}日間に出荷したトマトの箱数を記録したところ、次のとおりであった。`, unit: '箱', lo: 12, hi: 48 },
];

/** データと、正しい四分位数・よくある取り違えの値 */
function setup(rng: Rng) {
  const c = pick(rng, CONTEXTS);
  const n = int(rng, 7, 12);
  const xs = distinctInts(rng, n, c.lo, c.hi);
  const s = [...xs].sort((a, b) => a - b);
  const half = Math.floor(n / 2);
  const odd = n % 2 === 1;
  const { q1, q2, q3 } = quartiles(xs);
  const lower = s.slice(0, half);
  const upper = s.slice(n - half);
  // 中央値を上下に含めて分けた値（奇数個のときだけ意味がある）
  const q1in = median(s.slice(0, half + 1));
  const q3in = median(s.slice(n - half - 1));
  // 並べ替えずに、与えられた順のまま前後に分けた値
  const q1raw = median(xs.slice(0, half));
  const q3raw = median(xs.slice(n - half));
  // 並べ替えた後でないと区別できないデータだけ使う
  if (q1raw === q1 && q3raw === q3) throw new Reject();
  const label = (v: number) => `${num(v, 1)}${c.unit}`;
  return { c, n, xs, s, half, odd, q1, q2, q3, lower, upper, q1in, q3in, q1raw, q3raw, label };
}

function steps(d: ReturnType<typeof setup>): string {
  const { n, s, odd, q2, lower, upper, half } = d;
  const split = odd
    ? `データは${n}個（奇数）なので、中央値は${half + 1}番目の${num(q2, 1)}。中央値を除いた下半分は ${lower.join(', ')}、上半分は ${upper.join(', ')}（各${half}個）。`
    : `データは${n}個（偶数）なので、小さい方の${half}個 ${lower.join(', ')} が下半分、大きい方の${half}個 ${upper.join(', ')} が上半分。`;
  return `まず小さい順に並べると、${s.join(', ')}。\n${split}`;
}

const medianOf = (xs: number[]) => {
  const k = xs.length;
  return k % 2 ? `真ん中の${num(median(xs), 1)}` : `$(${xs[k / 2 - 1]}+${xs[k / 2]})\\div 2=${num(median(xs), 1)}$`;
};

export const generators: QuestionGenerator[] = [
  {
    id: 'quartile-box-quartile',
    unitId: 'quartile-box',
    skill: '第1・第3四分位数（並べ替え前のデータから）',
    grade: 4,
    difficulty: 2,
    replaces: ['quartile-box-q03'],
    build(rng) {
      const d = setup(rng);
      const { c, xs, s, odd, q1, q2, q3, lower, upper, q1in, q3in, q1raw, q3raw, label } = d;
      const first = rng() < 0.5;
      const name = first ? '第1四分位数' : '第3四分位数';
      const other = first ? '第3四分位数' : '第1四分位数';
      const ans = first ? q1 : q3;
      const half = first ? '下半分' : '上半分';
      const wrongs: Candidate[] = [
        { value: first ? q3 : q1, label: label(first ? q3 : q1), note: `${other}を答えている。${name}は${half}の中央値である。` },
        { value: q2, label: label(q2), note: `全体の中央値（第2四分位数）を答えている。${name}は${half}の中央値である。` },
        { value: first ? q1raw : q3raw, label: label(first ? q1raw : q3raw), note: `並べ替えずに、与えられた順のまま${first ? '前' : '後ろ'}の${d.half}個を${half}として中央値をとった値。先に全体を小さい順に並べる。` },
        { value: q3 - q1, label: label(q3 - q1), note: `第3四分位数−第1四分位数で、四分位範囲を答えている。` },
        { value: s[s.length - 1]! - s[0]!, label: label(s[s.length - 1]! - s[0]!), note: `最大値−最小値で、範囲を答えている。` },
      ];
      if (odd) {
        wrongs.push({
          value: first ? q1in : q3in,
          label: label(first ? q1in : q3in),
          note: `中央値${num(q2, 1)}を${half}に入れて、${(first ? s.slice(0, d.half + 1) : s.slice(s.length - d.half - 1)).join(', ')}の中央値をとった値。データ数が奇数のとき、中央値は${half}に入れない。`,
        });
      }
      const part = first ? lower : upper;
      return {
        stem: `${c.lead(xs.length)}\n${xs.join(', ')}（${c.unit}）\nこのデータの${name}として正しいものを一つ選べ。`,
        ...choicesFrom({ value: ans, label: label(ans), note: `正しい。${half} ${part.join(', ')} の中央値は${num(ans, 1)}。` }, wrongs, { rng }),
        explanation: `正答は${label(ans)}。${name}は、小さい順に並べたデータの${half}の中央値。\n${steps(d)}\n${half}の中央値は${medianOf(part)}。これが${name}である。`,
      };
    },
  },
  {
    id: 'quartile-box-iqr',
    unitId: 'quartile-box',
    skill: '四分位範囲の計算（並べ替え前のデータから）',
    grade: 4,
    difficulty: 2,
    replaces: ['quartile-box-q04'],
    build(rng) {
      const d = setup(rng);
      const { c, xs, s, odd, q1, q2, q3, lower, upper, q1in, q3in, q1raw, q3raw, label } = d;
      const iqr = q3 - q1;
      const range = s[s.length - 1]! - s[0]!;
      const wrongs: Candidate[] = [
        { value: range, label: label(range), note: `最大値${s[s.length - 1]}−最小値${s[0]}で、範囲を答えている。四分位範囲は四分位数どうしの差である。` },
        { value: iqr / 2, label: label(iqr / 2), note: `四分位範囲${num(iqr, 1)}を2で割った値。四分位範囲は第3四分位数−第1四分位数で、2で割らない。` },
        { value: q3raw - q1raw, label: label(q3raw - q1raw), note: `並べ替えずに、与えられた順のまま前後に分けて求めた$${num(q3raw, 1)}-${num(q1raw, 1)}$。先に全体を小さい順に並べる。` },
        { value: q3 - q2, label: label(q3 - q2), note: `第3四分位数${num(q3, 1)}から、第1四分位数ではなく中央値${num(q2, 1)}を引いた値。` },
        { value: q2 - q1, label: label(q2 - q1), note: `中央値${num(q2, 1)}から第1四分位数${num(q1, 1)}を引いた値。四分位範囲は第3四分位数−第1四分位数である。` },
      ];
      if (odd) {
        wrongs.push({ value: q3in - q1in, label: label(q3in - q1in), note: `中央値${num(q2, 1)}を下半分と上半分の両方に入れて求めた$${num(q3in, 1)}-${num(q1in, 1)}$。データ数が奇数のとき、中央値はどちらにも入れない。` });
      }
      return {
        stem: `${c.lead(xs.length)}\n${xs.join(', ')}（${c.unit}）\nこのデータの四分位範囲として正しいものを一つ選べ。`,
        ...choicesFrom({ value: iqr, label: label(iqr), note: `正しい。第3四分位数${num(q3, 1)}−第1四分位数${num(q1, 1)}＝${num(iqr, 1)}。` }, wrongs, { rng }),
        explanation: `正答は${label(iqr)}。四分位範囲は「第3四分位数 − 第1四分位数」。\n${steps(d)}\n第1四分位数は下半分の中央値で${medianOf(lower)}、第3四分位数は上半分の中央値で${medianOf(upper)}。\n四分位範囲は $${num(q3, 1)}-${num(q1, 1)}=${num(iqr, 1)}$（${c.unit}）。`,
      };
    },
  },
];
