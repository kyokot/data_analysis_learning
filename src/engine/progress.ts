/**
 * 進み具合を更新する純粋関数（状態を受け取り、新しい状態を返す）。
 */
import type { Grade } from '../content/types.ts';
import { addDays, type DateStr } from './dates.ts';
import {
  RULES,
  isSupportUnit,
  lookup,
  statKey,
  unitProgress,
  type ActiveMock,
  type Course,
  type ExternalScore,
  type MockResult,
  type Progress,
  type QuestionStat,
  type Settings,
  type UnitProgress,
} from './model.ts';
import type { MockPaper } from './select.ts';

/** 解答の文脈。review のときだけ、正解で復習の段階が進む */
export type AnswerContext = 'check' | 'confirm' | 'review' | 'maintain' | 'mock' | 'drill';

export interface Answer {
  questionId: string;
  /** 選んだ選択肢の添字。「わからない」・未回答は null */
  choice: number | null;
}

function withUnit(p: Progress, unitId: string, patch: Partial<UnitProgress>): Progress {
  return { ...p, units: { ...p.units, [unitId]: { ...unitProgress(p, unitId), ...patch } } };
}

export function isCorrect(course: Course, a: Answer): boolean {
  const entry = lookup(course, a.questionId);
  return !!entry && a.choice !== null && a.choice === entry.question.answer;
}

/**
 * 1 問の解答を記録する。間違い・「わからない」は翌日の復習に回す。
 * 記録のキーは statKey（類題はジェネレーター単位）。reviewKey を渡すと、復習の段階はそのキーで管理する
 * （固定の問題の出し直しで類題を出したとき、もとの問題の復習を進めるため）。
 */
export function recordAnswer(course: Course, p: Progress, a: Answer, context: AnswerContext, today: DateStr, reviewKey?: string): Progress {
  if (!lookup(course, a.questionId)) return p;
  const correct = isCorrect(course, a);
  const key = statKey(a.questionId);
  const rKey = reviewKey ?? key;
  const prev: QuestionStat = p.questions[key] ?? { seen: 0, correct: 0 };
  const stat: QuestionStat = {
    seen: prev.seen + 1,
    correct: prev.correct + (correct ? 1 : 0),
    lastDate: today,
    lastCorrect: correct,
    ...(prev.review ? { review: prev.review } : {}),
  };
  const questions = { ...p.questions, [key]: stat };
  const target: QuestionStat = questions[rKey] ?? { seen: 0, correct: 0 };
  let review = target.review;
  if (!correct) {
    review = { stage: 0, due: addDays(today, RULES.reviewIntervals[0]) };
  } else if (context === 'review' && review) {
    const next = review.stage + 1;
    const interval = RULES.reviewIntervals[next];
    review = interval === undefined ? undefined : { stage: next, due: addDays(today, interval) };
  }
  const { review: _old, ...rest } = target;
  questions[rKey] = review ? { ...rest, review } : rest;
  const day = p.days[today] ?? { answered: 0, correct: 0 };
  return {
    ...p,
    questions,
    days: { ...p.days, [today]: { answered: day.answered + 1, correct: day.correct + (correct ? 1 : 0) } },
  };
}

export function recordAnswers(course: Course, p: Progress, answers: (Answer & { reviewKey?: string })[], context: AnswerContext, today: DateStr): Progress {
  return answers.reduce((acc, a) => recordAnswer(course, acc, a, context, today, a.reviewKey), p);
}

export interface CheckOutcome {
  progress: Progress;
  correct: number;
  total: number;
  passed: boolean;
}

/**
 * 確認テストの結果を反映する。
 * 合格（checkPass 問以上正解）で passed になり、翌日以降に定着チェックが出る。
 * 補習単元は定着チェックなしで mastered にする。
 */
export function completeCheck(course: Course, p: Progress, unitId: string, answers: Answer[], today: DateStr): CheckOutcome {
  const unit = course.units.get(unitId);
  let next = recordAnswers(course, p, answers, 'check', today);
  const correct = answers.filter((a) => isCorrect(course, a)).length;
  const total = answers.length;
  const need = Math.min(RULES.checkPass, Math.ceil(total * (RULES.checkPass / RULES.checkSize)));
  const passed = total > 0 && correct >= need;
  const prev = unitProgress(next, unitId);
  const lastCheck = { date: today, correct, total, questionIds: answers.map((a) => a.questionId) };
  if (!passed) {
    // すでに合格・定着している単元を練習で受け直して落ちても、状態は下げない（下げるのは定着チェックだけ）
    const status = prev.status === 'passed' || prev.status === 'mastered' ? prev.status : 'learning';
    next = withUnit(next, unitId, { status, attempts: prev.attempts + 1, lastCheck });
  } else if (prev.status === 'mastered') {
    next = withUnit(next, unitId, { attempts: prev.attempts + 1, lastCheck });
  } else if (unit && isSupportUnit(course, unit)) {
    next = withUnit(next, unitId, { status: 'mastered', attempts: prev.attempts + 1, lastCheck, passedOn: today, masteredOn: today });
  } else {
    next = withUnit(next, unitId, {
      status: 'passed',
      attempts: prev.attempts + 1,
      lastCheck,
      passedOn: today,
      confirmDue: addDays(today, 1),
    });
  }
  return { progress: next, correct, total, passed };
}

/**
 * 定着チェックの結果を反映する。合格で mastered。
 * 届かなければ learning に戻し、確認テストからやり直す（「一度できた」を鵜呑みにしない）。
 */
