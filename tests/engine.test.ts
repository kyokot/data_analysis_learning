import { describe, expect, it } from 'vitest';
import { addDays, diffDays } from '../src/engine/dates.ts';
import { emptyProgress, RULES, routeUnits, unitProgress, type Course, type Progress } from '../src/engine/model.ts';
import { computePace, computeReadiness, planToday, pendingRefreshers } from '../src/engine/planner.ts';
import {
  completeCheck,
  completeConfirm,
  finishMock,
  recordAnswer,
  startMock,
  answerMock,
  updateSettings,
  type Answer,
} from '../src/engine/progress.ts';
import { seededRng } from '../src/engine/rng.ts';
import { buildMock, buildReview, pickCheckQuestions, pickConfirmQuestions, pickDrillQuestions, reviewQuestionCount } from '../src/engine/select.ts';
import { exportBackup, importBackup, sanitizeProgress } from '../src/store/storage.ts';
import { fixtureCourse } from './fixture.ts';
import { completeMaintenance } from '../src/engine/progress.ts';
import { isVariant, lookup, statKey } from '../src/engine/model.ts';
import { makeQuestion } from '../src/generators/types.ts';

const D0 = '2026-11-26';
const rng = () => seededRng(42);

function start(goal: 4 | 3 = 3): Progress {
  return updateSettings(emptyProgress(D0), { onboarded: true, goal, minutesPerDay: 30 });
}

/** 単元の確認テストを受ける。wrong 問だけ間違える */
function takeCheck(course: Course, p: Progress, unitId: string, today: string, wrong = 0) {
  const qs = pickCheckQuestions(course, p, unitId, rng());
  const answers: Answer[] = qs.map((q, i) => ({ questionId: q.id, choice: i < wrong ? (q.answer + 1) % 4 : q.answer }));
  return { ...completeCheck(course, p, unitId, answers, today), questionIds: qs.map((q) => q.id) };
}

function passAll(course: Course, p: Progress, unitIds: string[], today: string): Progress {
  return unitIds.reduce((acc, id) => takeCheck(course, acc, id, today).progress, p);
}

describe('dates', () => {
  it('月末・年末をまたいで日付を進める', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-11-26', '2026-12-03')).toBe(7);
  });
});

describe('確認テストの出題', () => {
  const course = fixtureCourse();
  it('practice から 5 問、基礎と標準以上を混ぜて出す', () => {
    const qs = pickCheckQuestions(course, start(), 'a1', rng());
    expect(qs).toHaveLength(RULES.checkSize);
    expect(qs.every((q) => q.pool === 'practice')).toBe(true);
    expect(qs.some((q) => q.difficulty === 1)).toBe(true);
    expect(qs.filter((q) => q.difficulty >= 2).length).toBeGreaterThanOrEqual(2);
    expect(new Set(qs.map((q) => q.id)).size).toBe(RULES.checkSize);
  });
  it('受け直しでは、直前に出なかった問題を優先する', () => {
    const first = takeCheck(course, start(), 'a1', D0, 3);
    expect(first.passed).toBe(false);
    const second = pickCheckQuestions(course, first.progress, 'a1', rng()).map((q) => q.id);
    const fresh = second.filter((id) => !first.questionIds.includes(id));
    expect(fresh).toHaveLength(3); // practice 8 問のうち、まだ出ていない 3 問がすべて入る
  });
  it('定着チェックは、確認テストに出なかった 3 問を出す', () => {
    const first = takeCheck(course, start(), 'a1', D0);
    const confirm = pickConfirmQuestions(course, first.progress, 'a1', rng()).map((q) => q.id);
    expect(confirm).toHaveLength(RULES.confirmSize);
    expect(confirm.some((id) => first.questionIds.includes(id))).toBe(false);
  });
});

