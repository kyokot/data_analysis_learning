/** 代表値（平均値・中央値）の類題 */
import { choicesFrom, distinctInts, int, mean, median, num, pick, sum } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

const CONTEXTS = [
  { count: '人', who: '生徒', what: '1週間の読書時間', unit: '分', lo: 10, hi: 90 },
  { count: '店', who: '店', what: 'ある日の来客数', unit: '人', lo: 20, hi: 120 },
  { count: '人', who: '選手', what: '練習で決めたシュートの本数', unit: '本', lo: 3, hi: 30 },
  { count: '世帯', who: '世帯', what: '1か月に買った雑誌の冊数', unit: '冊', lo: 0, hi: 12 },
  { count: '人', who: '生徒', what: '反復横とびの回数', unit: '回', lo: 38, hi: 62 },
];

export const generators: QuestionGenerator[] = [
  {
    id: 'central-mean',
    unitId: 'central',
    skill: '平均値の計算',
    grade: 4,
    difficulty: 1,
    replaces: ['central-q01'],
    build(rng) {
      const c = pick(rng, CONTEXTS);
      const n = int(rng, 5, 8);
      const xs = Array.from({ length: n }, () => int(rng, c.lo, c.hi));
      const total = sum(xs);
      // 平均がきりのよい値（整数か小数第1位まで）になるものだけ使う
      if ((total * 10) % n !== 0) throw new Reject();
      const m = total / n;
      const sorted = [...xs].sort((a, b) => a - b);
      const mid = (sorted[0]! + sorted[n - 1]!) / 2;
      const label = (v: number) => `${num(v, 1)}${c.unit}`;
      return {
        stem: `次のデータは、${n}${c.count}の${c.who}について、${c.what}（${c.unit}）を調べたものである。\n${xs.join(', ')}\nこのデータの平均値として正しいものを一つ選べ。`,
        ...choicesFrom(
          { value: m, label: label(m), note: `正しい。合計${total}${c.unit}をデータの個数${n}で割る。` },
          [
            { value: median(xs), label: label(median(xs)), note: '小さい順に並べたときの真ん中の値（中央値）。平均値は合計を個数で割って求める。' },
            { value: total / (n - 1), label: label(total / (n - 1)), note: `合計を、データの個数より1少ない${n - 1}で割った値。平均値は個数${n}で割る。` },
            { value: mid, label: label(mid), note: '最小値と最大値の平均。平均値はすべてのデータを足して個数で割る。' },
            { value: total / (n + 1), label: label(total / (n + 1)), note: `合計を${n + 1}で割った値。データの個数を数え間違えている。` },
          ],
          { rng },
        ),
        explanation: `平均値は「データの合計 ÷ データの個数」。\n合計は $${xs.join('+')}=${total}$、個数は${n}なので、$${total}\\div ${n}=${num(m, 1)}$（${c.unit}）。`,
      };
    },
  },
  {
    id: 'central-median',
    unitId: 'central',
    skill: '中央値（データ数が偶数・奇数）',
    grade: 4,
    difficulty: 1,
    replaces: ['central-q02'],
    build(rng) {
      const c = pick(rng, CONTEXTS);
      const n = int(rng, 6, 9);
      const xs = distinctInts(rng, n, c.lo, c.hi);
      const s = [...xs].sort((a, b) => a - b);
      const med = median(xs);
      // 並べ替えないときの真ん中が、正しい中央値と違うデータだけ使う
      const unsorted = n % 2 ? xs[(n - 1) / 2]! : (xs[n / 2 - 1]! + xs[n / 2]!) / 2;
      if (unsorted === med) throw new Reject();
      const even = n % 2 === 0;
      const lowMid = s[Math.floor((n - 1) / 2)]!;
      const highMid = s[Math.floor(n / 2)]!;
      const label = (v: number) => `${num(v, 1)}${c.unit}`;
      const avg = Math.round(mean(xs) * 10) / 10;
      const wrongs = even
        ? [
            { value: unsorted, label: label(unsorted), note: '並べ替えずに、与えられた順のまま真ん中の2つを平均した値。中央値は小さい順に並べてから求める。' },
            { value: lowMid, label: label(lowMid), note: '真ん中の2つのうち小さい方だけを答えた値。データ数が偶数のときは、真ん中の2つの平均をとる。' },
            { value: highMid, label: label(highMid), note: '真ん中の2つのうち大きい方だけを答えた値。データ数が偶数のときは、真ん中の2つの平均をとる。' },
            { value: avg, label: label(avg), note: '平均値（を小数第1位で丸めた値）。中央値は合計を使わず、並べたときの順位で決まる。' },
          ]
        : [
            { value: unsorted, label: label(unsorted), note: '並べ替えずに、与えられた順のまま真ん中の値を答えたもの。中央値は小さい順に並べてから求める。' },
            { value: s[(n - 1) / 2 - 1]!, label: label(s[(n - 1) / 2 - 1]!), note: '真ん中より1つ小さい順位の値。順位を数え間違えている。' },
            { value: s[(n - 1) / 2 + 1]!, label: label(s[(n - 1) / 2 + 1]!), note: '真ん中より1つ大きい順位の値。順位を数え間違えている。' },
            { value: avg, label: label(avg), note: '平均値（を小数第1位で丸めた値）。中央値は並べたときの順位で決まる。' },
          ];
      return {
        stem: `次のデータは、${n}${c.count}の${c.who}の${c.what}（${c.unit}）である。\n${xs.join(', ')}\nこのデータの中央値として正しいものを一つ選べ。`,
        ...choicesFrom({ value: med, label: label(med), note: even ? '正しい。小さい順に並べ、真ん中の2つの平均をとる。' : '正しい。小さい順に並べた真ん中の値。' }, wrongs, { rng }),
        explanation: `中央値は、データを小さい順に並べたときの真ん中の値。\n並べると ${s.join(', ')}。\n${
          even
            ? `データは${n}個（偶数）なので、${n / 2}番目と${n / 2 + 1}番目の平均をとる。$(${lowMid}+${highMid})\\div 2=${num(med, 1)}$（${c.unit}）。`
            : `データは${n}個（奇数）なので、${(n + 1) / 2}番目の値 ${med}（${c.unit}）が中央値。`
        }`,
      };
    },
  },
];
