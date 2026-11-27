/** 平方根の見積もりと Σ 記号の意味の類題 */
import { choicesFrom, int, num, pick, sum } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const SD_CONTEXTS = [
  { title: '路線ごとの到着の遅れの分散', intro: '5つのバス路線A〜Eについて、ある停留所での到着の遅れ（分）を1か月間記録し、路線ごとの分散をまとめたもの', head: '路線', col: '到着の遅れの分散', what: '到着の遅れの標準偏差', unit: '分' },
  { title: 'クラスごとの小テストの得点の分散', intro: '5つのクラスA〜Eで同じ小テストを行い、クラスごとの得点（点）の分散をまとめたもの', head: 'クラス', col: '得点の分散', what: '得点の標準偏差', unit: '点' },
  { title: '店舗ごとの1日の来客数の分散', intro: '5つの店舗A〜Eについて、1日の来客数（十人）を30日間記録し、店舗ごとの分散をまとめたもの', head: '店舗', col: '来客数の分散', what: '来客数の標準偏差', unit: '十人' },
  { title: '機械ごとの製品の重さの分散', intro: '5台の機械A〜Eで作ったクッキーの重さ（g）を測り、機械ごとの分散をまとめたもの', head: '機械', col: '重さの分散', what: '重さの標準偏差', unit: 'g' },
  { title: '品種ごとのトマトの糖度の分散', intro: '5つの品種A〜Eのトマトについて、糖度（度）を測り、品種ごとの分散をまとめたもの', head: '品種', col: '糖度の分散', what: '糖度の標準偏差', unit: '度' },
];

const SIGMA_CONTEXTS = [
  { title: '雑誌の販売冊数', intro: 'ある書店で売れた雑誌の冊数を、1日目から順に', idx: '日（$i$）', col: '売れた冊数', unit: '冊', lo: 3, hi: 18 },
  { title: '小テストの得点', intro: 'Aさんが受けた10点満点の小テストの得点を、1回目から順に', idx: '回（$i$）', col: '得点', unit: '点', lo: 2, hi: 10 },
  { title: '1日の歩いた距離', intro: 'Bさんが1日に歩いた距離を、1日目から順に', idx: '日（$i$）', col: '距離', unit: 'km', lo: 2, hi: 12 },
  { title: '水やりに使った水の量', intro: '花だんの水やりに使った水の量を、1日目から順に', idx: '日（$i$）', col: '水の量', unit: 'L', lo: 4, hi: 20 },
  { title: '練習でのシュート成功数', intro: 'Cさんの練習でのシュートの成功数を、1回目から順に', idx: '回（$i$）', col: '成功数', unit: '本', lo: 5, hi: 25 },
];

/** 小数第2位までで打ち切り（…を付けて見せる） */
const trunc2 = (x: number) => (Math.floor(x * 100 + 1e-9) / 100).toFixed(2);

