/**
 * 「次に何をするか」を決める。学習者に選ばせず、決まった優先順位で 1 つに絞る。
 *
 *   1. 今日の復習（定着チェック・間違えた問題の出し直し）
 *   2. 学習中の単元の続き
 *   3. 4級コースを終えた直後の 4級模試（3級が目標の人には腕試しとして）
 *   4. 次の単元
 *   5. すべての単元を終えたら、目標の級の模試 → 弱点の補強 → 受験の目安
 */
import type { Grade, MockBlueprint, Unit } from '../content/types.ts';
import { addDays, diffDays, type DateStr } from './dates.ts';
import { RULES, gradeUnits, routeUnits, unitProgress, type Course, type MockResult, type Progress } from './model.ts';
import type { Rng } from './rng.ts';
import { buildReview, reviewQuestionCount, type ReviewPlan } from './select.ts';

export type Step =
  | { kind: 'review'; plan: ReviewPlan; questions: number }
  | { kind: 'unit'; unitId: string; phase: 'start' | 'continue' }
  | { kind: 'mock'; grade: Grade; reason: 'milestone' | 'first' | 'retry' }
  | { kind: 'weak'; grade: Grade; unitIds: string[] }
  | { kind: 'ready'; grade: Grade }
  | { kind: 'rest' };

export function isDone(p: Progress, unitId: string): boolean {
  const s = unitProgress(p, unitId).status;
  return s === 'passed' || s === 'mastered';
}

export function blueprintFor(course: Course, grade: Grade): MockBlueprint | undefined {
  return course.curriculum.mocks.find((m) => m.grade === grade);
}

export function mockPercent(m: MockResult): number {
  return m.questionIds.length ? Math.round((m.correct / m.questionIds.length) * 100) : 0;
}

export function latestMock(p: Progress, grade: Grade): MockResult | undefined {
  return [...p.mocks].reverse().find((m) => m.grade === grade);
}

/** 直近の模試で間違えた問題がある単元（学習順） */
export function missedUnits(course: Course, m: MockResult): string[] {
  const missed = new Set<string>();
  m.questionIds.forEach((id, i) => {
    const entry = course.questions.get(id);
    if (entry && m.answers[i] !== entry.question.answer) missed.add(entry.unitId);
  });
  return course.curriculum.units.filter((u) => missed.has(u.id)).map((u) => u.id);
}

/** 今日やることを、優先順位の高い順に並べる。先頭が「今日の一歩」。 */
export function planToday(course: Course, p: Progress, today: DateStr, rng: Rng): Step[] {
  const steps: Step[] = [];
  const goal = p.settings.goal;

  const plan = buildReview(course, p, today, rng);
  const reviewCount = reviewQuestionCount(plan);
  if (reviewCount > 0) steps.push({ kind: 'review', plan, questions: reviewCount });

  const route = routeUnits(course, goal).filter((u) => course.content.has(u.id));
  const learning = route.find((u) => unitProgress(p, u.id).status === 'learning');
  if (learning) steps.push({ kind: 'unit', unitId: learning.id, phase: 'continue' });

  if (goal === 3 && blueprintFor(course, 4)) {
    const g4 = gradeUnits(course, 4).filter((u) => course.content.has(u.id));
    if (g4.length > 0 && g4.every((u) => isDone(p, u.id)) && !latestMock(p, 4)) {
      steps.push({ kind: 'mock', grade: 4, reason: 'milestone' });
    }
  }

  const next = route.find((u) => unitProgress(p, u.id).status === 'new');
  if (next && !learning) steps.push({ kind: 'unit', unitId: next.id, phase: 'start' });

  if (route.length > 0 && route.every((u) => isDone(p, u.id))) {
    const bp = blueprintFor(course, goal);
    const last = latestMock(p, goal);
    if (bp && !last) {
      steps.push({ kind: 'mock', grade: goal, reason: 'first' });
    } else if (bp && last) {
      if (mockPercent(last) >= bp.safeLine) {
        steps.push({ kind: 'ready', grade: goal });
      } else {
        const weak = missedUnits(course, last);
        if (weak.length) steps.push({ kind: 'weak', grade: goal, unitIds: weak });
        steps.push({ kind: 'mock', grade: goal, reason: 'retry' });
      }
    }
  }

  if (steps.length === 0) steps.push({ kind: 'rest' });
  return steps;
}

/* ---------- ペース ---------- */

