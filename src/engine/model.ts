/**
 * 学習の進み具合（端末に保存する状態）の型と、教材データを引くための索引。
 * エンジンは React にも localStorage にも依存しない純粋な関数だけで書く。
 */
import type { Curriculum, Grade, Question, ResourceCatalog, Unit, UnitContent } from '../content/types.ts';
import { GEN_PREFIX, makeQuestion, parseVariantId, type QuestionGenerator } from '../generators/types.ts';
import type { DateStr } from './dates.ts';

/* ---------- 教材データ ---------- */

export interface Course {
  curriculum: Curriculum;
  units: Map<string, Unit>;
  content: Map<string, UnitContent>;
  /** 固定の問題（content/units の問題）。類題は含まない */
  questions: Map<string, { question: Question; unitId: string }>;
  resources: ResourceCatalog;
  /** 類題ジェネレーター（id → ジェネレーター） */
  generators: Map<string, QuestionGenerator>;
  /** 単元 id → その単元の類題ジェネレーター */
  generatorsByUnit: Map<string, QuestionGenerator[]>;
  /** 固定の問題 id → その問題の代わりに出せる類題ジェネレーター */
  replacedBy: Map<string, QuestionGenerator[]>;
}

export function buildCourse(curriculum: Curriculum, contents: UnitContent[], resources: ResourceCatalog, gens: QuestionGenerator[] = []): Course {
  const units = new Map(curriculum.units.map((u) => [u.id, u]));
  const content = new Map<string, UnitContent>();
  const questions = new Map<string, { question: Question; unitId: string }>();
  for (const c of contents) {
    if (!units.has(c.unitId)) continue;
    content.set(c.unitId, c);
    for (const q of c.questions) questions.set(q.id, { question: q, unitId: c.unitId });
  }
  const generators = new Map<string, QuestionGenerator>();
  const generatorsByUnit = new Map<string, QuestionGenerator[]>();
  const replacedBy = new Map<string, QuestionGenerator[]>();
  for (const g of gens) {
    if (!units.has(g.unitId)) continue;
    generators.set(g.id, g);
    generatorsByUnit.set(g.unitId, [...(generatorsByUnit.get(g.unitId) ?? []), g]);
    for (const r of g.replaces) {
      if (questions.has(r)) replacedBy.set(r, [...(replacedBy.get(r) ?? []), g]);
    }
  }
  return { curriculum, units, content, questions, resources, generators, generatorsByUnit, replacedBy };
}

const variantCache = new Map<string, { question: Question; unitId: string } | null>();

/** 問題 id から問題を引く。類題（gen:…~seed）は種から作り直す。見つからなければ undefined */
export function lookup(course: Course, id: string): { question: Question; unitId: string } | undefined {
  const fixed = course.questions.get(id);
  if (fixed) return fixed;
  const v = parseVariantId(id);
  if (!v) return undefined;
  if (!variantCache.has(id)) {
    const g = course.generators.get(v.genId);
    let entry: { question: Question; unitId: string } | null = null;
    if (g) {
      try {
        entry = { question: makeQuestion(g, v.seed), unitId: g.unitId };
      } catch {
        entry = null;
      }
    }
    if (variantCache.size > 500) variantCache.clear();
    variantCache.set(id, entry);
  }
  return variantCache.get(id) ?? undefined;
}

export function isVariant(id: string): boolean {
  return id.startsWith(GEN_PREFIX) && id.includes('~');
}

/**
 * 解答の記録に使うキー。固定の問題はその id、類題はジェネレーター単位（gen:<id>）にまとめる
 * （類題は種ごとに別の id になるので、種ごとに記録すると際限なく増える）。
 */
export function statKey(id: string): string {
  const v = parseVariantId(id);
  return v ? `${GEN_PREFIX}${v.genId}` : id;
}

/** 補習（数学）の単元かどうか */
export function isSupportUnit(course: Course, unit: Unit): boolean {
  return course.curriculum.stages.find((s) => s.id === unit.stageId)?.support === true;
}

/**
 * 目標の級に対する学習ルート（補習を除く、学習順の単元）。
 * 3級が目標なら 4級の範囲 → 3級の範囲の順にすべて。
 */
export function routeUnits(course: Course, goal: Grade): Unit[] {
  return course.curriculum.units.filter((u) => !isSupportUnit(course, u) && u.grade >= goal);
}

/** ある級「だけ」で新しく学ぶ単元（4級コース / 3級の差分コース） */
export function gradeUnits(course: Course, grade: Grade): Unit[] {
  return course.curriculum.units.filter((u) => !isSupportUnit(course, u) && u.grade === grade);
}