export const generators: QuestionGenerator[] = [
  {
    id: 'math-sqrt-estimate',
    unitId: 'math-sqrt',
    skill: '平方根の概算（2乗ではさんで範囲を判断）',
    grade: 4,
    difficulty: 2,
    replaces: ['math-sqrt-q02'],
    build(rng) {
      const c = pick(rng, SD_CONTEXTS);
      const k = int(rng, 3, 9);
      const lo = k * k;
      const hi = (k + 1) * (k + 1);
      const correct = int(rng, lo + 1, hi - 1);
      const below = lo - int(rng, 1, 4);
      const above = hi + int(rng, 1, 4);
      const dbl = 2 * k + pick(rng, [0.5, 1, 1.5]);
      const self = k + pick(rng, [0.2, 0.5, 0.8]);
      if (dbl >= lo || self >= lo || new Set([correct, below, above, dbl, self]).size < 5) throw new Reject();
      const items = [
        { v: correct, note: (L: string) => `正しい。$${k}^2=${lo}$ と $${k + 1}^2=${hi}$ の間にある分散は、${L}の${num(correct)}だけである。`, ok: true },
        { v: below, note: () => `${num(below)}は $${k}^2=${lo}$ に近いが${lo}より小さいので、標準偏差は${k}${c.unit}に届かない（$\\sqrt{${num(below)}}=${trunc2(Math.sqrt(below))}\\cdots$）。「${k}に近い」だけで選ぶとこの誤りになる。`, ok: false },
        { v: above, note: () => `${num(above)}は $${k + 1}^2=${hi}$ に近いが${hi}より大きいので、標準偏差は${k + 1}${c.unit}を超える（$\\sqrt{${num(above)}}=${trunc2(Math.sqrt(above))}\\cdots$）。「${k + 1}に近い」だけで選ぶとこの誤りになる。`, ok: false },
        { v: dbl, note: () => `${k}と${k + 1}を2乗する代わりに2倍して、${2 * k}と${2 * k + 2}の間の分散を探した誤り。標準偏差は $\\sqrt{${num(dbl)}}=${trunc2(Math.sqrt(dbl))}\\cdots$（${c.unit}）である。`, ok: false },
        { v: self, note: () => `分散の値そのものを標準偏差と見て、${k}と${k + 1}の間の値を選んだ誤り。標準偏差は $\\sqrt{${num(self)}}=${trunc2(Math.sqrt(self))}\\cdots$（${c.unit}）である。`, ok: false },
      ];
      // 行の並び（どの記号にどの分散を割り当てるか）を乱数で決める
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [items[i], items[j]] = [items[j]!, items[i]!];
      }
      const answer = items.findIndex((x) => x.ok);
      const L = LETTERS[answer]!;
      const others = items
        .filter((x) => !x.ok)
        .map((x) => `$\\sqrt{${num(x.v)}}=${trunc2(Math.sqrt(x.v))}\\cdots$`)
        .join('、');
      return {
        stem: `次の表は、${c.intro}である。標準偏差は分散の正の平方根である。${c.what}が${k}${c.unit}より大きく${k + 1}${c.unit}より小さい${c.head}として正しいものを一つ選べ。`,
        figure: {
          type: 'table',
          title: c.title,
          columns: [c.head, c.col],
          rows: items.map((x, i) => [LETTERS[i]!, x.v]),
          headerColumn: true,
        },
        choices: [...LETTERS],
        answer,
        choiceNotes: items.map((x, i) => x.note(LETTERS[i]!)),
        explanation: `${L}が正しい。標準偏差が${k}より大きく${k + 1}より小さいということは、2乗した値である分散が $${k}^2=${lo}$ より大きく $${k + 1}^2=${hi}$ より小さいということである。表の分散のうち${lo}と${hi}の間にあるのは${num(correct)}（${L}）だけである。\n電卓で確かめると $\\sqrt{${num(correct)}}=${trunc2(Math.sqrt(correct))}\\cdots$ で、たしかに${k}と${k + 1}の間にある。ほかは ${others} で、どれも範囲の外である。`,
      };
    },
  },
  {
    id: 'math-sqrt-sigma',
    unitId: 'math-sqrt',
    skill: 'Σ記号の意味（表の値の合計）',
    grade: 4,
    difficulty: 1,
    replaces: ['math-sqrt-q05'],
    build(rng) {
      const c = pick(rng, SIGMA_CONTEXTS);
      const n = int(rng, 5, 6);
      const xs = Array.from({ length: n }, () => int(rng, c.lo, c.hi));
      if (new Set(xs).size < n - 1) throw new Reject();
      // 平均（取り違えの選択肢）が整数になるよう、最後の値を調整する
      const rem = sum(xs) % n;
      if (rem) xs[n - 1] = xs[n - 1]! - rem >= c.lo ? xs[n - 1]! - rem : xs[n - 1]! + (n - rem);
      const total = sum(xs);
      if (total % n !== 0) throw new Reject();
      const idxSum = (n * (n + 1)) / 2;
      const weighted = sum(xs.map((x, i) => (i + 1) * x));
      const xn = xs[n - 1]!;
      const x1 = xs[0]!;
      const vars = xs.map((_, i) => `x_${i + 1}`).join(', ');
      return {
        stem: `次の表は、${c.intro} $${vars}$ として記録したものである。$\\sum_{i=1}^{${n}}x_i$ の値として正しいものを一つ選べ。`,
        figure: {
          type: 'table',
          title: c.title,
          columns: [c.idx, `${c.col} $x_i$（${c.unit}）`],
          rows: xs.map((x, i) => [i + 1, x]),
          headerColumn: true,
        },
        ...choicesFrom(
          { value: total, label: String(total), note: `正しい。$x_1$ から $x_${n}$ までの${n}つの値をすべて足すと $${xs.join('+')}=${total}$。` },
          [
            { value: total / n, label: String(total / n), note: `合計の${total}を個数の${n}で割った平均値。Σは足すだけで、個数で割る計算はふくまない。` },
            { value: xn, label: String(xn), note: `最後の $x_${n}$ の値だけを答えたもの。Σは1番目から${n}番目までをすべて足す。` },
            { value: idxSum, label: String(idxSum), note: `番号の $i$ そのものを足した値（$${Array.from({ length: n }, (_, i) => i + 1).join('+')}$）。足すのは番号ではなく $x_i$ である。` },
            { value: x1 + xn, label: String(x1 + xn), note: `最初の $x_1=${x1}$ と最後の $x_${n}=${xn}$ だけを足した値。「$i=1$ から${n}まで」は途中の番号もすべてふくむ。` },
            { value: total + idxSum, label: String(total + idxSum), note: `$x_i$ に加えて番号の $i$ も足した値。番号 $i$ は何番目かを表す目印で、足すのは $x_i$ だけである。` },
            { value: weighted, label: String(weighted), note: `それぞれの $x_i$ に番号の $i$ を掛けてから足した値（$1\\times x_1+2\\times x_2+\\cdots$）。Σの式 $x_i$ には $i$ を掛ける計算はない。` },
          ],
          { rng },
        ),
        explanation: `${total}が正しい。$\\sum_{i=1}^{${n}}x_i$ は、番号 $i$ を1から${n}まで変えながら $x_i$ をすべて足すこと、つまり $${xs.map((_, i) => `x_${i + 1}`).join('+')}$ を表す。\n表の値を入れると $${xs.join('+')}=${total}$ である。`,
      };
    },
  },
];
