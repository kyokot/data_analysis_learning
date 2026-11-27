/** 条件付き確率（クロス集計表から）と独立な事象の積事象の類題 */
import { choicesFrom, fixed, frac, int, pick, round, type Candidate } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

interface TableCtx {
  lead: (N: number) => string;
  title: string;
  rowHead: string;
  who: string;
  rows: [string, string];
  cols: [string, string];
  /** 行のカテゴリを「〜であった」の形で */
  rowIs: (r: string) => string;
  /** 列のカテゴリを「〜である」の形で */
  colIs: (c: string) => string;
}

const TABLE_CONTEXTS: TableCtx[] = [
  {
    lead: (N) => `ある図書館の利用者${N}人に、電子書籍サービスを利用するかどうかをたずねたところ、次の表のようになった。この${N}人から無作為に1人を選ぶ。`,
    title: '利用者の区分と電子書籍の利用（人）',
    rowHead: '区分',
    who: '人',
    rows: ['学生', '社会人'],
    cols: ['利用する', '利用しない'],
    rowIs: (r) => `${r}であった`,
    colIs: (c) => `電子書籍を${c}`,
  },
  {
    lead: (N) => `ある遊園地で来園者${N}人に、来園が初めてかどうかと、年間パスポートを買いたいかどうかをたずねたところ、次の表のようになった。この${N}人から無作為に1人を選ぶ。`,
    title: '来園の回数と年間パスポートの希望（人）',
    rowHead: '来園',
    who: '人',
    rows: ['初めて', '2回目以上'],
    cols: ['買いたい', '買いたくない'],
    rowIs: (r) => (r === '初めて' ? '来園が初めてであった' : '来園が2回目以上であった'),
    colIs: (c) => `年間パスポートを${c}と答えた人である`,
  },
  {
    lead: (N) => `ある工場で、ある日に作った製品${N}個について、製造したラインと検査の結果を調べたところ、次の表のようになった。この${N}個から無作為に1個を選ぶ。`,
    title: '製造ラインと検査の結果（個）',
    rowHead: 'ライン',
    who: '製品',
    rows: ['ラインX', 'ラインY'],
    cols: ['合格', '不合格'],
    rowIs: (r) => `${r}で作られたものであった`,
    colIs: (c) => `検査で${c}になったものである`,
  },
  {
    lead: (N) => `ある高校の生徒${N}人に、通学方法と部活動への参加をたずねたところ、次の表のようになった。この${N}人から無作為に1人を選ぶ。`,
    title: '通学方法と部活動への参加（人）',
    rowHead: '通学方法',
    who: '生徒',
    rows: ['自転車', '電車・バス'],
    cols: ['参加している', '参加していない'],
    rowIs: (r) => `${r}で通学する生徒であった`,
    colIs: (c) => `部活動に${c}生徒である`,
  },
  {
    lead: (N) => `あるカフェで、ある週の客${N}人について、来店した時間帯と注文の形を調べたところ、次の表のようになった。この${N}人から無作為に1人を選ぶ。`,
    title: '時間帯と注文の形（人）',
    rowHead: '時間帯',
    who: '客',
    rows: ['午前', '午後'],
    cols: ['店内で飲食', '持ち帰り'],
    rowIs: (r) => `${r}に来店した客であった`,
    colIs: (c) => `${c}の客である`,
  },
];

