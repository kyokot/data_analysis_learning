/** 分散・標準偏差（n で割る）と、y=ax+b と変換したときの分散の類題 */
import { choicesFrom, fixed, int, pick, sum, type Candidate } from '../kit.ts';
import type { Rng } from '../../engine/rng.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

const CONTEXTS = [
  { title: 'Aさんの読書時間', lead: (n: number) => `次の表は、Aさんの${n}日間の読書時間を記録したものである。`, head: '日', item: (i: number) => `${i + 1}日目`, col: '読書時間（分）', what: '読書時間', unit: '分', lo: 15, hi: 40, d: 8 },
  { title: '通学時間', lead: (n: number) => `次の表は、${n}人の生徒の通学時間を調べた結果である。`, head: '生徒', item: (i: number) => 'ABCDEF'[i]!, col: '通学時間（分）', what: '通学時間', unit: '分', lo: 12, hi: 35, d: 9 },
  { title: '小テストの得点', lead: (n: number) => `次の表は、${n}人の生徒が受けた20点満点の小テストの得点である。`, head: '生徒', item: (i: number) => 'ABCDEF'[i]!, col: '得点（点）', what: '得点', unit: '点', lo: 9, hi: 13, d: 6 },
  { title: 'パン屋の来客数', lead: (n: number) => `次の表は、あるパン屋の${n}日間の開店直後1時間の来客数である。`, head: '日', item: (i: number) => `${i + 1}日目`, col: '来客数（人）', what: '来客数', unit: '人', lo: 20, hi: 45, d: 10 },
  { title: '握力の記録', lead: (n: number) => `次の表は、${n}人の生徒の握力を測った結果である。`, head: '生徒', item: (i: number) => 'ABCDEF'[i]!, col: '握力（kg）', what: '握力', unit: 'kg', lo: 22, hi: 38, d: 7 },
];

/** 平均が整数になる 5〜6 個の整数データ */
function setup(rng: Rng) {
  const c = pick(rng, CONTEXTS);
  const n = int(rng, 5, 6);
  const m = int(rng, c.lo, c.hi);
  const devs = Array.from({ length: n - 1 }, () => int(rng, -c.d, c.d));
  const last = -sum(devs);
  if (Math.abs(last) > c.d) throw new Reject();
  devs.push(last);
  // 偏差が 0 ばかりのデータや、偏差の絶対値がすべて同じデータは避ける
  if (new Set(devs.map(Math.abs)).size < 3) throw new Reject();
  const xs = devs.map((d) => m + d);
  if (xs.some((x) => x < 0)) throw new Reject();
  const sq = devs.map((d) => d * d);
  const ss = sum(sq);
  const absMean = sum(devs.map(Math.abs)) / n;
  const figure = {
    type: 'table' as const,
    title: c.title,
    columns: [c.head, c.col],
    rows: xs.map((x, i) => [c.item(i), x] as [string, number]),
    headerColumn: true,
  };
  const tex = (ys: number[]) => ys.map(String).join(',\\ ');
  const meanLine = `平均値は$(${xs.join('+')})\\div ${n}=${sum(xs)}\\div ${n}=${m}$（${c.unit}）。`;
  const devLine = `偏差（各値−平均値）は$${tex(devs)}$、その2乗は$${tex(sq)}$で、合計は${ss}。`;
  return { c, n, m, xs, devs, sq, ss, absMean, figure, meanLine, devLine, tex };
}

