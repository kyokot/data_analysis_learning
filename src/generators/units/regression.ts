/** 回帰直線（傾き・予測値・残差）の類題 */
import { choicesFrom, fixed, int, num, pick, round, type Candidate } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

/** 文中に書く数（負の数は「−」） */
const tx = (s: string) => s.replace(/^-/, '−');
/** 数式の中で、足し算の項として書く（負なら括弧） */
const par = (v: string) => (v.startsWith('-') ? `(${v})` : v);
/** 負の数も絶対値で四捨五入する（kit の round は −0.125 → −0.12 のように負の .5 を 0 の側へ丸めるため） */
const rnd = (v: number, d: number) => Math.sign(v) * round(Math.abs(v), d);
/** 0 に十分近い（小数の誤差を無視する） */
const isInt = (v: number, digits: number) => Math.abs(v * 10 ** digits - Math.round(v * 10 ** digits)) < 1e-9;

/** sign: 場面で自然な相関の向き */
const STAT_CONTEXTS = [
  { lead: 'ある中学校の生徒について、1日の読書時間 $x$（分）と国語のテストの得点 $y$（点）を調べた', xn: '読書時間', yn: '国語の得点', xu: '分', yu: '点', mx: [20, 60], my: [50, 70], sx: [5, 20], sy: [6, 16], sign: 1 },
  { lead: 'ある果樹園の木について、1本あたりの肥料の量 $x$（kg）とりんごの収穫量 $y$（kg）を調べた', xn: '肥料の量', yn: '収穫量', xu: 'kg', yu: 'kg', mx: [4, 12], my: [40, 90], sx: [1, 4], sy: [5, 20], sign: 1 },
  { lead: 'ある地域の中古マンションについて、築年数 $x$（年）と販売価格 $y$（百万円）を調べた', xn: '築年数', yn: '販売価格', xu: '年', yu: '百万円', mx: [10, 30], my: [20, 50], sx: [4, 12], sy: [4, 12], sign: -1 },
  { lead: 'あるクラスの生徒について、数学の得点 $x$（点）と理科の得点 $y$（点）を調べた', xn: '数学の得点', yn: '理科の得点', xu: '点', yu: '点', mx: [50, 70], my: [45, 70], sx: [8, 20], sy: [6, 18], sign: 1 },
  { lead: 'ある市の家庭について、1日の在宅時間 $x$（時間）と1か月の電気使用量 $y$（kWh）を調べた', xn: '在宅時間', yn: '電気使用量', xu: '時間', yu: 'kWh', mx: [8, 16], my: [200, 400], sx: [2, 5], sy: [20, 60], sign: 1 },
];

const RES_CONTEXTS = [
  { lead: 'あるチェーン店の多数の店舗について、1か月のチラシ配布枚数 $x$（千枚）と来店者数 $y$（百人）', title: '4店舗の配布枚数と来店者数', key: '店舗', keys: ['A', 'B', 'C', 'D'], xh: '配布枚数 $x$（千枚）', yh: '来店者数 $y$（百人）', yu: '百人', x: [5, 20], a: [20, 60], b: [2, 8], sign: 1 },
  { lead: 'ある公園の売店の夏の多数の日について、最高気温 $x$（℃）とかき氷の販売数 $y$（個）', title: '4日間の最高気温と販売数', key: '日', keys: ['1日目', '2日目', '3日目', '4日目'], xh: '最高気温 $x$（℃）', yh: '販売数 $y$（個）', yu: '個', x: [24, 36], a: [-120, -40], b: [6, 10], sign: 1 },
  { lead: 'ある地域の多数の中古車について、走行距離 $x$（万km）と販売価格 $y$（万円）', title: '4台の走行距離と販売価格', key: '車', keys: ['A', 'B', 'C', 'D'], xh: '走行距離 $x$（万km）', yh: '販売価格 $y$（万円）', yu: '万円', x: [2, 12], a: [150, 250], b: [8, 15], sign: -1 },
  { lead: 'ある高校の多数の生徒について、1週間の学習時間 $x$（時間）と模擬試験の得点 $y$（点）', title: '4人の学習時間と得点', key: '生徒', keys: ['P', 'Q', 'R', 'S'], xh: '学習時間 $x$（時間）', yh: '得点 $y$（点）', yu: '点', x: [5, 20], a: [30, 50], b: [2, 3], sign: 1 },
];

/** 回帰直線 y=a+bx の TeX */
function lineTex(a: number, b: number, d = 2): string {
  const bs = num(Math.abs(b), d);
  return `y=${num(a, d)}${b < 0 ? '-' : '+'}${bs === '1' ? '' : bs}x`;
}

