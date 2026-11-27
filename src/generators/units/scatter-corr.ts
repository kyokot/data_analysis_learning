/** 散布図と相関係数（共分散から相関係数・データから共分散）の類題 */
import { choicesFrom, fixed, int, mean, pick, round, sum, type Candidate } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

/** 文中に書く数（負の数は「−」） */
const tx = (s: string) => s.replace(/^-/, '−');

/** sign: 1 = 正の相関になりやすい場面、-1 = 負の相関になりやすい場面 */
const R_CONTEXTS = [
  { lead: 'ある高校の生徒50人について、1日の家庭学習の時間 $x$（分）と数学のテストの得点 $y$（点）を調べた', xu: '分', yu: '点', sx: [10, 30], sy: [5, 20], sign: 1 },
  { lead: 'ある商店街の和菓子店の60日間について、1日の最高気温 $x$（℃）とかき氷の販売数 $y$（個）を調べた', xu: '℃', yu: '個', sx: [2, 8], sy: [10, 40], sign: 1 },
  { lead: 'ある中古車販売店の同じ車種の中古車40台について、走行距離 $x$（千km）と販売価格 $y$（万円）を調べた', xu: '千km', yu: '万円', sx: [10, 30], sy: [5, 25], sign: -1 },
  { lead: 'ある地域の賃貸マンション30件について、最寄り駅からの徒歩時間 $x$（分）と1か月の家賃 $y$（千円）を調べた', xu: '分', yu: '千円', sx: [3, 12], sy: [4, 20], sign: -1 },
  { lead: 'ある市の家庭45世帯について、1か月の電気使用量 $x$（kWh）と電気料金 $y$（百円）を調べた', xu: 'kWh', yu: '百円', sx: [20, 60], sy: [10, 30], sign: 1 },
];

const COV_CONTEXTS = [
  { lead: 'ある陸上部の部員5人について、1週間の練習日数 $x$（日）と立ち幅とびの記録の伸び $y$（cm）', title: '5人の練習日数と記録の伸び', key: '部員', xh: '練習日数 $x$（日）', yh: '記録の伸び $y$（cm）', xu: '日', yu: 'cm', x: [1, 7], y: [0, 20], sign: 1 },
  { lead: 'ある駅の周辺にある5つの駐車場について、駅からの徒歩時間 $x$（分）と1日の利用台数 $y$（台）', title: '5つの駐車場の徒歩時間と利用台数', key: '駐車場', xh: '徒歩時間 $x$（分）', yh: '利用台数 $y$（台）', xu: '分', yu: '台', x: [1, 15], y: [10, 40], sign: -1 },
  { lead: 'あるパン屋の5日間について、最高気温 $x$（℃）と冷たい飲み物の販売数 $y$（本）', title: '5日間の最高気温と販売数', key: '日', xh: '最高気温 $x$（℃）', yh: '販売数 $y$（本）', xu: '℃', yu: '本', x: [18, 32], y: [10, 40], sign: 1 },
  { lead: 'ある家電店で売られている5台の掃除機について、本体の重さ $x$（kg）と連続運転時間 $y$（分）', title: '5台の掃除機の重さと運転時間', key: '掃除機', xh: '重さ $x$（kg）', yh: '運転時間 $y$（分）', xu: 'kg', yu: '分', x: [1, 6], y: [20, 60], sign: 1 },
  { lead: 'ある中学校の生徒5人について、1日のスマートフォンの利用時間 $x$（時間）と睡眠時間 $y$（時間）', title: '5人の利用時間と睡眠時間', key: '生徒', xh: '利用時間 $x$（時間）', yh: '睡眠時間 $y$（時間）', xu: '時間', yu: '時間', x: [1, 7], y: [4, 10], sign: -1 },
];

/** lo〜hi の整数5個で、合計が5の倍数（平均が整数）になるもの */
function fiveWithIntMean(rng: () => number, lo: number, hi: number): number[] {
  const xs = Array.from({ length: 4 }, () => int(rng, lo, hi));
  let t = int(rng, lo, hi);
  t -= (sum(xs) + t) % 5;
  if (t < lo) t += 5;
  if (t > hi) throw new Reject();
  return [...xs, t];
}

