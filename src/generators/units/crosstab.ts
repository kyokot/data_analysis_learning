/** クロス集計表（行比率・列比率）の類題 */
import { choicesFrom, int, pick, round, sum, type Candidate } from '../kit.ts';
import type { Rng } from '../../engine/rng.ts';
import type { Figure } from '../../content/types.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

interface Ctx {
  lead: (N: number) => string;
  title: string;
  rowHead: string;
  rows: [string, string];
  cols: string[];
  rowNoun: (r: string) => string;
  colNoun: (c: string) => string;
}

const CONTEXTS: Ctx[] = [
  {
    lead: (N) => `ある中学校の1組と2組の生徒${N}人に、飼ってみたいペットをたずね、次の表にまとめた。`,
    title: '組と飼ってみたいペット（人）',
    rowHead: '組',
    rows: ['1組', '2組'],
    cols: ['犬', '猫', 'その他'],
    rowNoun: (r) => `${r}の生徒`,
    colNoun: (c) => `${c}と答えた生徒`,
  },
  {
    lead: (N) => `あるカフェで、ある週に注文した客${N}人について、来店した曜日と注文の形を調べ、次の表にまとめた。`,
    title: '曜日と注文の形（人）',
    rowHead: '曜日',
    rows: ['平日', '休日'],
    cols: ['店内で飲食', '持ち帰り'],
    rowNoun: (r) => `${r}の客`,
    colNoun: (c) => `${c}の客`,
  },
  {
    lead: (N) => `ある市の図書館の利用者${N}人に、ふだん本を読む形をたずね、次の表にまとめた。`,
    title: '年代と本を読む形（人）',
    rowHead: '年代',
    rows: ['30歳未満', '30歳以上'],
    cols: ['紙の本', '電子書籍', '両方'],
    rowNoun: (r) => `${r}の利用者`,
    colNoun: (c) => `${c}と答えた利用者`,
  },
  {
    lead: (N) => `ある音楽イベントの来場者${N}人に、住んでいる場所と会場までの交通手段をたずね、次の表にまとめた。`,
    title: '住んでいる場所と交通手段（人）',
    rowHead: '住んでいる場所',
    rows: ['市内', '市外'],
    cols: ['電車', 'バス', '自家用車'],
    rowNoun: (r) => `${r}に住む来場者`,
    colNoun: (c) => `${c}で来た来場者`,
  },
  {
    lead: (N) => `ある遊園地で、来園者${N}人に来園の回数と満足度をたずね、次の表にまとめた。`,
    title: '来園の回数と満足度（人）',
    rowHead: '来園の回数',
    rows: ['初めて', '2回目以上'],
    cols: ['満足', '不満'],
    rowNoun: (r) => `来園が${r}の人`,
    colNoun: (c) => `${c}と答えた人`,
  },
];

/** 合計 T を k 個に分ける。各割合は 5% 刻みで 10% 以上 */
function splitPct(rng: Rng, k: number): number[] {
  const p: number[] = [];
  let rest = 100;
  for (let i = 0; i < k - 1; i++) {
    const v = 5 * int(rng, 2, (rest - 10 * (k - 1 - i)) / 5);
    p.push(v);
    rest -= v;
  }
  p.push(rest);
  if (p.some((x) => x < 10)) throw new Reject();
  return p;
}

function randomRow(rng: Rng, k: number): number[] {
  return Array.from({ length: k }, () => int(rng, 6, 90));
}

function makeTable(ctx: Ctx, cells: number[][]): { figure: Figure; rowT: number[]; colT: number[]; N: number } {
  const rowT = cells.map((r) => sum(r));
  const colT = ctx.cols.map((_, j) => cells[0]![j]! + cells[1]![j]!);
  const N = sum(rowT);
  const figure: Figure = {
    type: 'table',
    title: ctx.title,
    columns: [ctx.rowHead, ...ctx.cols, '計'],
    rows: [...cells.map((r, i) => [ctx.rows[i]!, ...r, rowT[i]!]), ['計', ...colT, N]],
    headerColumn: true,
  };
  return { figure, rowT, colT, N };
}

const pct = (v: number) => `${round(v * 100, 0)}%`;
const cand = (v: number, note: string): Candidate => ({ value: round(v * 100, 0), label: pct(v), note });