describe('習得の判定', () => {
  const course = fixtureCourse();
  it('4 問以上の正解で合格、定着チェックは翌日以降', () => {
    const r = takeCheck(course, start(), 'a1', D0, 1);
    expect(r.passed).toBe(true);
    const u = unitProgress(r.progress, 'a1');
    expect(u.status).toBe('passed');
    expect(u.confirmDue).toBe(addDays(D0, 1));
    expect(reviewQuestionCount(buildReview(course, r.progress, D0, rng()))).toBe(0);
    // 間違えた 1 問は復習に回るが、定着チェックに含まれる場合は重複して出さない
    const tomorrow = buildReview(course, r.progress, addDays(D0, 1), rng());
    expect(tomorrow.confirms.map((c) => c.unitId)).toEqual(['a1']);
    const ids = [...tomorrow.confirms.flatMap((c) => c.questions.map((q) => q.id)), ...tomorrow.retries.map((x) => x.question.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('3 問以下の正解では合格にならず、学習中のまま', () => {
    const r = takeCheck(course, start(), 'a1', D0, 2);
    expect(r.passed).toBe(false);
    expect(unitProgress(r.progress, 'a1').status).toBe('learning');
    expect(unitProgress(r.progress, 'a1').attempts).toBe(1);
  });
  it('定着チェックに合格すると mastered、落ちると学習中に戻る', () => {
    const passed = takeCheck(course, start(), 'a1', D0).progress;
    const day1 = addDays(D0, 1);
    const qs = pickConfirmQuestions(course, passed, 'a1', rng());
    const ok = completeConfirm(course, passed, 'a1', qs.map((q) => ({ questionId: q.id, choice: q.answer })), day1);
    expect(unitProgress(ok.progress, 'a1').status).toBe('mastered');
    const ng = completeConfirm(course, passed, 'a1', qs.map((q) => ({ questionId: q.id, choice: null })), day1);
    expect(ng.passed).toBe(false);
    expect(unitProgress(ng.progress, 'a1').status).toBe('learning');
    expect(unitProgress(ng.progress, 'a1').confirmDue).toBeUndefined();
  });
  it('補習単元は確認テストだけで完了する', () => {
    const r = takeCheck(course, start(), 'm1', D0);
    expect(unitProgress(r.progress, 'm1').status).toBe('mastered');
    expect(buildReview(course, r.progress, addDays(D0, 1), rng()).confirms).toHaveLength(0);
  });
  it('合格済みの単元を受け直して落ちても、状態は下がらない', () => {
    const passed = takeCheck(course, start(), 'a1', D0).progress;
    const again = takeCheck(course, passed, 'a1', D0, 5);
    expect(again.passed).toBe(false);
    expect(unitProgress(again.progress, 'a1').status).toBe('passed');
  });
});

describe('間違えた問題の復習', () => {
  const course = fixtureCourse();
  it('1 → 3 → 7 日の間隔で出し直し、最後まで正解すると外れる', () => {
    const q = course.content.get('a1')!.questions[0]!;
    let p = recordAnswer(course, start(), { questionId: q.id, choice: null }, 'check', D0);
    expect(p.questions[q.id]!.review).toEqual({ stage: 0, due: addDays(D0, 1) });
    let day = addDays(D0, 1);
    expect(buildReview(course, p, day, rng()).retries.map((r) => r.question.id)).toEqual([q.id]);
    p = recordAnswer(course, p, { questionId: q.id, choice: q.answer }, 'review', day);
    expect(p.questions[q.id]!.review).toEqual({ stage: 1, due: addDays(day, 3) });
    day = addDays(day, 3);
    p = recordAnswer(course, p, { questionId: q.id, choice: q.answer }, 'review', day);
    expect(p.questions[q.id]!.review).toEqual({ stage: 2, due: addDays(day, 7) });
    day = addDays(day, 7);
    p = recordAnswer(course, p, { questionId: q.id, choice: q.answer }, 'review', day);
    expect(p.questions[q.id]!.review).toBeUndefined();
  });
  it('復習で間違えると最初の間隔に戻る', () => {
    const q = course.content.get('a1')!.questions[0]!;
    let p = recordAnswer(course, start(), { questionId: q.id, choice: null }, 'check', D0);
    p = recordAnswer(course, p, { questionId: q.id, choice: q.answer }, 'review', addDays(D0, 1));
    p = recordAnswer(course, p, { questionId: q.id, choice: (q.answer + 1) % 4 }, 'review', addDays(D0, 4));
    expect(p.questions[q.id]!.review).toEqual({ stage: 0, due: addDays(D0, 5) });
  });
  it('1 回の復習は上限までにとどめ、残りは持ち越す', () => {
    let p = start();
    for (const id of ['a1', 'a2', 'b1', 'b2']) {
      for (const q of course.content.get(id)!.questions.slice(0, 6)) {
        p = recordAnswer(course, p, { questionId: q.id, choice: null }, 'drill', D0);
      }
    }
    const plan = buildReview(course, p, addDays(D0, 1), rng());
    expect(reviewQuestionCount(plan)).toBe(RULES.reviewCap);
    expect(plan.deferred).toBe(24 - RULES.reviewCap);
  });
});

describe('模試', () => {
  const course = fixtureCourse();
  it('分野ごとの配分どおりに、模試専用の初見問題から組む', () => {
    const bp = course.curriculum.mocks.find((m) => m.grade === 4)!;
    const paper = buildMock(course, start(4), bp, rng());
    expect(paper.questionIds).toHaveLength(6);
    expect(new Set(paper.questionIds).size).toBe(6);
    const qs = paper.questionIds.map((id) => course.questions.get(id)!);
    expect(qs.every((e) => e.question.pool === 'exam' && e.question.grade === 4)).toBe(true);
    expect(qs.filter((e) => e.unitId === 'a1')).toHaveLength(3);
    expect(paper.unseenIds).toHaveLength(6);
  });
  it('3級の模試は 3級の単元を中心に、4級の範囲も含める', () => {
    const bp = course.curriculum.mocks.find((m) => m.grade === 3)!;
    const paper = buildMock(course, start(3), bp, rng());
    expect(paper.questionIds).toHaveLength(8);
    const byUnit = (u: string) => paper.questionIds.filter((id) => course.questions.get(id)!.unitId === u).length;
    expect(byUnit('b1')).toBeGreaterThanOrEqual(3); // summary 4 問のうち 3 分の 2 以上
    expect(byUnit('a1') + byUnit('b1')).toBe(4);
    expect(byUnit('a2')).toBe(2);
    expect(byUnit('b2')).toBe(2);
  });
  it('2 回目は、まだ出ていない模試専用問題を優先し、初見の数を正しく数える', () => {
    const bp = course.curriculum.mocks.find((m) => m.grade === 4)!;
    let p = start(4);
    const first = buildMock(course, p, bp, rng());
    p = startMock(p, 4, first, bp.minutes, 1000);
    first.questionIds.forEach((id, i) => {
      p = answerMock(p, i, course.questions.get(id)!.question.answer);
    });
    const done = finishMock(course, p, 1000 + 60_000, D0);
    expect(done.result).toMatchObject({ correct: 6, unseen: 6, unseenCorrect: 6, seconds: 60 });
    expect(done.progress.activeMock).toBeUndefined();
    const second = buildMock(course, done.progress, bp, rng());
    // exam は各単元 5 問。1 回目に 3 問ずつ使ったので、初見は 2 問ずつ = 4 問
    expect(second.unseenIds).toHaveLength(4);
    expect(second.questionIds.filter((id) => course.questions.get(id)!.question.pool === 'exam')).toHaveLength(6);
  });
  it('未回答は不正解として採点し、復習に回す', () => {
    const bp = course.curriculum.mocks.find((m) => m.grade === 4)!;
    let p = start(4);
    const paper = buildMock(course, p, bp, rng());
    p = startMock(p, 4, paper, bp.minutes, 0);
    const done = finishMock(course, p, 5_000_000, D0);
    expect(done.result!.correct).toBe(0);
    expect(done.result!.seconds).toBe(bp.minutes * 60); // 制限時間を超えては数えない
    expect(Object.values(done.progress.questions).filter((s) => s.review).length).toBe(6);
  });
});

describe('今日の一歩', () => {
  const course = fixtureCourse();
  it('最初は、ルートの先頭の単元から始める', () => {
    expect(planToday(course, start(3), D0, rng())[0]).toEqual({ kind: 'unit', unitId: 'a1', phase: 'start' });
  });
  it('目標が 4級なら、ルートは 4級の単元だけ', () => {
    expect(routeUnits(course, 4).map((u) => u.id)).toEqual(['a1', 'a2']);
    expect(routeUnits(course, 3).map((u) => u.id)).toEqual(['a1', 'a2', 'b1', 'b2']);
  });
  it('学習中の単元があれば、その続きを先に出す', () => {
    const p = takeCheck(course, start(3), 'a1', D0, 3).progress;
    expect(planToday(course, p, D0, rng())[0]).toEqual({ kind: 'unit', unitId: 'a1', phase: 'continue' });
  });
  it('復習があれば最優先、そのあとに次の単元', () => {
    const p = takeCheck(course, start(3), 'a1', D0).progress;
    const steps = planToday(course, p, addDays(D0, 1), rng());
    expect(steps.map((s) => s.kind)).toEqual(['review', 'unit']);
    expect(steps[1]).toMatchObject({ unitId: 'a2', phase: 'start' });
  });
  it('3級が目標でも、4級の範囲を終えたら 4級の模試を腕試しとして勧める', () => {
    const p = passAll(course, start(3), ['a1', 'a2'], D0);
    const steps = planToday(course, p, D0, rng());
    expect(steps[0]).toEqual({ kind: 'mock', grade: 4, reason: 'milestone' });
    expect(steps[1]).toMatchObject({ kind: 'unit', unitId: 'b1' });
  });
  it('全単元に合格したら模試、安全圏に届かなければ弱点の補強、届けば受験の目安', () => {
    let p = passAll(course, start(4), ['a1', 'a2'], D0);
    expect(planToday(course, p, D0, rng())[0]).toEqual({ kind: 'mock', grade: 4, reason: 'first' });
    const bp = course.curriculum.mocks.find((m) => m.grade === 4)!;
    const paper = buildMock(course, p, bp, rng());
    const low = finishMock(course, startMock(p, 4, paper, bp.minutes, 0), 1000, D0).progress;
    const steps = planToday(course, low, D0, rng());
    expect(steps.map((s) => s.kind)).toEqual(['weak', 'mock']);
    expect(steps[0]).toMatchObject({ unitIds: ['a1', 'a2'] });
    expect(computeReadiness(course, low).ready).toBe(false);

    p = startMock(p, 4, paper, bp.minutes, 0);
    paper.questionIds.forEach((id, i) => {
      p = answerMock(p, i, course.questions.get(id)!.question.answer);
    });
    const high = finishMock(course, p, 1000, D0).progress;
    expect(planToday(course, high, D0, rng())[0]).toEqual({ kind: 'ready', grade: 4 });
    const r = computeReadiness(course, high);
    expect(r).toMatchObject({ ready: true, done: 2, total: 2, lastMockPercent: 100, lastMockUnseenPercent: 100 });
  });
  it('補習単元は、まだ確認していないものだけを案内する', () => {
    const unit = course.units.get('a1')!;
    expect(pendingRefreshers(course, start(), unit).map((u) => u.id)).toEqual(['m1']);
    const p = takeCheck(course, start(), 'm1', D0).progress;
    expect(pendingRefreshers(course, p, unit)).toHaveLength(0);
  });
});

describe('ペース', () => {
  const course = fixtureCourse();
  it('残りの目安時間と、受験日に間に合わせるための 1 日あたりの時間を出す', () => {
    const p = updateSettings(start(3), { examDate: addDays(D0, 4) });
    const pace = computePace(course, p, D0);
    expect(pace.remainingMinutes).toBe(30 + 30 + 40 + 40 + 16);
    expect(pace.daysNeeded).toBe(Math.ceil(156 / 30));
    expect(pace.daysLeft).toBe(4);
    expect(pace.requiredPerDay).toBe(39);
  });
  it('受験日を消せる', () => {
    const p = updateSettings(updateSettings(start(3), { examDate: addDays(D0, 4) }), { examDate: undefined });
    expect(p.settings.examDate).toBeUndefined();
    expect(computePace(course, p, D0).daysLeft).toBeUndefined();
  });
});

describe('バックアップ', () => {
  const course = fixtureCourse();
  it('書き出した内容を読み込むと、同じ進み具合に戻る', () => {
    const p = takeCheck(course, start(3), 'a1', D0, 1).progress;
    const restored = importBackup(exportBackup(p));
    expect(restored).toEqual(p);
  });
  it('壊れたデータは受け付けない・一部が壊れていても落ちない', () => {
    expect(importBackup('こんにちは')).toBeNull();
    expect(importBackup('{"version":2}')).toBeNull();
    const p = sanitizeProgress({ version: 1, settings: { goal: 9 }, units: { a1: { status: 'bogus' }, a2: { status: 'passed' } }, mocks: [{}], questions: { x: 1 } });
    expect(p).not.toBeNull();
    expect(p!.settings.goal).toBe(3);
    expect(Object.keys(p!.units)).toEqual(['a2']);
    expect(p!.units.a2!.confirmDue).toBeDefined();
    expect(p!.mocks).toHaveLength(0);
  });
});

describe('類題', () => {
  const course = fixtureCourse({ withGenerators: true });
  const fixedQ = course.content.get('a1')!.questions[2]!; // a1-q03（類題で置き換えられる）
  it('問題番号から類題を再現でき、記録はジェネレーター単位にまとめる', () => {
    const q = makeQuestion(course.generators.get('a1-add')!, 123);
    expect(lookup(course, q.id)?.question).toEqual(q);
    expect(lookup(course, q.id)?.unitId).toBe('a1');
    expect(statKey(q.id)).toBe('gen:a1-add');
    const p = recordAnswer(course, start(), { questionId: q.id, choice: (q.answer + 1) % 4 }, 'drill', D0);
    expect(p.questions['gen:a1-add']).toMatchObject({ seen: 1, correct: 0, review: { stage: 0 } });
    expect(Object.keys(p.questions).some((k) => k.includes('~'))).toBe(false);
  });
  it('置き換え先のある問題を間違えると、出し直しは同じ技能の類題になり、正解でもとの問題の復習が進む', () => {
    let p = recordAnswer(course, start(), { questionId: fixedQ.id, choice: null }, 'check', D0);
    const day1 = addDays(D0, 1);
    const plan = buildReview(course, p, day1, rng());
    expect(plan.retries).toHaveLength(1);
    const item = plan.retries[0]!;
    expect(isVariant(item.question.id)).toBe(true);
    expect(item.reviewKey).toBe(fixedQ.id);
    p = recordAnswer(course, p, { questionId: item.question.id, choice: item.question.answer }, 'review', day1, item.reviewKey);
    expect(p.questions[fixedQ.id]!.review).toEqual({ stage: 1, due: addDays(day1, 3) });
  });
  it('類題を間違えると、ジェネレーター単位で出し直しに入り、次は別の数値の類題が出る', () => {
    const q = makeQuestion(course.generators.get('a1-add')!, 7);
    const p = recordAnswer(course, start(), { questionId: q.id, choice: null }, 'drill', D0);
    const plan = buildReview(course, p, addDays(D0, 1), seededRng(9));
    expect(plan.retries).toHaveLength(1);
    expect(plan.retries[0]!.reviewKey).toBe('gen:a1-add');
    expect(plan.retries[0]!.question.id).not.toBe(q.id);
  });
  it('補強ドリルには類題が混ざる', () => {
    const qs = pickDrillQuestions(course, start(), ['a1'], 10, rng());
    expect(qs).toHaveLength(10);
    expect(qs.filter((q) => isVariant(q.id)).length).toBeGreaterThanOrEqual(5);
    expect(qs.every((q) => q.pool === 'practice')).toBe(true);
  });
});

describe('定着後のおさらい', () => {
  const course = fixtureCourse({ withGenerators: true });
  function mastered(): Progress {
    const passed = takeCheck(course, start(), 'a1', D0).progress;
    const qs = pickConfirmQuestions(course, passed, 'a1', rng());
    return completeConfirm(course, passed, 'a1', qs.map((q) => ({ questionId: q.id, choice: q.answer })), addDays(D0, 1)).progress;
  }
  it('定着すると14日後におさらいが入り、全問正解で次は30日後', () => {
    const p = mastered();
    const day1 = addDays(D0, 1);
    expect(unitProgress(p, 'a1').maintain).toEqual({ stage: 0, due: addDays(day1, 14) });
    expect(buildReview(course, p, addDays(day1, 13), rng()).maintenance).toHaveLength(0);
    const due = addDays(day1, 14);
    const plan = buildReview(course, p, due, rng());
    expect(plan.maintenance).toHaveLength(1);
    const items = plan.maintenance[0]!.items;
    expect(items).toHaveLength(RULES.maintainSize);
    const ok = completeMaintenance(course, p, 'a1', items.map((it) => ({ questionId: it.question.id, choice: it.question.answer, reviewKey: it.reviewKey })), due);
    expect(ok.passed).toBe(true);
    expect(unitProgress(ok.progress, 'a1').maintain).toEqual({ stage: 1, due: addDays(due, 30) });
    expect(unitProgress(ok.progress, 'a1').status).toBe('mastered');
  });
  it('間違えると14日に戻し、間違えた問題は出し直しにも入る（定着の状態は下げない）', () => {
    const p = mastered();
    const due = addDays(D0, 15);
    const items = buildReview(course, p, due, rng()).maintenance[0]!.items;
    const ng = completeMaintenance(course, p, 'a1', items.map((it, i) => ({ questionId: it.question.id, choice: i === 0 ? null : it.question.answer, reviewKey: it.reviewKey })), due);
    expect(ng.passed).toBe(false);
    expect(unitProgress(ng.progress, 'a1')).toMatchObject({ status: 'mastered', maintain: { stage: 0, due: addDays(due, 14) } });
    expect(buildReview(course, ng.progress, addDays(due, 1), rng()).retries).toHaveLength(1);
  });
  it('おさらいが入る前に定着した単元にも、読み込み時に予定を付ける', () => {
    const p = mastered();
    const { maintain: _m, ...rest } = p.units.a1!;
    const old = { ...p, units: { ...p.units, a1: rest } };
    const restored = sanitizeProgress(JSON.parse(JSON.stringify(old)));
    expect(restored!.units.a1!.maintain).toEqual({ stage: 0, due: addDays(p.units.a1!.masteredOn!, 14) });
  });
});