/* ---------- 進み具合 ---------- */

export interface Settings {
  onboarded: boolean;
  goal: Grade;
  /** 1 日の学習時間の目安（分） */
  minutesPerDay: number;
  /** 受験予定日（未定なら undefined） */
  examDate?: DateStr;
}

/**
 * new      まだ始めていない
 * learning 学習中（教材を開いた／確認テストに届かなかった）
 * passed   確認テストに合格（翌日以降の定着チェック待ち）
 * mastered 定着チェックにも合格
 */
export type UnitStatus = 'new' | 'learning' | 'passed' | 'mastered';

export interface UnitProgress {
  status: UnitStatus;
  /** 確認テストを受けた回数 */
  attempts: number;
  /** 直近の確認テスト */
  lastCheck?: { date: DateStr; correct: number; total: number; questionIds: string[] };
  passedOn?: DateStr;
  /** 定着チェックを出題できる最初の日 */
  confirmDue?: DateStr;
  masteredOn?: DateStr;
  /** 開いた外部教材のリンク id */
  visited: string[];
  /** 定着後のおさらい（間隔をあけて出す）。stage は RULES.maintainIntervals の位置 */
  maintain?: { stage: number; due: DateStr };
}

export interface QuestionStat {
  seen: number;
  correct: number;
  lastDate?: DateStr;
  lastCorrect?: boolean;
  /** 復習待ちなら、復習の段階（0 始まり）と次に出す日 */
  review?: { stage: number; due: DateStr };
}

export interface MockResult {
  id: string;
  grade: Grade;
  date: DateStr;
  /** かかった時間（秒） */
  seconds: number;
  questionIds: string[];
  /** 選んだ選択肢の添字。未回答は null */
  answers: (number | null)[];
  correct: number;
  /** 受験時点で一度も見たことがなかった問題の数と、そのうちの正答数 */
  unseen: number;
  unseenCorrect: number;
}

export interface ActiveMock {
  grade: Grade;
  questionIds: string[];
  answers: (number | null)[];
  flags: boolean[];
  /** 開始時刻・終了予定時刻（エポックミリ秒） */
  startedAt: number;
  endsAt: number;
  /** 開始時点で初見だった問題 id */
  unseenIds: string[];
}

/** 外部の模試・公式問題集の自己採点の記録 */
export interface ExternalScore {
  id: string;
  date: DateStr;
  grade: Grade;
  label: string;
  percent: number;
}

export interface Progress {
  version: 1;
  createdOn: DateStr;
  settings: Settings;
  units: Record<string, UnitProgress>;
  questions: Record<string, QuestionStat>;
  mocks: MockResult[];
  activeMock?: ActiveMock;
  external: ExternalScore[];
  /** 外部教材を開いて離れた記録（戻ってきたときに声をかける） */
  away?: { unitId: string; linkId: string; at: number };
  /** 日ごとの解答数（学習の記録） */
  days: Record<DateStr, { answered: number; correct: number }>;
  lastBackupOn?: DateStr;
}

export function emptyProgress(today: DateStr): Progress {
  return {
    version: 1,
    createdOn: today,
    settings: { onboarded: false, goal: 3, minutesPerDay: 40 },
    units: {},
    questions: {},
    mocks: [],
    external: [],
    days: {},
  };
}

export function unitProgress(p: Progress, unitId: string): UnitProgress {
  return p.units[unitId] ?? { status: 'new', attempts: 0, visited: [] };
}

/* ---------- 学習ルールの定数 ---------- */

export const RULES = {
  /** 確認テストの問題数と合格に必要な正答数 */
  checkSize: 5,
  checkPass: 4,
  /** 定着チェック（確認テスト合格の翌日以降）の問題数と合格に必要な正答数 */
  confirmSize: 3,
  confirmPass: 2,
  /** 間違えた問題を出し直す間隔（日）。最後まで正解すると復習待ちから外れる */
  reviewIntervals: [1, 3, 7],
  /** 1 回の復習で出す問題数の上限（復習が溜まっても新しい単元に進めるようにする） */
  reviewCap: 12,
  /** 1 回の復習で扱う定着チェックの単元数の上限 */
  confirmUnitsCap: 2,
  /** 弱点とみなす正答率（直近の解答） */
  weakAccuracy: 0.6,
  /** 定着した単元のおさらいの間隔（日）。最後の間隔をくり返す */
  maintainIntervals: [14, 30, 60],
  /** おさらい 1 単元あたりの問題数と、1 回の復習で扱う単元数の上限 */
  maintainSize: 2,
  maintainUnitsCap: 2,
} as const;
