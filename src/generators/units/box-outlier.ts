/** 外れ値の基準（Q1−1.5×IQR / Q3+1.5×IQR）と外れ値の判定の類題 */
import { choicesFrom, distinctInts, int, median, num, pick, quartiles, shuffledChoices } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

const RULE = '「第1四分位数−1.5×四分位範囲」より小さい値、または「第3四分位数+1.5×四分位範囲」より大きい値を外れ値とする。';

const FENCE_CONTEXTS = [
  { lead: 'ある検定試験の受験者の得点', unit: '点', lo: 30, hi: 50 },
  { lead: 'ある高校の生徒の通学時間', unit: '分', lo: 15, hi: 30 },
  { lead: 'ある飲食店の1日あたりの来客数（1年分）', unit: '人', lo: 60, hi: 110 },
  { lead: 'ある図書館の1日あたりの貸出冊数（1年分）', unit: '冊', lo: 80, hi: 140 },
  { lead: 'ある工場で作った袋菓子1袋の重さ', unit: 'g', lo: 70, hi: 90 },
];

const DATA_CONTEXTS = [
  { lead: (n: number) => `${n}人の生徒の1日の読書時間（分）を小さい順に並べると、次のとおりであった。`, unit: '分', lo: 10, hi: 40 },
  { lead: (n: number) => `ある喫茶店の${n}日間の来客数（人）を小さい順に並べると、次のとおりであった。`, unit: '人', lo: 30, hi: 60 },
  { lead: (n: number) => `${n}人の社員の通勤時間（分）を小さい順に並べると、次のとおりであった。`, unit: '分', lo: 20, hi: 50 },
  { lead: (n: number) => `ある農家が${n}日間に出荷したトマトの箱数を小さい順に並べると、次のとおりであった。`, unit: '箱', lo: 20, hi: 45 },
];

const BOX_CONTEXTS = [
  { title: '配達時間', lead: 'ある弁当店の50回分の配達時間', axis: '配達時間（分）', unit: '分', q1lo: 15, q1hi: 35 },
  { title: '待ち時間', lead: 'ある診療所の患者60人の待ち時間', axis: '待ち時間（分）', unit: '分', q1lo: 20, q1hi: 40 },
  { title: '小テストの得点', lead: 'ある学年80人の数学の小テストの得点', axis: '得点（点）', unit: '点', q1lo: 35, q1hi: 55 },
  { title: '1日の来客数', lead: 'ある書店の100日間の1日あたりの来客数', axis: '来客数（人）', unit: '人', q1lo: 60, q1hi: 100 },
];

