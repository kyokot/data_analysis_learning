/** 割合・増減率の類題 */
import { choicesFrom, fixed, int, pick } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

const ITEMS = [
  { what: '図書室の貸出冊数', unit: '冊' },
  { what: '店の来客数', unit: '人' },
  { what: '農園のいちごの収穫量', unit: 'kg' },
  { what: '市立プールの利用者数', unit: '人' },
  { what: 'パン屋の食パンの売上個数', unit: '個' },
];

export const generators: QuestionGenerator[] = [
  {
    id: 'math-ratio-change',
    unitId: 'math-ratio',
    skill: '増減率の計算（もとにする量は変化の前の値）',
    grade: 4,
    difficulty: 1,
    replaces: ['math-ratio-q03'],
    build(rng) {
      const it = pick(rng, ITEMS);
      const before = int(rng, 8, 60) * 10;
      const up = rng() < 0.5;
      const pct = pick(rng, [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60]);
      const after = Math.round(up ? before * (1 + pct / 100) : before * (1 - pct / 100));
      if (Math.abs(after - before) * 100 !== pct * before) throw new Reject();
      const diff = Math.abs(after - before);
      const word = up ? '増えた' : '減った';
      const label = (v: number) => `${fixed(v, 1)}%`;
      return {
        stem: `ある${it.what}は、先月が${before}${it.unit}、今月が${after}${it.unit}であった。今月は先月に比べて何%${word}か。小数第2位を四捨五入した値として正しいものを一つ選べ。`,
        ...choicesFrom(
          { value: pct, label: label(pct), note: `正しい。もとにする量は先月の${before}${it.unit}。$${diff}\\div ${before}\\times 100=${pct}$（%）。` },
          [
            { value: (diff / after) * 100, label: label((diff / after) * 100), note: `変化した量を今月の${after}${it.unit}で割った値。もとにする量は変化の前（先月）である。` },
            { value: (after / before) * 100, label: label((after / before) * 100), note: '今月が先月の何%にあたるか（比率）。増減率は、この比率と100%との差である。' },
            { value: (before / after) * 100, label: label((before / after) * 100), note: '先月を今月で割った比率。割る数と割られる数が逆で、しかも増減率ではなく比率のままである。' },
            { value: Math.abs((before / after) * 100 - 100), label: label(Math.abs((before / after) * 100 - 100)), note: '先月を今月で割ってから100を引いた値。割る数と割られる数が逆である。' },
          ],
          { rng },
        ),
        explanation: `増減率は「変化した量 ÷ もとにする量 × 100」。もとにする量は変化の前の値（先月）。\n変化した量は ${diff}${it.unit} なので、$${diff}\\div ${before}\\times 100=${pct}$（%）${word}。`,
      };
    },
  },
];
