/**
 * content/ 以下の JSON のスキーマ（zod）。アプリ本体には含めず、検証（CLI・テスト）でのみ使う。
 */
import { z } from 'zod';

const text = z.string().min(1);
const grade = z.union([z.literal(4), z.literal(3)]);

export const domainIds = [
  'math',
  'survey',
  'graphs',
  'summary',
  'relation',
  'timeseries',
  'probability',
  'distribution',
  'inference',
] as const;
const domainId = z.enum(domainIds);

/* ---------- カリキュラム ---------- */

const stage = z.strictObject({
  id: text,
  title: text,
  description: text,
  grade,
  support: z.boolean().optional(),
});

const unit = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  stageId: text,
  title: text,
  grade,
  domain: domainId,
  prerequisites: z.array(text),
  refreshers: z.array(text).optional(),
  goals: z.array(text).min(1).max(5),
  minutes: z.number().int().positive(),
  official: text,
});

const mock = z.strictObject({
  grade,
  questions: z.number().int().positive(),
  minutes: z.number().int().positive(),
  passLine: z.number().min(0).max(100),
  safeLine: z.number().min(0).max(100),
  domains: z.partialRecord(domainId, z.number().int().nonnegative()),
});

export const curriculumSchema = z.strictObject({
  domains: z.array(z.strictObject({ id: domainId, title: text })),
  stages: z.array(stage).min(1),
  units: z.array(unit).min(1),
  mocks: z.array(mock),
});

/* ---------- 図表 ---------- */

const cell = z.union([z.string(), z.number()]);
const series = z.strictObject({ name: text.optional(), values: z.array(z.number()).min(1) });
const title = text.optional();

const tableFigure = z.strictObject({
  type: z.literal('table'),
  title,
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(cell).min(1)).min(1),
  headerColumn: z.boolean().optional(),
  note: text.optional(),
});
const barFigure = z.strictObject({
  type: z.literal('bar'),
  title,
  xLabel: text.optional(),
  yLabel: text.optional(),
  categories: z.array(text).min(1),
  series: z.array(series).min(1).max(4),
  stacked: z.boolean().optional(),
  showValues: z.boolean().optional(),
});
const bandFigure = z.strictObject({
  type: z.literal('band'),
  title,
  rows: z.array(text).min(1),
  segments: z.array(series).min(2).max(6),
  showValues: z.boolean().optional(),
});
const pieFigure = z.strictObject({
  type: z.literal('pie'),
  title,
  slices: z.array(z.strictObject({ label: text, value: z.number().positive() })).min(2).max(7),
  showPercent: z.boolean().optional(),
});
const lineFigure = z.strictObject({
  type: z.literal('line'),
  title,
  xLabel: text.optional(),
  yLabel: text.optional(),
  x: z.array(text).min(2),
  series: z.array(series).min(1).max(4),
  yMin: z.number().optional(),
  yMax: z.number().optional(),
  showValues: z.boolean().optional(),
});
const histogramFigure = z.strictObject({
  type: z.literal('histogram'),
  title,
  xLabel: text.optional(),
  yLabel: text.optional(),
  edges: z.array(z.number()).min(2),
  counts: z.array(z.number().nonnegative()).min(1),
  showCounts: z.boolean().optional(),
  relative: z.boolean().optional(),
});
const boxSummary = z.strictObject({
  label: z.string(),
  min: z.number(),
  q1: z.number(),
  median: z.number(),
  q3: z.number(),
  max: z.number(),
  outliers: z.array(z.number()).optional(),
});
const boxplotFigure = z.strictObject({
  type: z.literal('boxplot'),
  title,
  axisLabel: text.optional(),
  boxes: z.array(boxSummary).min(1).max(6),
  axisMin: z.number().optional(),
  axisMax: z.number().optional(),
});
const scatterFigure = z.strictObject({
  type: z.literal('scatter'),
  title,
  xLabel: text.optional(),
  yLabel: text.optional(),
  points: z.array(z.tuple([z.number(), z.number()])).min(3),
  line: z.strictObject({ slope: z.number(), intercept: z.number() }).optional(),
  xMin: z.number().optional(),
  xMax: z.number().optional(),
  yMin: z.number().optional(),
  yMax: z.number().optional(),
});
const dotplotFigure = z.strictObject({
  type: z.literal('dotplot'),
  title,
  axisLabel: text.optional(),
  values: z.array(z.number().int()).min(1),
});
const stemLeafFigure = z.strictObject({
  type: z.literal('stemleaf'),
  title,
  stemLabel: text.optional(),
  leafLabel: text.optional(),
  rows: z.array(z.strictObject({ stem: z.string(), leaves: z.array(z.string()) })).min(1),
  note: text.optional(),
});
const normalFigure = z.strictObject({
  type: z.literal('normal'),
  title,
  xLabel: text.optional(),
  mean: z.number(),
  sd: z.number().positive(),
  shade: z.array(z.strictObject({ from: z.number().optional(), to: z.number().optional() })).optional(),
  marks: z.array(z.number()).optional(),
});