export const generators: QuestionGenerator[] = [
  {
    id: 'box-outlier-upper-fence',
    unitId: 'box-outlier',
    skill: '外れ値の上側の基準値の計算',
    grade: 3,
    difficulty: 1,
    replaces: ['box-outlier-q02'],
    build(rng) {
      const c = pick(rng, FENCE_CONTEXTS);
      const q1 = int(rng, c.lo, c.hi);
      const iqr = int(rng, 3, 12) * 2;
      const q3 = q1 + iqr;
      if (q3 % 2 !== 0) throw new Reject();
      const med = q1 + int(rng, 1, iqr - 1);
      const h = 1.5 * iqr;
      const upper = q3 + h;
      const lower = q1 - h;
      if (lower < 0) throw new Reject();
      const u = c.unit;
      const label = (v: number) => `${num(v, 1)}${u}`;
      return {
        stem: `${c.lead}を調べたところ、第1四分位数が${q1}${u}、中央値が${med}${u}、第3四分位数が${q3}${u}であった。「第3四分位数+1.5×四分位範囲」より大きい値を外れ値とするとき、この基準の値として正しいものを一つ選べ。`,
        ...choicesFrom(
          { value: upper, label: label(upper), note: `正しい。四分位範囲${iqr}${u}の1.5倍である${h}${u}を、第3四分位数${q3}${u}に足す。` },
          [
            { value: lower, label: label(lower), note: `下側の基準「第1四分位数−1.5×四分位範囲」$=${q1}-${h}$を計算した値。` },
            { value: q3 + iqr, label: label(q3 + iqr), note: `1.5倍を掛け忘れ、第3四分位数に四分位範囲をそのまま足した$${q3}+${iqr}$の値。` },
            { value: 1.5 * q3, label: label(1.5 * q3), note: `四分位範囲を使わず、第3四分位数そのものを1.5倍した$${q3}\\times 1.5$の値。` },
            { value: q1 + h, label: label(q1 + h), note: `1.5×四分位範囲を第3四分位数ではなく第1四分位数に足した$${q1}+${h}$の値。` },
            { value: med + h, label: label(med + h), note: `1.5×四分位範囲を第3四分位数ではなく中央値に足した$${med}+${h}$の値。` },
          ],
          { rng },
        ),
        explanation: `基準の値は${label(upper)}である。\n四分位範囲は$${q3}-${q1}=${iqr}$（${u}）。\nその1.5倍は$1.5\\times ${iqr}=${h}$（${u}）。\n上側の基準は$${q3}+${h}=${upper}$（${u}）となり、${label(upper)}より大きい値が外れ値と判定される。`,
      };
    },
  },
  {
    id: 'box-outlier-judge-data',
    unitId: 'box-outlier',
    skill: 'データから四分位数を求めて外れ値を判定する',
    grade: 3,
    difficulty: 2,
    replaces: ['box-outlier-q05'],
    build(rng) {
      const c = pick(rng, DATA_CONTEXTS);
      const n = int(rng, 9, 12);
      const k = pick(rng, [0, 1, 1, 2]);
      const width = c.hi - c.lo;
      const core = distinctInts(rng, n - k, c.lo, c.hi);
      const extra: number[] = [];
      for (let i = 0; i < k; i++) {
        const up = rng() < 0.7;
        const v = up ? c.hi + int(rng, Math.round(width * 0.3), Math.round(width * 1.3)) : c.lo - int(rng, Math.round(width * 0.3), c.lo - 1);
        extra.push(v);
      }
      const xs = [...core, ...extra].sort((a, b) => a - b);
      if (new Set(xs).size !== n || xs[0]! < 1) throw new Reject();
      const { q1, q2, q3 } = quartiles(xs);
      const iqr = q3 - q1;
      const h = 1.5 * iqr;
      const lo = q1 - h;
      const hi = q3 + h;
      // 基準ちょうど・ごく近くの値は避ける（読み違いで正誤が入れ替わらないように）
      if (xs.some((x) => Math.abs(x - lo) < 1 || Math.abs(x - hi) < 1)) throw new Reject();
      const outside = (a: number, b: number) => xs.filter((x) => x < a || x > b);
      const correct = outside(lo, hi);
      if (correct.length > 2) throw new Reject();
      const u = c.unit;
      const f = (v: number) => num(v, 2);
      const say = (set: number[]) =>
        set.length === 0 ? '外れ値はない' : set.length === 1 ? `外れ値は${set[0]}${u}だけである` : `外れ値は${set.slice(0, -1).map((x) => `${x}${u}`).join('、')}と${set[set.length - 1]}${u}である`;
      const half = Math.floor(n / 2);
      const lower = xs.slice(0, half);
      const upperHalf = xs.slice(n - half);
      const set1 = outside(q1 - iqr, q3 + iqr);
      const setQ3 = xs.filter((x) => x > q3);
      const set3 = outside(q1 - 3 * iqr, q3 + 3 * iqr);
      const setMed = outside(q2 - h, q2 + h);
      const wrongs = [
        { label: say(set1), note: `四分位範囲を1.5倍せず、そのまま足し引きした基準（${f(q1 - iqr)}${u}と${f(q3 + iqr)}${u}）で判定している。` },
        { label: say([xs[0]!, xs[n - 1]!]), note: `基準を計算せず、最小値と最大値をそのまま外れ値としている。基準は${f(lo)}${u}と${f(hi)}${u}である。` },
        { label: say(setQ3), note: `第3四分位数${f(q3)}${u}より大きい値をすべて外れ値としている。四分位範囲の1.5倍を足していない。` },
        { label: say(setMed), note: `1.5×四分位範囲を、第1・第3四分位数ではなく中央値${f(q2)}${u}から足し引きした基準で判定している。` },
        { label: say(set3), note: `1.5倍ではなく3倍（基準${f(q1 - 3 * iqr)}${u}と${f(q3 + 3 * iqr)}${u}）を使い、基準を広く取りすぎている。` },
      ];
      const half2 = (ys: number[]) => (ys.length % 2 ? `真ん中の${f(median(ys))}${u}` : `$(${ys[ys.length / 2 - 1]}+${ys[ys.length / 2]})\\div 2=${f(median(ys))}$（${u}）`);
      const medLine = n % 2 ? `データは${n}個（奇数）なので中央値は${half + 1}番目の${f(q2)}${u}。中央値を除いた下半分は${lower.join('、')}、上半分は${upperHalf.join('、')}。` : `データは${n}個（偶数）なので、小さい方の${half}個${lower.join('、')}が下半分、大きい方の${half}個${upperHalf.join('、')}が上半分。`;
      const concl = correct.length === 0 ? `この範囲の外にある値はない。` : `この範囲の外にある値は${correct.map((x) => `${x}${u}`).join('、')}である。`;
      return {
        stem: `${c.lead(n)}\n${xs.join('、')}\n${RULE}外れ値についての記述として正しいものを一つ選べ。`,
        ...shuffledChoices(rng, { label: say(correct), note: `正しい。基準は${f(lo)}${u}と${f(hi)}${u}で、${correct.length === 0 ? 'この外にある値はない' : `この外にあるのは${correct.map((x) => `${x}${u}`).join('、')}`}。` }, wrongs),
        explanation: `${say(correct)}。\n${medLine}\n第1四分位数は下半分の中央値で${half2(lower)}、第3四分位数は上半分の中央値で${half2(upperHalf)}。\n四分位範囲は$${f(q3)}-${f(q1)}=${f(iqr)}$、その1.5倍は$${f(h)}$。\n下側の基準は$${f(q1)}-${f(h)}=${f(lo)}$、上側の基準は$${f(q3)}+${f(h)}=${f(hi)}$。\n${concl}`,
      };
    },
  },
  {
    id: 'box-outlier-judge-box',
    unitId: 'box-outlier',
    skill: '箱ひげ図から最小値・最大値が外れ値かを判定する',
    grade: 3,
    difficulty: 2,
    replaces: ['box-outlier-q07'],
    build(rng) {
      const c = pick(rng, BOX_CONTEXTS);
      const scenario = int(rng, 0, 3); // 0: どちらも外れ値でない 1: 最小値だけ 2: 最大値だけ 3: 両方
      const minOut = scenario === 1 || scenario === 3;
      const maxOut = scenario === 2 || scenario === 3;
      const q1 = int(rng, c.q1lo / 5, c.q1hi / 5) * 5;
      const iqr = pick(rng, [10, 20]);
      const q3 = q1 + iqr;
      const med = q1 + int(rng, 1, iqr / 5 - 1) * 5;
      const h = 1.5 * iqr;
      const lo = q1 - h;
      const hi = q3 + h;
      // 外れ値でない端は基準より5以上内側、外れ値の端は基準より5〜10外側（すべて5の倍数）
      const min = minOut ? lo - int(rng, 1, 2) * 5 : q1 - int(rng, 1, (q1 - lo) / 5 - 1) * 5;
      const max = maxOut ? hi + int(rng, 1, 2) * 5 : q3 + int(rng, 1, (hi - q3) / 5 - 1) * 5;
      if (min < 0) throw new Reject();
      const axisMin = Math.floor(min / 20) * 20;
      const axisMax = axisMin + 100;
      if (max > axisMax) throw new Reject();
      const u = c.unit;
      const minText = `最小値${min}${u}は下側の基準${lo}${u}より${minOut ? '小さいので外れ値である' : '小さくないので外れ値ではない'}`;
      const maxText = `最大値${max}${u}は上側の基準${hi}${u}より${maxOut ? '大きいので外れ値である' : '大きくないので外れ値ではない'}`;
      const options = [
        { label: '最小値も最大値も外れ値ではない', min: false, max: false },
        { label: '最小値だけが外れ値である', min: true, max: false },
        { label: '最大値だけが外れ値である', min: false, max: true },
        { label: '最小値も最大値も外れ値である', min: true, max: true },
      ];
      const choiceNotes = options.map((o, i) => {
        if (i === scenario) return `正しい。基準は${lo}${u}と${hi}${u}で、${scenario === 0 ? 'どちらもその内側にある' : scenario === 3 ? '最小値も最大値もその外にある' : `${minOut ? '最小値' : '最大値'}だけがその外にある`}。`;
        const errs: string[] = [];
        if (o.min !== minOut) errs.push(minText);
        if (o.max !== maxOut) errs.push(maxText);
        const why = o.min && o.max ? '基準を計算せず、ひげの両端をそのまま外れ値としている。' : !o.min && !o.max ? 'ひげの中にある値は外れ値ではないと考えている。この図のひげは最小値・最大値まで引いてあるので、基準を計算して確かめる必要がある。' : 'ひげの長さの見た目で判断している。';
        return `${why}${errs.join('。')}。`;
      });
      return {
        stem: `次の箱ひげ図は、${c.lead}を表している（ひげは最小値と最大値まで引いてある）。${RULE.replace('外れ値とする。', '外れ値とするとき、')}最小値と最大値についての記述として正しいものを一つ選べ。`,
        figure: {
          type: 'boxplot',
          title: c.title,
          axisLabel: c.axis,
          axisMin,
          axisMax,
          boxes: [{ label: c.title, min, q1, median: med, q3, max }],
        },
        choices: options.map((o) => o.label),
        answer: scenario,
        choiceNotes,
        explanation: `${options[scenario]!.label}。\n図から第1四分位数は${q1}${u}、第3四分位数は${q3}${u}なので、四分位範囲は$${q3}-${q1}=${iqr}$（${u}）、その1.5倍は$1.5\\times ${iqr}=${h}$（${u}）。\n下側の基準は$${q1}-${h}=${lo}$（${u}）、上側の基準は$${q3}+${h}=${hi}$（${u}）。\n${minText}。${maxText}。`,
      };
    },
  },
];