export interface Pace {
  /** 残りの学習時間の目安（分）。単元の目安時間 ＋ 模試 */
  remainingMinutes: number;
  /** 今のペースで終えるのに必要な日数 */
  daysNeeded: number;
  finishOn: DateStr;
  /** 受験予定日までの日数（予定日があるとき） */
  daysLeft?: number;
  /** 予定日に間に合わせるのに必要な 1 日あたりの分数（間に合っていれば undefined） */
  requiredPerDay?: number;
}

export function computePace(course: Course, p: Progress, today: DateStr): Pace {
  const goal = p.settings.goal;
  const route = routeUnits(course, goal);
  let remaining = route.filter((u) => !isDone(p, u.id)).reduce((n, u) => n + u.minutes, 0);
  const bp = blueprintFor(course, goal);
  if (bp && !latestMock(p, goal)) remaining += bp.minutes;
  const perDay = Math.max(5, p.settings.minutesPerDay);
  const daysNeeded = Math.ceil(remaining / perDay);
  const pace: Pace = { remainingMinutes: remaining, daysNeeded, finishOn: addDays(today, daysNeeded) };
  if (p.settings.examDate) {
    const daysLeft = diffDays(today, p.settings.examDate);
    pace.daysLeft = daysLeft;
    if (daysLeft > 0 && daysNeeded > daysLeft) pace.requiredPerDay = Math.ceil(remaining / daysLeft);
  }
  return pace;
}

/* ---------- 進み具合のまとめ ---------- */

export interface UnitSummary {
  unit: Unit;
  seen: number;
  /** 直近の解答が正解だった問題の割合（見た問題のうち） */
  accuracy: number | null;
  weak: boolean;
}

export function unitSummary(course: Course, p: Progress, unit: Unit): UnitSummary {
  const qs = course.content.get(unit.id)?.questions ?? [];
  const seen = qs.filter((q) => (p.questions[q.id]?.seen ?? 0) > 0);
  const right = seen.filter((q) => p.questions[q.id]?.lastCorrect === true).length;
  const accuracy = seen.length ? right / seen.length : null;
  return { unit, seen: seen.length, accuracy, weak: seen.length >= 3 && accuracy !== null && accuracy < RULES.weakAccuracy };
}

export interface Readiness {
  goal: Grade;
  total: number;
  done: number;
  mastered: number;
  lastMock?: MockResult;
  lastMockPercent?: number;
  /** 直近の模試のうち初見だった問題の正答率 */
  lastMockUnseenPercent?: number;
  weakUnits: UnitSummary[];
  /** 復習待ちの問題数（期限に関係なく） */
  pendingReviews: number;
  /** 「受験の目安」に届いているか: 全単元に合格し、直近の模試が安全圏以上 */
  ready: boolean;
}

export function computeReadiness(course: Course, p: Progress): Readiness {
  const goal = p.settings.goal;
  const route = routeUnits(course, goal);
  const done = route.filter((u) => isDone(p, u.id)).length;
  const mastered = route.filter((u) => unitProgress(p, u.id).status === 'mastered').length;
  const lastMock = latestMock(p, goal);
  const bp = blueprintFor(course, goal);
  const lastMockPercent = lastMock ? mockPercent(lastMock) : undefined;
  return {
    goal,
    total: route.length,
    done,
    mastered,
    lastMock,
    lastMockPercent,
    lastMockUnseenPercent: lastMock && lastMock.unseen > 0 ? Math.round((lastMock.unseenCorrect / lastMock.unseen) * 100) : undefined,
    weakUnits: route.map((u) => unitSummary(course, p, u)).filter((s) => s.weak),
    pendingReviews: Object.values(p.questions).filter((s) => s.review).length,
    ready: route.length > 0 && done === route.length && !!bp && lastMockPercent !== undefined && lastMockPercent >= bp.safeLine,
  };
}

/** まだ合格していない前提単元（単元ページで「先にこちら」を案内する） */
export function missingPrerequisites(course: Course, p: Progress, unit: Unit): Unit[] {
  return unit.prerequisites
    .map((id) => course.units.get(id))
    .filter((u): u is Unit => !!u && !isDone(p, u.id));
}

/** まだ確認していない補習単元 */
export function pendingRefreshers(course: Course, p: Progress, unit: Unit): Unit[] {
  return (unit.refreshers ?? [])
    .map((id) => course.units.get(id))
    .filter((u): u is Unit => !!u && course.content.has(u.id) && !isDone(p, u.id));
}