export const generators: QuestionGenerator[] = [
  {
    id: 'crosstab-row-ratio',
    unitId: 'crosstab',
    skill: '行比率を計算する',
    grade: 4,
    difficulty: 2,
    replaces: ['crosstab-q03'],
    build(rng) {
      const ctx = pick(rng, CONTEXTS);
      const k = ctx.cols.length;
      const i = int(rng, 0, 1);
      const j = int(rng, 0, k - 1);
      const T = 20 * int(rng, 3, 10);
      const p = splitPct(rng, k);
      const target = p.map((x) => (T * x) / 100);
      const cells = i === 0 ? [target, randomRow(rng, k)] : [randomRow(rng, k), target];
      const { figure, rowT, colT, N } = makeTable(ctx, cells);
      const a = cells[i]![j]!;
      const R = rowT[i]!;
      const C = colT[j]!;
      const r = ctx.rows[i]!;
      const c = ctx.cols[j]!;
      const j2 = (j + 1) % k;
      const b = cells[i]![j2]!;
      const wrongs: Candidate[] = [
        cand(a / C, `${c}の列の合計${C}で割った列比率（$${a}\\div ${C}$）で、「${ctx.colNoun(c)}のうち${ctx.rowNoun(r)}の割合」になっている。`),
        cand(a / N, `全体の${N}人で割った全体比率（$${a}\\div ${N}$）を答えた値。`),
        cand(R / N, `${ctx.rowNoun(r)}が全体に占める割合（$${R}\\div ${N}$）で、${c}に限っていない。`),
        cand(b / R, `${ctx.rowNoun(r)}のうち、${ctx.cols[j2]}の割合（$${b}\\div ${R}$）を答えた値。読む列を取り違えている。`),
        cand(C / N, `${ctx.colNoun(c)}が全体に占める割合（$${C}\\div ${N}$）で、${r}に限っていない。`),
      ];
      const q = `${ctx.rowNoun(r)}のうち、${ctx.colNoun(c)}の割合`;
      return {
        stem: `${ctx.lead(N)}${q}として正しいものを一つ選べ。ただし、割り切れないときは小数第1位を四捨五入した値とする。`,
        figure,
        ...choicesFrom(cand(a / R, `正しい。${r}の行の合計${R}で割った行比率（$${a}\\div ${R}$）である。`), wrongs, { rng }),
        explanation: `答えは${pct(a / R)}である。「${ctx.rowNoun(r)}のうち」なので、分母は${r}の行の合計${R}人。分子は${r}で${c}の${a}人。\n$${a}\\div ${R}=${round(a / R, 2)}$ より${pct(a / R)}となる。`,
      };
    },
  },
  {
    id: 'crosstab-col-ratio',
    unitId: 'crosstab',
    skill: '列比率を計算する',
    grade: 4,
    difficulty: 2,
    replaces: ['crosstab-q04'],
    build(rng) {
      const ctx = pick(rng, CONTEXTS);
      const k = ctx.cols.length;
      const i = int(rng, 0, 1);
      const j = int(rng, 0, k - 1);
      const T = 20 * int(rng, 3, 8);
      const pi = 5 * int(rng, 2, 18);
      const top = (T * pi) / 100;
      const col = i === 0 ? [top, T - top] : [T - top, top];
      const cells = [randomRow(rng, k), randomRow(rng, k)];
      cells[0]![j] = col[0]!;
      cells[1]![j] = col[1]!;
      const { figure, rowT, colT, N } = makeTable(ctx, cells);
      const a = cells[i]![j]!;
      const R = rowT[i]!;
      const C = colT[j]!;
      const r = ctx.rows[i]!;
      const r2 = ctx.rows[1 - i]!;
      const c = ctx.cols[j]!;
      if (C !== T) throw new Reject();
      const wrongs: Candidate[] = [
        cand(a / R, `${r}の行の合計${R}で割った行比率（$${a}\\div ${R}$）で、「${ctx.rowNoun(r)}のうち${ctx.colNoun(c)}の割合」になっている。`),
        cand(a / N, `全体の${N}人で割った全体比率（$${a}\\div ${N}$）を答えた値。`),
        cand(C / N, `${ctx.colNoun(c)}が全体に占める割合（$${C}\\div ${N}$）で、${r}に限っていない。`),
        cand((C - a) / C, `${ctx.colNoun(c)}のうち、${r2}の割合（$${C - a}\\div ${C}$）を答えた値。読む行を取り違えている。`),
        cand(R / N, `${ctx.rowNoun(r)}が全体に占める割合（$${R}\\div ${N}$）で、${c}に限っていない。`),
      ];
      const q = `${ctx.colNoun(c)}のうち、${ctx.rowNoun(r)}の割合`;
      return {
        stem: `${ctx.lead(N)}${q}として正しいものを一つ選べ。ただし、割り切れないときは小数第1位を四捨五入した値とする。`,
        figure,
        ...choicesFrom(cand(a / C, `正しい。${c}の列の合計${C}で割った列比率（$${a}\\div ${C}$）である。`), wrongs, { rng }),
        explanation: `答えは${pct(a / C)}である。「${ctx.colNoun(c)}のうち」なので、分母は${c}の列の合計${C}人。分子は${r}で${c}の${a}人。\n$${a}\\div ${C}=${round(a / C, 2)}$ より${pct(a / C)}となる。`,
      };
    },
  },
];
