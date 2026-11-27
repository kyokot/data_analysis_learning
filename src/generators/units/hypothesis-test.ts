/** 仮説検定（母平均の z 検定・母比率の検定）の類題 */
import { choicesFrom, fixed, num, pick } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

const MEAN_CONTEXTS = [
  { setup: 'あるコーヒーの自動販売機は、1杯の量', unit: 'mL', count: '杯', sample: 'この販売機から', what: '量を測った', mu0: [140, 160], sdMax: 8 },
  { setup: 'ある製麺所の機械は、麺1玉の重さ', unit: 'g', count: '玉', sample: 'この機械で作った麺から', what: '重さを量った', mu0: [110, 130], sdMax: 6 },
  { setup: 'ある工場のネジは、長さ', unit: 'mm', count: '本', sample: 'この工場のネジから', what: '長さを測った', mu0: [30, 50], sdMax: 3 },
  { setup: 'ある菓子工場の袋詰め機は、1袋の内容量', unit: 'g', count: '袋', sample: 'この機械で詰めた袋から', what: '内容量を量った', mu0: [80, 100], sdMax: 6 },
  { setup: 'ある飲料工場の充填機は、1本の量', unit: 'mL', count: '本', sample: 'この充填機で詰めた飲料から', what: '量を測った', mu0: [495, 505], sdMax: 10 },
];

const PROP_CONTEXTS = [
  { claim: 'ある町では、町営バスを月に1回以上利用する住民の割合', pop: '住民', who: '人', title: '町営バスの利用状況', col: '月1回以上の利用', yes: '利用する', no: '利用しない' },
  { claim: 'ある県では、朝食を毎日食べる高校生の割合', pop: '県内の高校生', who: '人', title: '朝食を毎日食べるか', col: '朝食', yes: '毎日食べる', no: '毎日は食べない' },
  { claim: 'ある菓子では、当たり券が入っている割合', pop: 'この菓子', who: '個', title: '当たり券の有無', col: '当たり券', yes: '入っている', no: '入っていない' },
  { claim: 'ある市では、自家用車を持つ世帯の割合', pop: '市内の世帯', who: '世帯', title: '自家用車の有無', col: '自家用車', yes: '持っている', no: '持っていない' },
  { claim: 'ある市では、ごみの分別ルールを知っている住民の割合', pop: '市内の住民', who: '人', title: '分別ルールの認知', col: '分別ルール', yes: '知っている', no: '知らない' },
];

const CLEAN_P = [0.1, 0.2, 0.36, 0.5, 0.64, 0.8, 0.9];
/** 1.96 から十分離れた z の値（与えた基準だけで判定でき、丸めで結論が変わらない） */
const Z_VALUES = [1.2, 1.5, 1.7, 1.8, 2.2, 2.4, 2.5, 3];

const r8 = (x: number) => Math.round(x * 1e8) / 1e8;
const reject = (z: number) => Math.abs(z) > 1.96;