export const generators: QuestionGenerator[] = [
  {
    id: 'scatter-corr-r-from-cov',
    unitId: 'scatter-corr',
    skill: '共分散と標準偏差から相関係数を求める',
    grade: 3,
    difficulty: 1,
    replaces: ['scatter-corr-q02'],
    build(rng) {
      const c = pick(rng, R_CONTEXTS);
      const sx = int(rng, c.sx[0]!, c.sx[1]!);
      const sy = int(rng, c.sy[0]!, c.sy[1]!);
      const sign = rng() < 0.8 ? c.sign : -c.sign;
      const k = int(rng, 20, 95); // |r| = k/100
      // 共分散が小数第1位までで書けるものだけ使う
      if ((k * sx * sy) % 10 !== 0) throw new Reject();
      const r = (sign * k) / 100;
      const cov = (sign * k * sx * sy) / 100;
      const covS = tx(fixed(cov, cov % 1 === 0 ? 0 : 1));
      const covM = fixed(cov, cov % 1 === 0 ? 0 : 1);
      const label = (v: number) => tx(fixed(v, 2));
      const cand = (v: number, note: string): Candidate => ({ value: round(v, 2), label: label(v), note });
      const wrongs: Candidate[] = [
        cand(cov / sx, `共分散を $x$ の標準偏差${sx}だけで割った値。$y$ の標準偏差${sy}でも割る必要がある。`),
        cand(cov / sy, `共分散を $y$ の標準偏差${sy}だけで割った値。$x$ の標準偏差${sx}でも割る必要がある。`),
        ...(Math.abs(cov / (sx * sx * sy * sy)) < 0.005 ? [] : [cand(cov / (sx * sx * sy * sy), `標準偏差ではなく分散（$${sx}^2$ と $${sy}^2$）の積で割った値。相関係数は標準偏差の積で割る。`)]),
        cand((sx * sy) / cov, `分子と分母を逆にした値（標準偏差の積 ÷ 共分散）。`),
        cand(cov / (sx + sy), `標準偏差の和 $${sx}+${sy}$ で割った値。相関係数は標準偏差の積で割る。`),
      ];
      return {
        stem: `${c.lead}ところ、$x$ の標準偏差は${sx}${c.xu}、$y$ の標準偏差は${sy}${c.yu}、$x$ と $y$ の共分散は${covS}であった。$x$ と $y$ の相関係数として正しいものを一つ選べ。ただし、選択肢は割り切れないとき小数第3位を四捨五入した値である。`,
        ...choicesFrom(cand(r, `正しい。共分散を2つの標準偏差の積で割る。$${covM}\\div(${sx}\\times ${sy})=${fixed(r, 2)}$。`), wrongs, { rng }),
        explanation: `相関係数は${label(r)}である。相関係数は、共分散を2つの標準偏差の積で割って求める。\n$$r=\\dfrac{s_{xy}}{s_x s_y}=\\dfrac{${covM}}{${sx}\\times ${sy}}=\\dfrac{${covM}}{${sx * sy}}=${fixed(r, 2)}$$\n相関係数は必ず−1以上1以下になるので、範囲の外の値が出たら計算の誤りである。`,
      };
    },
  },
  {
    id: 'scatter-corr-cov-data',
    unitId: 'scatter-corr',
    skill: 'データから共分散を計算する',
    grade: 3,
    difficulty: 2,
    replaces: ['scatter-corr-q03'],
    build(rng) {
      const c = pick(rng, COV_CONTEXTS);
      const n = 5;
      // 平均が整数になるデータにする（偏差を暗算できるように）
      const xs = fiveWithIntMean(rng, c.x[0]!, c.x[1]!);
      const ys = fiveWithIntMean(rng, c.y[0]!, c.y[1]!);
      const mx = mean(xs);
      const my = mean(ys);
      const dx = xs.map((x) => x - mx);
      const dy = ys.map((y) => y - my);
      if (new Set(xs).size < 4 || new Set(ys).size < 4) throw new Reject();
      const prods = dx.map((d, i) => d * dy[i]!);
      const S = sum(prods);
      // 場面に合った向きの相関（多くは場面どおり、ときどき逆）で、ある程度はっきりしたもの
      const sx = Math.sqrt(mean(dx.map((d) => d * d)));
      const sy = Math.sqrt(mean(dy.map((d) => d * d)));
      const r = S / n / (sx * sy);
      if (Math.abs(r) < 0.4) throw new Reject();
      if (Math.sign(r) !== c.sign && rng() < 0.6) throw new Reject();
      const cov = S / n;
      const label = (v: number) => tx(fixed(v, 1));
      const exact1 = (v: number) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;
      const cand = (v: number, note: string): Candidate => ({ value: round(v, 1), label: label(v), note });
      const mxy = mean(xs.map((x, i) => x * ys[i]!));
      const wrongs: Candidate[] = [
        cand(S, `偏差の積の合計 ${tx(String(S))} を、データの個数${n}で割っていない値。`),
        ...(exact1(S / (n - 1)) ? [cand(S / (n - 1), `偏差の積の合計を${n - 1}（個数−1）で割った値。このサイトの共分散は個数 $n=${n}$ で割る。`)] : []),
        cand(-cov, `符号を逆にした値。偏差は「データ − 平均値」で、偏差の積の符号をそのまま足す。`),
        cand(mxy, `偏差をとらずに、$x$ と $y$ の値そのものの積を平均した値。共分散は偏差（平均値との差）の積を平均する。`),
        cand(r, `さらに2つの標準偏差の積で割った相関係数（およそ${tx(fixed(r, 2))}）。共分散は標準偏差で割らない。`),
        cand(mx * my, `$x$ の平均値と $y$ の平均値の積。共分散は偏差の積の平均である。`),
      ];
      const pTerms = dx.map((d, i) => `${d < 0 ? `(${d})` : d}\\times${dy[i]! < 0 ? `(${dy[i]})` : dy[i]}`).join('+');
      const keys = ['A', 'B', 'C', 'D', 'E'];
      return {
        stem: `次の表は、${c.lead}をまとめたものである。$x$ の平均値は${mx}${c.xu}、$y$ の平均値は${my}${c.yu}である。$x$ と $y$ の共分散として正しいものを一つ選べ。`,
        figure: {
          type: 'table',
          title: c.title,
          columns: [c.key, c.xh, c.yh],
          rows: xs.map((x, i) => [keys[i]!, x, ys[i]!]),
          headerColumn: true,
        },
        ...choicesFrom(cand(cov, `正しい。偏差の積の合計 ${tx(String(S))} をデータの個数${n}で割る。`), wrongs, { rng }),
        explanation: `共分散は${label(cov)}である。共分散は、偏差の積の平均（データの個数 $n$ で割る）である。\n$x$ の偏差は $${dx.join(',')}$、$y$ の偏差は $${dy.join(',')}$。\n偏差の積の和は $${pTerms}=${S}$。\n$$s_{xy}=\\dfrac{${S}}{${n}}=${fixed(cov, 1)}$$\n共分散が${cov > 0 ? '正なので、$x$ が大きいほど $y$ も大きい傾向（正の相関）' : cov < 0 ? '負なので、$x$ が大きいほど $y$ は小さい傾向（負の相関）' : '0なので、直線的な傾向は見られない'}がある。`,
      };
    },
  },
];