const INDEP_CONTEXTS = [
  { lead: 'ある町で、明日の朝にバスが遅れる確率は{a}、電車が遅れる確率は{b}であり、バスの遅れと電車の遅れは互いに独立であるとする。', range: [1, 4], both: 'バスと電車がどちらも遅れる', none: 'バスも電車もどちらも遅れない', A: 'バスが遅れる', B: '電車が遅れる' },
  { lead: 'Aさんがフリースローを1本成功させる確率は{a}、Bさんが成功させる確率は{b}である。2人がそれぞれ1本ずつ投げ、2人の結果は互いに独立であるとする。', range: [5, 9], both: '2人とも成功する', none: '2人とも失敗する', A: 'Aさんが成功する', B: 'Bさんが成功する' },
  { lead: 'ある工場の2台の機械P、Qが、1日のうちに故障する確率はそれぞれ{a}、{b}であり、2台の故障は互いに独立であるとする。', range: [1, 3], both: 'ある日に2台とも故障する', none: 'ある日に2台とも故障しない', A: 'Pが故障する', B: 'Qが故障する' },
  { lead: '2つの商店街で同時にくじ引きを行う。商店街Xのくじが当たる確率は{a}、商店街Yのくじが当たる確率は{b}である。それぞれ1回ずつ引き、結果は互いに独立であるとする。', range: [1, 5], both: '両方とも当たる', none: '両方ともはずれる', A: 'Xのくじが当たる', B: 'Yのくじが当たる' },
];