export const generators: QuestionGenerator[] = [
  {
    id: 'variance-sd-variance',
    unitId: 'variance-sd',
    skill: 'データから分散を計算する',
    grade: 3,
    difficulty: 2,
    replaces: ['variance-sd-q03'],
    build(rng) {
      const d = setup(rng);
      const { c, n, ss, absMean, devs } = d;
      const v = ss / n;
      const label = (x: number) => fixed(x, 1);
      const absList = devs.map(Math.abs).join(',');
      return {
        stem: `${c.lead(n)}この${c.what}の分散として正しいものを一つ選べ。ただし、割り切れない値は小数第2位を四捨五入してある。`,
        figure: d.figure,
        ...choicesFrom(
          { value: v, label: label(v), note: `正しい。偏差の2乗の合計${ss}をデータの個数${n}で割った値である。` },
          [
            { value: ss / (n - 1), label: label(ss / (n - 1)), note: `偏差の2乗の合計${ss}を、$n=${n}$ではなく$n-1=${n - 1}$で割った値。ここでは$n$で割る。` },
            { value: absMean, label: label(absMean), note: `偏差を2乗せず、絶対値$${absList}$の平均を求めた値。分散は偏差の2乗の平均である。` },
            { value: Math.sqrt(v), label: label(Math.sqrt(v)), note: `分散${label(v)}の平方根、つまり標準偏差を答えた値。問われているのは分散である。` },
            { value: ss, label: label(ss), note: `偏差の2乗の合計${ss}のままで、データの個数${n}で割り忘れた値。` },
          ],
          { rng },
        ),
        explanation: `分散は${label(v)}である。分散は「偏差の2乗の平均」で求める。\n${d.meanLine}\n${d.devLine}\nこれをデータの個数${n}で割って、$${ss}\\div ${n}${Number.isInteger(v * 10) ? `=${String(v)}$` : `=${fixed(v, 3)}\\cdots$、小数第2位を四捨五入して${label(v)}`}。`,
      };
    },
  },
  {
    id: 'variance-sd-sd',
    unitId: 'variance-sd',
    skill: 'データから標準偏差を計算する',
    grade: 3,
    difficulty: 2,
    replaces: ['variance-sd-q04'],
    build(rng) {
      const d = setup(rng);
      const { c, n, m, ss, absMean, devs } = d;
      const v = ss / n;
      const sd = Math.sqrt(v);
      // 四捨五入の境目に近い値は避ける（丸め方の違いで正誤が入れ替わらないように）
      const frac10 = (sd * 10) % 1;
      if (Math.abs(frac10 - 0.5) < 0.06) throw new Reject();
      const label = (x: number) => `${fixed(x, 1)}${c.unit}`;
      const vText = Number.isInteger(v) ? String(v) : `${fixed(v, 3)}\\cdots`;
      const absList = devs.map(Math.abs).join(',');
      const sdText = Number.isInteger(sd) ? String(sd) : `${fixed(sd, 3)}\\cdots`;
      return {
        stem: `${c.lead(n)}${n}個のデータの平均値は${m}${c.unit}である。${c.what}の標準偏差として正しいものを一つ選べ。ただし、小数第2位を四捨五入した値で答えよ。`,
        figure: d.figure,
        ...choicesFrom(
          { value: sd, label: label(sd), note: `正しい。分散$${ss}\\div ${n}$の正の平方根である。` },
          [
            { value: Math.sqrt(ss / (n - 1)), label: label(Math.sqrt(ss / (n - 1))), note: `偏差の2乗の合計${ss}を$n-1=${n - 1}$で割ってから平方根をとった値。ここでは$n=${n}$で割る。` },
            { value: absMean, label: label(absMean), note: `偏差を2乗せず、絶対値$${absList}$の平均を求めた値。2乗してから平均し、最後に平方根をとる。` },
            { value: v, label: label(v), note: `分散$${ss}\\div ${n}$を答えた値。標準偏差はその平方根である。` },
            { value: Math.sqrt(ss), label: label(Math.sqrt(ss)), note: `偏差の2乗の合計${ss}を${n}で割らずに、そのまま平方根をとった値。` },
            { value: Math.sqrt(ss) / n, label: label(Math.sqrt(ss) / n), note: `偏差の2乗の合計${ss}の平方根を先にとり、それを${n}で割った値。${n}で割ってから平方根をとる。` },
          ],
          { rng },
        ),
        explanation: `標準偏差は${label(sd)}である。標準偏差は分散（偏差の2乗の平均）の正の平方根。\n${d.devLine}\n分散は$${ss}\\div ${n}=${vText}$。\n標準偏差は$\\sqrt{${Number.isInteger(v) ? v : `${ss}\\div ${n}`}}=${sdText}$で、小数第2位を四捨五入して${label(sd)}。`,
      };
    },
  },
  {
    id: 'variance-sd-linear',
    unitId: 'variance-sd',
    skill: 'y = ax + b と変換したときの分散',
    grade: 3,
    difficulty: 2,
    replaces: ['variance-sd-q08'],
    build(rng) {
      const scenes = [
        () => {
          const a = pick(rng, [0.5, 0.8, 1.2, 1.5, 2]);
          const b = pick(rng, [10, 15, 20, 30]);
          const mx = int(rng, 40, 65);
          const sx = pick(rng, [4, 5, 6, 8, 10, 12]);
          return { a, b, mx, sx, lead: `ある検定試験の素点$x$（点）は、受験者全体で平均値が${mx}点、分散が${sx * sx}であった。主催者は、素点を$y=${a}x+${b}$という式で換算した得点$y$（点）を発表する。`, y: '換算した得点$y$' };
        },
        () => {
          const a = 1.8;
          const b = 32;
          const mx = int(rng, 8, 26);
          const sx = pick(rng, [2, 3, 4, 5]);
          return { a, b, mx, sx, lead: `ある町の30日間の最高気温$x$（℃）は、平均値が${mx}℃、分散が${sx * sx}であった。この気温を、$y=1.8x+32$という式で華氏の温度$y$（°F）に直す。`, y: '華氏の温度$y$' };
        },
        () => {
          const a = pick(rng, [2, 3]);
          const b = pick(rng, [5, 10, 20]);
          const mx = int(rng, 10, 30);
          const sx = pick(rng, [2, 3, 4, 5, 6]);
          return { a, b, mx, sx, lead: `ある店のポイントカードでは、1回の買い物の点数$x$（点）に応じて、$y=${a}x+${b}$で求めたポイント$y$がもらえる。会員全体の1回あたりの点数$x$は、平均値が${mx}点、分散が${sx * sx}であった。`, y: 'ポイント$y$' };
        },
        () => {
          const a = 1.1;
          const b = 0;
          const mx = int(rng, 6, 15) * 100;
          const sx = pick(rng, [30, 40, 50, 60]);
          return { a, b, mx, sx, lead: `ある雑貨店で扱う商品の税抜価格$x$（円）は、平均値が${mx}円、分散が${sx * sx}である。すべての商品の価格を$y=1.1x$で税込価格$y$（円）に直す。ただし、端数の処理は行わないものとする。`, y: '税込価格$y$' };
        },
      ];
      const s = pick(rng, scenes)();
      const { a, b, mx, sx } = s;
      const vx = sx * sx;
      const r2 = (x: number) => Math.round(x * 100) / 100;
      const vy = r2(a * a * vx);
      const my = r2(a * mx + b);
      const cands = [vy, r2(a * vx), r2(vy + b), r2(a * vx + b), vx];
      const digits = cands.some((x) => !Number.isInteger(r2(x * 10))) ? 2 : cands.some((x) => !Number.isInteger(x)) ? 1 : 0;
      const dec = (x: number) => (Number.isInteger(x) ? 0 : Number.isInteger(r2(x * 10)) ? 1 : 2);
      const label = (x: number) => fixed(x, digits);
      const a2 = r2(a * a);
      const wrongs: Candidate[] = [
        { value: r2(a * vx), label: label(a * vx), note: `分散を$a^2$倍ではなく$a$倍した値（$${a}\\times ${vx}$）。$${a}$倍になるのは標準偏差である。` },
        { value: vx, label: label(vx), note: `分散は変わらないと考えた値。値を$${a}$倍すると散らばりも変わる。` },
        ...(dec(my) <= digits ? [{ value: my, label: label(my), note: `$y$の平均値（$${a}\\times ${mx}${b ? `+${b}` : ''}$）を答えた値。問われているのは分散である。` }] : []),
      ];
      if (b) {
        wrongs.push(
          { value: r2(vy + b), label: label(vy + b), note: `$${a}^2\\times ${vx}=${num2(vy)}$としたあと、さらに${b}を足した値。定数を足しても分散は変わらない。` },
          { value: r2(a * vx + b), label: label(a * vx + b), note: `平均値と同じ式に分散を入れて$${a}\\times ${vx}+${b}$とした値。分散は$a^2$倍になり、$b$は影響しない。` },
        );
      }
      return {
        stem: `${s.lead}${s.y}の分散として正しいものを一つ選べ。`,
        ...choicesFrom({ value: vy, label: label(vy), note: `正しい。分散は$${a}^2=${num2(a2)}$倍に${b ? `なり、${b}を足しても変わらない` : 'なる'}。` }, wrongs, { rng }),
        explanation: `${s.y}の分散は${label(vy)}である。$y=ax+b$と変換すると、分散は$a^2$倍になり、足した$b$は分散に影響しない。\n$${a}^2\\times ${vx}=${num2(a2)}\\times ${vx}=${num2(vy)}$。\n標準偏差で考えると、$\\sqrt{${vx}}=${sx}$が$${a}$倍の$${num2(a * sx)}$になり、$${num2(a * sx)}^2=${num2(vy)}$。`,
      };
    },
  },
];

function num2(x: number): string {
  return String(Math.round(x * 100) / 100);
}