export const generators: QuestionGenerator[] = [
  {
    id: 'hypothesis-test-mean-z',
    unitId: 'hypothesis-test',
    skill: '母平均のz検定（検定統計量と結論）',
    grade: 3,
    difficulty: 2,
    replaces: ['hypothesis-test-q02'],
    build(rng) {
      const c = pick(rng, MEAN_CONTEXTS);
      const root = pick(rng, [4, 5, 6, 8, 10]);
      const n = root * root;
      const se = pick(rng, [0.5, 1, 1.5, 2, 2.5]);
      const sigma = se * root;
      if (!Number.isInteger(sigma) || sigma > c.sdMax) throw new Reject();
      const mu0 = c.mu0[0]! + Math.floor(rng() * (c.mu0[1]! - c.mu0[0]! + 1));
      const z = pick(rng, Z_VALUES) * (rng() < 0.5 ? -1 : 1);
      const diff = r8(z * se);
      const xbar = r8(mu0 + diff);
      const rej = reject(z);
      const zl = (v: number) => fixed(v, 2);
      const label = (v: number, r: boolean) => `$z=${zl(v)}$ で、帰無仮説は${r ? '棄却される' : '棄却されない'}`;
      const cand = (v: number, r: boolean, note: string, bump = 0) => ({ value: v + (r ? 0.0001 : 0) + bump, label: label(v, r), note });
      const zNoSqrt = diff / sigma;
      const zOverN = diff / (sigma / n);
      const zVar = diff / ((sigma * sigma) / n);
      const absz = Math.abs(z);
      const oppositeNote = rej
        ? `$z$ の値は正しいが、結論が逆。$|z|=${zl(absz)}$ は1.96より大きいので棄却域に入る。`
        : absz > 1.64
          ? `$z$ の値は正しいが、片側検定の境界1.64と比べて棄却としている。両側5%では $|z|=${zl(absz)}$ を1.96と比べるので棄却されない。`
          : `$z$ の値は正しいが、結論が逆。$|z|=${zl(absz)}$ は1.96より小さいので棄却域に入らない。`;
      const wrongs = [
        cand(z, !rej, oppositeNote),
        cand(zNoSqrt, reject(zNoSqrt), `差 $${num(diff)}$ を母標準偏差${sigma}でそのまま割った値。割るのは標本平均の標準偏差 $${sigma}/\\sqrt{${n}}=${num(se)}$ である。`),
        cand(zOverN, reject(zOverN), `$\\sqrt{n}$ ではなく $n=${n}$ で割って $${sigma}/${n}$ を分母にした値。分母は $${sigma}/\\sqrt{${n}}$ である。`),
        cand(zVar, reject(zVar), `標準偏差ではなく分散 $${sigma}^2/${n}=${num((sigma * sigma) / n)}$ で割った値。分母は標本平均の標準偏差 $${sigma}/\\sqrt{${n}}$ である。`),
      ];
      if (!rej) {
        wrongs.push({
          value: z + 0.0002,
          label: `$z=${zl(z)}$ で、帰無仮説が正しいと証明される`,
          note: '「棄却されない」は「帰無仮説が誤りとはいえない」という意味で、帰無仮説が正しいと証明されたわけではない。',
        });
      }
      return {
        stem: `${c.setup}が平均${mu0}${c.unit}、標準偏差${sigma}${c.unit}になるように作られている。${c.sample}${n}${c.count}を無作為に取り出して${c.what}ところ、標本平均は${num(xbar)}${c.unit}であった。帰無仮説を「母平均は${mu0}${c.unit}である」、対立仮説を「母平均は${mu0}${c.unit}ではない」とし、母標準偏差を${sigma}${c.unit}として有意水準5%で両側検定を行う。検定統計量 $z$ の値と結論の組合せとして正しいものを一つ選べ。ただし、標準正規分布に従う $Z$ について $P(Z\\geqq 1.96)=0.025$ としてよく、$|z|>1.96$ のとき帰無仮説を棄却する。$z$ の値は小数第3位を四捨五入している。`,
        ...choicesFrom(cand(z, rej, `正しい。$z=(${num(xbar)}-${mu0})\\div(${sigma}/\\sqrt{${n}})=${zl(z)}$ で、$|z|$ は1.96${rej ? 'を超える' : 'を超えない'}。`), wrongs, { rng }),
        explanation: `$z=${zl(z)}$ で、帰無仮説は${rej ? '棄却される' : '棄却されない'}。\n検定統計量は $z=\\dfrac{\\bar{x}-\\mu_0}{\\sigma/\\sqrt{n}}$。\n標本平均の標準偏差は $\\dfrac{${sigma}}{\\sqrt{${n}}}=\\dfrac{${sigma}}{${root}}=${num(se)}$（${c.unit}）。\n$z=\\dfrac{${num(xbar)}-${mu0}}{${num(se)}}=\\dfrac{${num(diff)}}{${num(se)}}=${num(z)}$。\n${
          rej
            ? `$|z|=${num(absz)}>1.96$ なので棄却域に入り、帰無仮説を棄却する。つまり「母平均は${mu0}${c.unit}ではない」と判断する。`
            : `$|z|=${num(absz)}\\leqq 1.96$ なので棄却域に入らず、帰無仮説は棄却されない。「母平均が${mu0}${c.unit}と異なるとはいえない」と判断する（${mu0}${c.unit}であると証明されたわけではない）。`
        }`,
      };
    },
  },
  {
    id: 'hypothesis-test-prop-z',
    unitId: 'hypothesis-test',
    skill: '母比率の検定の検定統計量',
    grade: 3,
    difficulty: 2,
    replaces: ['hypothesis-test-q05'],
    build(rng) {
      const c = pick(rng, PROP_CONTEXTS);
      const p0 = pick(rng, CLEAN_P);
      const root = pick(rng, [10, 20, 25, 30, 40, 50]);
      const n = root * root;
      const q0 = r8(1 - p0);
      const pq = r8(p0 * q0);
      const s = r8(Math.sqrt(pq));
      const se = r8(s / root);
      if (Math.abs(se * 1e5 - Math.round(se * 1e5)) > 1e-6) throw new Reject();
      const z = pick(rng, Z_VALUES) * (rng() < 0.5 ? -1 : 1);
      const ph = r8(p0 + z * se);
      const x = r8(n * ph);
      if (!Number.isInteger(x) || x <= 0 || x >= n) throw new Reject();
      const diff = r8(ph - p0);
      const zPhat = diff / Math.sqrt((ph * (1 - ph)) / n);
      // 標本比率を使った値が四捨五入の境目に近いと表示がぶれるので避ける
      const s100 = Math.abs(zPhat) * 100;
      if (Math.abs(s100 - Math.floor(s100) - 0.5) < 0.02) throw new Reject();
      const zl = (v: number) => fixed(v, 2);
      const pct = num(p0 * 100);
      return {
        stem: `${c.claim}は${pct}%とされてきた。現在の割合 $p$ を調べるため、${c.pop}から${n}${c.who}を無作為に選んで調べたところ、次の表の結果を得た。帰無仮説を $p=${p0}$ として母比率の検定を行うとき、検定統計量 $z$ の値として正しいものを一つ選べ。ただし、値は小数第3位を四捨五入している。`,
        figure: {
          type: 'table',
          title: `${c.title}（${n}${c.who}）`,
          columns: [c.col, `${c.who === '人' ? '人数（人）' : c.who === '世帯' ? '世帯数（世帯）' : '個数（個）'}`],
          rows: [
            [c.yes, x],
            [c.no, n - x],
            ['合計', n],
          ],
          headerColumn: true,
        },
        ...choicesFrom(
          { value: z, label: zl(z), note: `正しい。$(${ph}-${p0})\\div\\sqrt{${p0}\\times ${q0}\\div ${n}}=${num(diff, 6)}\\div ${num(se, 6)}=${zl(z)}$。` },
          [
            { value: zPhat, label: zl(zPhat), note: `分母を標本比率で $\\sqrt{${ph}\\times ${num(1 - ph, 6)}\\div ${n}}$ として計算した値。検定では帰無仮説の値${p0}を使う。` },
            { value: diff / s, label: zl(diff / s), note: `$\\sqrt{n}$ で割るのを忘れ、$\\sqrt{${p0}\\times ${q0}}=${num(s, 4)}$ を分母にした値。` },
            { value: diff / (s / n), label: zl(diff / (s / n)), note: `$\\sqrt{${pq}}$ を $\\sqrt{${n}}$ ではなく${n}で割った $${num(s / n, 8)}$ を分母にした値。` },
            { value: diff / (pq / n), label: zl(diff / (pq / n)), note: `平方根をとり忘れ、分散 $${p0}\\times ${q0}\\div ${n}=${num(pq / n, 8)}$ でそのまま割った値。` },
          ],
          { rng },
        ),
        explanation: `$z=${zl(z)}$ である。\n検定統計量は $z=\\dfrac{\\hat{p}-p_0}{\\sqrt{p_0(1-p_0)/n}}$。\n標本比率は $\\hat{p}=\\dfrac{${x}}{${n}}=${ph}$。\n帰無仮説 $p=${p0}$ が正しいとしたときの標本比率の標準偏差は $\\sqrt{\\dfrac{${p0}\\times ${q0}}{${n}}}=\\dfrac{${num(s, 4)}}{${root}}=${num(se, 6)}$。\nしたがって $z=\\dfrac{${ph}-${p0}}{${num(se, 6)}}=\\dfrac{${num(diff, 6)}}{${num(se, 6)}}=${num(z)}$。分母には、標本比率${ph}ではなく帰無仮説の値${p0}を使う。`,
      };
    },
  },
];