export const generators: QuestionGenerator[] = [
  {
    id: 'regression-slope',
    unitId: 'regression',
    skill: '相関係数と標準偏差から傾きを求める',
    grade: 3,
    difficulty: 2,
    replaces: ['regression-q04'],
    build(rng) {
      const c = pick(rng, STAT_CONTEXTS);
      const sx = int(rng, c.sx[0]!, c.sx[1]!);
      const sy = int(rng, c.sy[0]!, c.sy[1]!);
      if (sx === sy || sx < 2) throw new Reject();
      const r = c.sign * int(rng, 6, 18) * 0.05;
      const b = (r * sy) / sx;
      // 傾きが小数第2位までで割り切れるものだけ使う
      if (!isInt(b, 2)) throw new Reject();
      const label = (v: number) => tx(fixed(rnd(v, 2), 2));
      const cand = (v: number, note: string): Candidate => ({ value: rnd(v, 2), label: label(v), note });
      const rS = fixed(r, 2);
      const wrongs: Candidate[] = [
        cand((r * sx) / sy, `$\\dfrac{s_x}{s_y}$ を掛けた値（$${rS}\\times\\dfrac{${sx}}{${sy}}$）。傾きは $y$ の標準偏差を $x$ の標準偏差で割ったものを掛ける。`),
        cand(sy / sx, `相関係数を掛け忘れた値（$\\dfrac{${sy}}{${sx}}$）。`),
        cand(r, `相関係数そのもの。傾きは相関係数に $\\dfrac{s_y}{s_x}$ を掛けたものである。`),
        cand(r * sy, `相関係数に $y$ の標準偏差を掛けただけで、$x$ の標準偏差${sx}で割っていない値。`),
        ...(Math.abs(r / (sx * sy)) < 0.005 ? [] : [cand(r / (sx * sy), `相関係数を2つの標準偏差の積で割った値。これは傾きではない。`)]),
      ];
      return {
        stem: `${c.lead}ところ、$x$ の標準偏差は${sx}${c.xu}、$y$ の標準偏差は${sy}${c.yu}、$x$ と $y$ の相関係数は${tx(rS)}であった。$x$ から $y$ を予測する回帰直線 $y=a+bx$ の傾き $b$ として正しいものを一つ選べ。ただし、選択肢は割り切れないとき小数第3位を四捨五入した値である。`,
        ...choicesFrom(cand(b, `正しい。$b=r\\times\\dfrac{s_y}{s_x}=${rS}\\times\\dfrac{${sy}}{${sx}}=${fixed(b, 2)}$。`), wrongs, { rng }),
        explanation: `傾きは${label(b)}である。傾きは、相関係数に「$y$ の標準偏差 ÷ $x$ の標準偏差」を掛けて求める。\n$$b=r\\times\\dfrac{s_y}{s_x}=${rS}\\times\\dfrac{${sy}}{${sx}}=${fixed(b, 2)}$$\n傾きの符号は相関係数の符号と同じになる。`,
      };
    },
  },
  {
    id: 'regression-predict',
    unitId: 'regression',
    skill: '平均・標準偏差・相関係数から予測値を求める',
    grade: 3,
    difficulty: 2,
    replaces: ['regression-q08'],
    build(rng) {
      const c = pick(rng, STAT_CONTEXTS);
      const mx = int(rng, c.mx[0]!, c.mx[1]!);
      const my = int(rng, c.my[0]!, c.my[1]!);
      const sx = int(rng, c.sx[0]!, c.sx[1]!);
      const sy = int(rng, c.sy[0]!, c.sy[1]!);
      if (sx === sy) throw new Reject();
      const r = c.sign * int(rng, 8, 18) * 0.05;
      const b = (r * sy) / sx;
      if (!isInt(b, 2)) throw new Reject();
      const d = pick(rng, [-2, -1, 1, 2]) * sx; // x0 は平均から標準偏差の1〜2倍離れた値
      const x0 = mx + d;
      if (x0 <= 0) throw new Reject();
      const a = my - b * mx;
      const yhat = a + b * x0;
      if (!isInt(yhat, 1) || !isInt(a, 2)) throw new Reject();
      const label = (v: number) => tx(fixed(rnd(v, 1), 1));
      const cand = (v: number, note: string): Candidate => ({ value: rnd(v, 1), label: label(v), note });
      const rS = fixed(r, 2);
      const bS = num(b, 2);
      const bWrong = (r * sx) / sy;
      const wrongs: Candidate[] = [
        cand(my + bWrong * d, `傾きを $r\\times\\dfrac{s_x}{s_y}=${num(bWrong, 3)}$ と、標準偏差の比を逆にして計算した値。`),
        cand(my + (sy / sx) * d, `傾きに相関係数を掛け忘れた値（傾きを $\\dfrac{${sy}}{${sx}}$ とした）。`),
        cand(mx + b * d, `$y$ の平均値${my}ではなく $x$ の平均値${mx}を基準にして、$${mx}+${par(bS)}\\times ${par(String(d))}$ とした値。回帰直線が通るのは点 $(\\bar{x},\\bar{y})$ である。`),
        cand(my + b * x0, `切片を $y$ の平均値${my}のままにして、$${my}+${par(bS)}\\times ${x0}$ とした値。回帰直線が通るのは点 $(\\bar{x},\\bar{y})$ である。`),
        cand(my - b * d, `平均値からのずれの向きを逆にした値（$${my}-${par(bS)}\\times ${par(String(d))}$）。`),
      ];
      return {
        stem: `${c.lead}ところ、次のことがわかった。\n$x$ の平均値は${mx}${c.xu}、標準偏差は${sx}${c.xu}\n$y$ の平均値は${my}${c.yu}、標準偏差は${sy}${c.yu}\n$x$ と $y$ の相関係数は${tx(rS)}\n$x$ から $y$ を予測する回帰直線を使うと、${c.xn}が${x0}${c.xu}のときの${c.yn}の予測値（${c.yu}）はいくらか。正しいものを一つ選べ。ただし、選択肢は割り切れないとき小数第2位を四捨五入した値である。`,
        ...choicesFrom(cand(yhat, `正しい。傾き ${tx(bS)}、切片 ${tx(num(a, 2))} の回帰直線に $x=${x0}$ を代入する。`), wrongs, { rng }),
        explanation: `予測値は${label(yhat)}${c.yu}である。\n傾きは $b=r\\times\\dfrac{s_y}{s_x}=${rS}\\times\\dfrac{${sy}}{${sx}}=${bS}$。\n回帰直線は点 $(\\bar{x},\\bar{y})=(${mx},${my})$ を通るので、切片は $a=\\bar{y}-b\\bar{x}=${my}-${par(bS)}\\times ${mx}=${num(a, 2)}$。\n回帰直線は $${lineTex(a, b)}$ となり、$x=${x0}$ のとき $y=${num(a, 2)}+${par(bS)}\\times ${x0}=${num(yhat, 1)}$。\n（$x$ が平均より${Math.abs(d)}${c.xu}${d > 0 ? '大きい' : '小さい'}ので、$${my}+${par(bS)}\\times ${par(String(d))}=${num(yhat, 1)}$ と考えてもよい。）`,
      };
    },
  },
  {
    id: 'regression-residual',
    unitId: 'regression',
    skill: '残差の計算（表の読み取り）',
    grade: 3,
    difficulty: 2,
    replaces: ['regression-q03'],
    build(rng) {
      const c = pick(rng, RES_CONTEXTS);
      const a = int(rng, c.a[0]!, c.a[1]!);
      const b = c.sign * int(rng, c.b[0]!, c.b[1]!);
      const xs = [...new Set(Array.from({ length: 4 }, () => int(rng, c.x[0]!, c.x[1]!)))].sort((p, q) => p - q);
      if (xs.length < 4) throw new Reject();
      const es = xs.map(() => pick(rng, [-1, 1]) * int(rng, 1, 12));
      const ys = xs.map((x, i) => a + b * x + es[i]!);
      if (ys.some((y) => y <= 0)) throw new Reject();
      const k = int(rng, 0, 3);
      const x = xs[k]!;
      const y = ys[k]!;
      const yhat = a + b * x;
      const e = y - yhat;
      const label = (v: number) => tx(String(v));
      const cand = (v: number, note: string): Candidate => ({ value: v, label: label(v), note });
      const wrongs: Candidate[] = [
        cand(-e, `予測値から実際の値を引いた値（$${yhat}-${y}$）。残差は「実際の値 − 予測値」である。`),
        cand(yhat, `予測値そのもの。残差は、実際の値から予測値を引いたものである。`),
        cand(y - b * x, `実際の値から $${par(String(b))}\\times ${x}$ だけを引き、切片${tx(String(a))}を引いていない値。`),
        cand(y - (a + b) * x, `回帰直線を $y=(${a}${b < 0 ? '' : '+'}${b})x$ と読み違え、予測値を $${par(String(a + b))}\\times ${x}$ とした値。`),
        cand(-es[(k + 1) % 4]!, `表の別の行（${c.keys[(k + 1) % 4]}）について、予測値から実際の値を引いた値。読む行と引く向きを取り違えている。`),
      ];
      return {
        stem: `${c.lead}の関係を調べ、$x$ から $y$ を予測する回帰直線 $${lineTex(a, b)}$ を得た。次の表は、そのうち4つのデータである。${c.keys[k]}の残差として正しいものを一つ選べ。`,
        figure: {
          type: 'table',
          title: c.title,
          columns: [c.key, c.xh, c.yh],
          rows: xs.map((xv, i) => [c.keys[i]!, xv, ys[i]!]),
          headerColumn: true,
        },
        ...choicesFrom(cand(e, `正しい。実際の値${y}から予測値${yhat}を引く。`), wrongs, { rng }),
        explanation: `${c.keys[k]}の残差は${label(e)}である。残差は「実際の値 − 予測値」。\n${c.keys[k]}は $x=${x}$ なので、予測値は $${a}${b < 0 ? '-' : '+'}${Math.abs(b)}\\times ${x}=${yhat}$。\n残差は $${y}-${par(String(yhat))}=${e}$。実際の値は予測より${Math.abs(e)}${c.yu}${e > 0 ? '多かった' : '少なかった'}。`,
      };
    },
  },
];