export function completeConfirm(course: Course, p: Progress, unitId: string, answers: Answer[], today: DateStr): CheckOutcome {
  let next = recordAnswers(course, p, answers, 'confirm', today);
  const correct = answers.filter((a) => isCorrect(course, a)).length;
  const total = answers.length;
  const need = Math.min(RULES.confirmPass, total);
  const passed = total > 0 && correct >= need;
  const prev = unitProgress(next, unitId);
  if (prev.status !== 'passed') return { progress: next, correct, total, passed };
  next = passed
    ? withUnit(next, unitId, {
        status: 'mastered',
        masteredOn: today,
        confirmDue: undefined,
        maintain: { stage: 0, due: addDays(today, RULES.maintainIntervals[0]) },
      })
    : withUnit(next, unitId, { status: 'learning', confirmDue: undefined });
  return { progress: next, correct, total, passed };
}

/**
 * 定着後のおさらいの結果を反映する。全問正解なら次の間隔へ、1 問でも間違えたら最初の間隔に戻す。
 * 間違えた問題は、通常の出し直しにも入る（recordAnswer）。単元の状態（定着）は下げない。
 */
export function completeMaintenance(
  course: Course,
  p: Progress,
  unitId: string,
  answers: (Answer & { reviewKey?: string })[],
  today: DateStr,
): CheckOutcome {
  let next = recordAnswers(course, p, answers, 'maintain', today);
  const correct = answers.filter((a) => isCorrect(course, a)).length;
  const total = answers.length;
  const passed = total > 0 && correct === total;
  const prev = unitProgress(next, unitId);
  const stage = passed ? Math.min((prev.maintain?.stage ?? 0) + 1, RULES.maintainIntervals.length - 1) : 0;
  next = withUnit(next, unitId, { maintain: { stage, due: addDays(today, RULES.maintainIntervals[stage]!) } });
  return { progress: next, correct, total, passed };
}

export function markOpened(p: Progress, unitId: string): Progress {
  const prev = unitProgress(p, unitId);
  return prev.status === 'new' ? withUnit(p, unitId, { status: 'learning' }) : p;
}

/** 外部教材を開いたことを記録する（戻ってきたときの声かけに使う） */
export function markVisited(p: Progress, unitId: string, linkId: string, now: number): Progress {
  const prev = unitProgress(p, unitId);
  const visited = prev.visited.includes(linkId) ? prev.visited : [...prev.visited, linkId];
  const next = withUnit(p, unitId, { visited, status: prev.status === 'new' ? 'learning' : prev.status });
  return { ...next, away: { unitId, linkId, at: now } };
}

export function clearAway(p: Progress): Progress {
  if (!p.away) return p;
  const { away: _away, ...rest } = p;
  return rest;
}

export function updateSettings(p: Progress, patch: Partial<Settings>): Progress {
  const settings = { ...p.settings, ...patch };
  if ('examDate' in patch && !patch.examDate) delete settings.examDate;
  return { ...p, settings };
}

/* ---------- 模試 ---------- */

export function startMock(p: Progress, grade: Grade, paper: MockPaper, minutes: number, now: number): Progress {
  const activeMock: ActiveMock = {
    grade,
    questionIds: paper.questionIds,
    answers: paper.questionIds.map(() => null),
    flags: paper.questionIds.map(() => false),
    startedAt: now,
    endsAt: now + minutes * 60_000,
    unseenIds: paper.unseenIds,
  };
  return { ...p, activeMock };
}

export function answerMock(p: Progress, index: number, choice: number | null): Progress {
  if (!p.activeMock) return p;
  const answers = [...p.activeMock.answers];
  answers[index] = choice;
  return { ...p, activeMock: { ...p.activeMock, answers } };
}

export function flagMock(p: Progress, index: number, flag: boolean): Progress {
  if (!p.activeMock) return p;
  const flags = [...p.activeMock.flags];
  flags[index] = flag;
  return { ...p, activeMock: { ...p.activeMock, flags } };
}

export function abandonMock(p: Progress): Progress {
  const { activeMock: _m, ...rest } = p;
  return rest;
}

/** 模試を採点して記録する。間違えた問題は復習に回る。 */
export function finishMock(course: Course, p: Progress, now: number, today: DateStr): { progress: Progress; result: MockResult | null } {
  const m = p.activeMock;
  if (!m) return { progress: p, result: null };
  const answers: Answer[] = m.questionIds.map((questionId, i) => ({ questionId, choice: m.answers[i] ?? null }));
  const unseen = new Set(m.unseenIds);
  const result: MockResult = {
    id: `mock-${m.startedAt}`,
    grade: m.grade,
    date: today,
    seconds: Math.max(0, Math.round((Math.min(now, m.endsAt) - m.startedAt) / 1000)),
    questionIds: m.questionIds,
    answers: m.answers,
    correct: answers.filter((a) => isCorrect(course, a)).length,
    unseen: unseen.size,
    unseenCorrect: answers.filter((a) => unseen.has(a.questionId) && isCorrect(course, a)).length,
  };
  const recorded = recordAnswers(course, abandonMock(p), answers, 'mock', today);
  return { progress: { ...recorded, mocks: [...recorded.mocks, result] }, result };
}

/* ---------- 外部の模試・公式問題集の記録 ---------- */

export function addExternalScore(p: Progress, score: ExternalScore): Progress {
  return { ...p, external: [...p.external, score] };
}

export function removeExternalScore(p: Progress, id: string): Progress {
  return { ...p, external: p.external.filter((e) => e.id !== id) };
}