const singleFigure = z.discriminatedUnion('type', [
  tableFigure,
  barFigure,
  bandFigure,
  pieFigure,
  lineFigure,
  histogramFigure,
  boxplotFigure,
  scatterFigure,
  dotplotFigure,
  stemLeafFigure,
  normalFigure,
]);
const panelsFigure = z.strictObject({
  type: z.literal('panels'),
  title,
  panels: z.array(z.strictObject({ label: text, figure: singleFigure })).min(2).max(6),
});
export const figureSchema = z.union([singleFigure, panelsFigure]);

/* ---------- 要点・問題 ---------- */

const lesson = z.strictObject({
  intro: text,
  points: z.array(z.strictObject({ title: text, body: text })).min(3).max(6),
  formulas: z.array(z.strictObject({ name: text, tex: text, note: text.optional() })).max(6).optional(),
  example: z.strictObject({
    problem: text,
    figure: figureSchema.optional(),
    steps: z.array(text).min(2).max(7),
    answer: text,
  }),
  pitfalls: z.array(text).min(2).max(5),
  examTips: z.array(text).min(1).max(4),
});

const question = z.strictObject({
  id: text,
  grade,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  pool: z.enum(['practice', 'exam']),
  skill: text.max(40),
  stem: text.max(700),
  figure: figureSchema.optional(),
  choices: z.array(text).min(4).max(5),
  answer: z.number().int().nonnegative(),
  explanation: z.string().min(30),
  choiceNotes: z.array(text).min(4).max(5),
});

/** 1 問のスキーマ（類題ジェネレーターの出力の検査にも使う） */
export const questionSchema = question;

export const unitContentSchema = z.strictObject({
  unitId: text,
  lesson,
  questions: z.array(question).min(1),
});

/* ---------- 外部教材 ---------- */

const provider = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: text,
  operator: text,
  url: z.string().regex(/^https:\/\//),
  kind: z.enum(['official', 'public', 'university', 'textbook', 'math', 'video', 'interactive', 'practice', 'data']),
  tier: z.enum(['S', 'A', 'B']),
  description: text,
  free: z.enum(['free', 'freemium', 'paid']),
  loginRequired: z.enum(['no', 'optional', 'yes']),
  linkPolicy: text.optional(),
});

const resourceLink = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  providerId: text,
  title: text,
  url: z.string().regex(/^https:\/\//),
  type: z.enum(['text', 'video', 'interactive', 'practice', 'mock', 'official', 'reference', 'data']),
  unitIds: z.array(text),
  role: z.enum(['primary', 'supplement', 'math', 'practice']),
  minutes: z.number().int().positive().optional(),
  focus: text,
  note: text.optional(),
  search: text.optional(),
  checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  verifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const resourceCatalogSchema = z.strictObject({
  providers: z.array(provider),
  links: z.array(resourceLink),
});