export const generators: QuestionGenerator[] = [
  {
    id: 'cond-prob-table',
    unitId: 'cond-prob',
    skill: 'クロス集計表から条件付き確率を読む',
    grade: 3,
    difficulty: 1,
    replaces: ['cond-prob-q02'],
    build(rng) {
      const ctx = pick(rng, TABLE_CONTEXTS);
      const cells = [
        [int(rng, 4, 30) * 2, int(rng, 4, 30) * 2],
        [int(rng, 4, 30) * 2, int(rng, 4, 30) * 2],
      ];
      const rowT = cells.map((r) => r[0]! + r[1]!);
      const colT = [cells[0]![0]! + cells[1]![0]!, cells[0]![1]! + cells[1]![1]!];
      const N = rowT[0]! + rowT[1]!;
      const i = int(rng, 0, 1);
      const j = int(rng, 0, 1);
      const n = cells[i]![j]!;
      const nA = rowT[i]!;
      const nB = colT[j]!;
      const nAc = cells[i]![1 - j]!;
      const r = ctx.rows[i]!;
      const c = ctx.cols[j]!;
      const fl = (p: number, q: number) => `$${frac(p, q)}$`;
      const cand = (p: number, q: number, note: string): Candidate => ({ value: p / q, label: fl(p, q), note });
      const wrongs: Candidate[] = [
        cand(n, N, `全体の${N}で割った値（$\\dfrac{${n}}{${N}}$）。これは「${r}」かつ「${c}」の確率で、条件付き確率ではない。`),
        cand(n, nB, `「${c}」の列の計${nB}で割った値（$\\dfrac{${n}}{${nB}}$）。条件と結果を逆にした確率である。`),
        cand(nB, N, `全体のうち「${c}」の割合（$\\dfrac{${nB}}{${N}}$）。「${r}であった」という条件を使っていない。`),
        cand(nAc, nA, `「${r}」のうち「${ctx.cols[1 - j]}」の割合（$\\dfrac{${nAc}}{${nA}}$）。読む列を取り違えている。`),
        cand(nA, N, `全体のうち「${r}」の割合（$\\dfrac{${nA}}{${N}}$）。求めるのは「${r}」の中での「${c}」の割合である。`),
      ];
      return {
        stem: `${ctx.lead(N)}選ばれた${ctx.who}が${ctx.rowIs(r)}とき、その${ctx.who}が${ctx.colIs(c)}条件付き確率として正しいものを一つ選べ。`,
        figure: {
          type: 'table',
          title: ctx.title,
          columns: [ctx.rowHead, ...ctx.cols, '計'],
          rows: [
            [ctx.rows[0], ...cells[0]!, rowT[0]!],
            [ctx.rows[1], ...cells[1]!, rowT[1]!],
            ['計', ...colT, N],
          ],
          headerColumn: true,
        },
        ...choicesFrom(cand(n, nA, `正しい。分母を「${r}」の計${nA}に絞り、そのうち「${c}」の${n}を分子にする。`), wrongs, { rng }),
        explanation: `答えは $${frac(n, nA)}$ である。「${ctx.rowIs(r)}とき」なので、分母は「${r}」の計${nA}に絞る。そのうち「${c}」は${n}だから、\n$$P(\\text{${c}}\\mid \\text{${r}})=\\dfrac{${n}}{${nA}}=${frac(n, nA)}$$`,
      };
    },
  },
  {
    id: 'cond-prob-indep-product',
    unitId: 'cond-prob',
    skill: '独立な事象の積事象の確率',
    grade: 3,
    difficulty: 1,
    replaces: [],
    build(rng) {
      const ctx = pick(rng, INDEP_CONTEXTS);
      const a = int(rng, ctx.range[0]!, ctx.range[1]!) / 10;
      const b = int(rng, ctx.range[0]!, ctx.range[1]!) / 10;
      if (a === b) throw new Reject();
      const askBoth = rng() < 0.6;
      const aS = fixed(a, 1);
      const bS = fixed(b, 1);
      const ac = 1 - a;
      const bc = 1 - b;
      const acS = fixed(ac, 1);
      const bcS = fixed(bc, 1);
      const label = (v: number) => fixed(v, 2);
      const cand = (v: number, note: string): Candidate => ({ value: round(v, 2), label: label(v), note });
      const correct = askBoth ? a * b : ac * bc;
      const wrongs: Candidate[] = askBoth
        ? [
            cand(a + b, `2つの確率を足した値（$${aS}+${bS}$）。独立な事象が両方起こる確率は、確率の積である。`),
            cand(a + b - a * b, `どちらか少なくとも一方が起こる確率（$${aS}+${bS}-${aS}\\times ${bS}$）。両方起こる確率ではない。`),
            cand(ac * bc, `どちらも起こらない確率（$${acS}\\times ${bcS}$）。余事象の確率を掛けている。`),
            cand(a * bc, `一方だけが起こる確率の1つ（$${aS}\\times ${bcS}$）。もう一方の確率を余事象に取り違えている。`),
            cand(1 - a * b, `両方起こる確率を1から引いた値（$1-${aS}\\times ${bS}$）。これは「少なくとも一方が起こらない」確率である。`),
          ]
        : [
            cand(a * b, `両方が起こる確率（$${aS}\\times ${bS}$）。求めるのはどちらも起こらない確率で、余事象の確率を掛ける。`),
            cand(1 - a - b, `1から2つの確率を引いた値（$1-${aS}-${bS}$）。両方起こる場合を2回引いてしまっている。`),
            cand(1 - a * b, `1から両方起こる確率を引いた値（$1-${aS}\\times ${bS}$）。これは「少なくとも一方が起こらない」確率である。`),
            cand(ac + bc, `2つの余事象の確率を足した値（$${acS}+${bcS}$）。独立な事象が両方起こる確率は、確率の積である。`),
            cand(ac * b, `一方だけが起こる確率の1つ（$${acS}\\times ${bS}$）。余事象にするのを片方だけにしている。`),
          ];
      const lead = ctx.lead.replace('{a}', aS).replace('{b}', bS);
      const ask = askBoth ? ctx.both : ctx.none;
      return {
        stem: `${lead}${ask}確率として正しいものを一つ選べ。`,
        ...choicesFrom(
          cand(correct, askBoth ? `正しい。独立なので確率の積 $${aS}\\times ${bS}$ になる。` : `正しい。それぞれ起こらない確率 $${acS}$、$${bcS}$ の積になる。`),
          wrongs.filter((w) => w.value >= 0 && w.value <= 1),
          { rng },
        ),
        explanation: askBoth
          ? `答えは${label(correct)}である。2つの事象が独立なとき、両方が起こる確率はそれぞれの確率の積になる。\n$$P(A\\cap B)=P(A)\\times P(B)=${aS}\\times ${bS}=${label(correct)}$$\n（Aは「${ctx.A}」、Bは「${ctx.B}」。）`
          : `答えは${label(correct)}である。「${ctx.A}」をA、「${ctx.B}」をBとすると、AとBが独立なので、その余事象どうしも独立である。どちらも起こらない確率は、それぞれ起こらない確率の積になる。\n$$P(\\overline{A}\\cap\\overline{B})=(1-${aS})\\times(1-${bS})=${acS}\\times ${bcS}=${label(correct)}$$`,
      };
    },
  },
];
