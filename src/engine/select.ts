/**
 * 出題する問題の選び方。どれも「まだ見ていない問題を優先」し、乱数は同順位の並べ替えにだけ使う。
 */
import type { Grade, MockBlueprint, Question } from '../content/types.ts';
import { GEN_PREFIX, makeQuestion, randomSeed, type QuestionGenerator } from '../generators/types.ts';
import { RULES, isSupportUnit, type Course, type Progress } from './model.ts';
import type { DateStr } from './dates.ts';
import { shuffle, type Rng } from './rng.ts';

function seenCount(p: Progress, id: string): number {
  return p.questions[id]?.seen ?? 0;
}

/** 見た回数が少ない順 → 最後に見た日が古い順 → ランダム */
function freshnessOrder(p: Progress, questions: Question[], rng: Rng): Question[] {
  return shuffle(questions, rng).sort((a, b) => {
    const s = seenCount(p, a.id) - seenCount(p, b.id);
    if (s !== 0) return s;
    return (p.questions[a.id]?.lastDate ?? '').localeCompare(p.questions[b.id]?.lastDate ?? '');
  });
}

/**
 * 確認テストの問題（practice から checkSize 問）。
 * 直前の確認テストで出た問題は後回しにし、基礎（difficulty 1）と標準以上を必ず混ぜる。
 */
export function pickCheckQuestions(course: Course, p: Progress, unitId: string, rng: Rng): Question[] {
  const content = course.content.get(unitId);
  if (!content) return [];
  const practice = content.questions.filter((q) => q.pool === 'practice');
  const last = new Set(p.units[unitId]?.lastCheck?.questionIds ?? []);
  const ordered = [
    ...freshnessOrder(p, practice.filter((q) => !last.has(q.id)), rng),
    ...freshnessOrder(p, practice.filter((q) => last.has(q.id)), rng),
  ];
  const size = Math.min(RULES.checkSize, ordered.length);
  const picked: Question[] = [];
  const take = (pred: (q: Question) => boolean, n: number) => {
    for (const q of ordered) {
      if (n <= 0 || picked.length >= size) break;
      if (!picked.includes(q) && pred(q)) {
        picked.push(q);
        n--;
      }
    }
  };
  take((q) => q.difficulty === 1, 1);
  take((q) => q.difficulty >= 2, 2);
  take(() => true, size);
  // 易しい順に並べて出す
  return picked.sort((a, b) => a.difficulty - b.difficulty);
}

/** 定着チェックの問題（確認テストで出なかった practice を優先して confirmSize 問） */
export function pickConfirmQuestions(course: Course, p: Progress, unitId: string, rng: Rng): Question[] {
  const content = course.content.get(unitId);
  if (!content) return [];
  const practice = content.questions.filter((q) => q.pool === 'practice');
  const last = new Set(p.units[unitId]?.lastCheck?.questionIds ?? []);
  const ordered = [
    ...freshnessOrder(p, practice.filter((q) => !last.has(q.id)), rng),
    ...freshnessOrder(p, practice.filter((q) => last.has(q.id)), rng),
  ];
  return ordered.slice(0, RULES.confirmSize);
}

/** 復習で出す 1 問。reviewKey は、この解答で復習の段階を進めるキー（固定の問題の代わりに類題を出したとき） */
export interface ReviewItem {
  unitId: string;
  question: Question;
  reviewKey?: string;
}

export interface ReviewPlan {
  /** 定着チェックを行う単元と、その問題 */
  confirms: { unitId: string; questions: Question[] }[];
  /** 定着した単元のおさらい */
  maintenance: { unitId: string; items: ReviewItem[] }[];
  /** 間違えた問題の出し直し（類題があれば類題） */
  retries: ReviewItem[];
  /** 上限のため今日は出さずに持ち越す数 */
  deferred: number;
}

export function reviewQuestionCount(plan: ReviewPlan): number {
  return (
    plan.confirms.reduce((n, c) => n + c.questions.length, 0) +
    plan.maintenance.reduce((n, m) => n + m.items.length, 0) +
    plan.retries.length
  );
}

/** ジェネレーターから新しい類題を 1 問作る */
function freshVariant(gen: QuestionGenerator, rng: Rng): Question {
  return makeQuestion(gen, randomSeed(rng));
}

/** 復習の対象キー（固定の問題 id か gen:<ジェネレーターid>）から、出す問題を決める */
function itemForKey(course: Course, key: string, rng: Rng): ReviewItem | null {
  if (key.startsWith(GEN_PREFIX)) {
    const gen = course.generators.get(key.slice(GEN_PREFIX.length));
    return gen ? { unitId: gen.unitId, question: freshVariant(gen, rng), reviewKey: key } : null;
  }
  const entry = course.questions.get(key);
  if (!entry) return null;
  const gens = course.replacedBy.get(key);
  if (gens && gens.length > 0) {
    // 同じ問題をもう一度出すと答えを覚えてしまうので、同じ技能の類題（数値違い）を出す
    const gen = gens[Math.floor(rng() * gens.length)]!;
    return { unitId: entry.unitId, question: freshVariant(gen, rng), reviewKey: key };
  }
  return { unitId: entry.unitId, question: entry.question };
}

/** おさらいの問題: 類題があれば別々のジェネレーターから、なければ練習用の問題を見ていない順に */
function pickMaintenanceItems(course: Course, p: Progress, unitId: string, rng: Rng): ReviewItem[] {
  const gens = shuffle(course.generatorsByUnit.get(unitId) ?? [], rng);
  const items: ReviewItem[] = gens.slice(0, RULES.maintainSize).map((g) => ({ unitId, question: freshVariant(g, rng) }));
  if (items.length < RULES.maintainSize) {
    const practice = (course.content.get(unitId)?.questions ?? []).filter((q) => q.pool === 'practice');
    for (const q of freshnessOrder(p, practice, rng)) {
      if (items.length >= RULES.maintainSize) break;
      items.push({ unitId, question: q });
    }
  }
  return items;
}

/**
 * 今日の復習（定着チェック → おさらい → 間違えた問題の出し直し）。上限を超える分は持ち越す。
 */
export function buildReview(course: Course, p: Progress, today: DateStr, rng: Rng): ReviewPlan {
  const dueConfirms = course.curriculum.units.filter((u) => {
    const up = p.units[u.id];
    return up?.status === 'passed' && up.confirmDue !== undefined && up.confirmDue <= today;
  });
  const confirms = dueConfirms.slice(0, RULES.confirmUnitsCap).map((u) => ({
    unitId: u.id,
    questions: pickConfirmQuestions(course, p, u.id, rng),
  }));
  const inConfirm = new Set(confirms.flatMap((c) => c.questions.map((q) => q.id)));

  const dueMaintain = course.curriculum.units
    .filter((u) => {
      const up = p.units[u.id];
      return up?.status === 'mastered' && up.maintain !== undefined && up.maintain.due <= today && course.content.has(u.id);
    })
    .sort((a, b) => p.units[a.id]!.maintain!.due.localeCompare(p.units[b.id]!.maintain!.due));
  const maintenance = dueMaintain
    .slice(0, RULES.maintainUnitsCap)
    .map((u) => ({ unitId: u.id, items: pickMaintenanceItems(course, p, u.id, rng).filter((it) => !inConfirm.has(it.question.id)) }))
    .filter((m) => m.items.length > 0);
  const used = inConfirm.size + maintenance.reduce((n, m) => n + m.items.length, 0);

  const due = Object.entries(p.questions)
    .filter(([key, s]) => s.review && s.review.due <= today && !inConfirm.has(key))
    .sort((a, b) => a[1].review!.due.localeCompare(b[1].review!.due) || a[0].localeCompare(b[0]));
  const room = Math.max(0, RULES.reviewCap - used);
  const retries: ReviewItem[] = [];
  let skipped = 0;
  for (const [key] of due) {
    if (retries.length >= room) break;
    const item = itemForKey(course, key, rng);
    if (item) retries.push(item);
    else skipped++;
  }
  return {
    confirms,
    maintenance,
    retries,
    deferred: Math.max(0, due.length - skipped - retries.length) + (dueConfirms.length - confirms.length) + (dueMaintain.length - maintenance.length),
  };
}

/* ---------- 模試 ---------- */

export interface MockPaper {
  questionIds: string[];
  /** 受験時点で初見の問題 */
  unseenIds: string[];
}

/**
 * 模試の問題を組む。分野ごとの出題数は blueprint に従い、
 *  1. 模試専用（exam）で、まだ見ていない問題
 *  2. 模試専用で、見たことがある問題
 *  3. 足りなければ practice
 * の順に埋める。1 つの単元に偏らないよう、単元をまたいで順番に取る。
 * 3級の模試では、各分野の出題の 3 分の 2 以上を 3級の単元から取る（3級の単元がある分野のみ）。
 */
export function buildMock(course: Course, p: Progress, blueprint: MockBlueprint, rng: Rng): MockPaper {
  const grade: Grade = blueprint.grade;
  const unitOrder = new Map(course.curriculum.units.map((u, i) => [u.id, i]));
  const chosen: { q: Question; unitId: string }[] = [];

  for (const [domain, need] of Object.entries(blueprint.domains)) {
    if (!need) continue;
    const units = course.curriculum.units.filter((u) => u.domain === domain && u.grade >= grade && !isSupportUnit(course, u));
    const rank = (q: Question) => (q.pool === 'exam' ? (seenCount(p, q.id) === 0 ? 0 : 1) : 2 + Math.min(seenCount(p, q.id), 1));
    // 単元ごとに、優先度順の待ち行列を作る
    const queues = units.map((u) => ({
      unit: u,
      queue: shuffle(
        (course.content.get(u.id)?.questions ?? []).filter((q) => q.grade >= grade),
        rng,
      ).sort((a, b) => rank(a) - rank(b)),
    }));
    const picked: { q: Question; unitId: string }[] = [];
    const drawRound = (pool: typeof queues, limit: number) => {
      // 優先度の高い問題から、単元を一巡ずつ回して取る
      for (let r = 0; r <= 3 && picked.length < limit; r++) {
        let progressed = true;
        while (progressed && picked.length < limit) {
          progressed = false;
          for (const entry of shuffle(pool, rng)) {
            if (picked.length >= limit) break;
            const head = entry.queue[0];
            if (head && rank(head) <= r) {
              entry.queue.shift();
              picked.push({ q: head, unitId: entry.unit.id });
              progressed = true;
            }
          }
        }
      }
    };
    const upper = queues.filter((e) => e.unit.grade === 3);
    if (grade === 3 && upper.length > 0 && upper.length < queues.length) {
      drawRound(upper, Math.ceil((need * 2) / 3));
    }
    drawRound(queues, need);
    chosen.push(...picked);
  }

  chosen.sort((a, b) => unitOrder.get(a.unitId)! - unitOrder.get(b.unitId)! || a.q.id.localeCompare(b.q.id));
  const questionIds = chosen.map((c) => c.q.id);
  return { questionIds, unseenIds: questionIds.filter((id) => seenCount(p, id) === 0) };
}

/**
 * 補強・練習用のドリル: 指定した単元から n 問。
 * 類題のある単元は 6 割を類題（毎回新しい数値）にし、残りを練習用の固定問題から
 * 「直近で間違えた → 見ていない → 正答率の低い」順に出す。
 */
export function pickDrillQuestions(course: Course, p: Progress, unitIds: string[], n: number, rng: Rng): Question[] {
  const pool = unitIds.flatMap((id) => (course.content.get(id)?.questions ?? []).filter((q) => q.pool === 'practice'));
  const score = (q: Question) => {
    const s = p.questions[q.id];
    if (!s || s.seen === 0) return 0.5;
    return s.lastCorrect === false ? 0 : 1 + s.correct / s.seen;
  };
  const fixedOrdered = shuffle(pool, rng).sort((a, b) => score(a) - score(b));
  const gens = unitIds.flatMap((id) => course.generatorsByUnit.get(id) ?? []);
  const wantVariants = gens.length ? Math.max(1, Math.min(n, Math.ceil(n * 0.6), n - Math.min(fixedOrdered.length, n - Math.ceil(n * 0.6)))) : 0;
  const variants: Question[] = [];
  const order = shuffle(gens, rng);
  for (let i = 0; variants.length < wantVariants && order.length > 0; i++) variants.push(freshVariant(order[i % order.length]!, rng));
  const fixedPart = fixedOrdered.slice(0, n - variants.length);
  // 足りなければ類題で埋める
  for (let i = 0; fixedPart.length + variants.length < n && order.length > 0; i++) variants.push(freshVariant(order[i % order.length]!, rng));
  // 固定と類題を交互に近い形で混ぜる
  const out: Question[] = [];
  const a = [...fixedPart];
  const b = [...variants];
  while (a.length || b.length) {
    if (a.length) out.push(a.shift()!);
    if (b.length) out.push(b.shift()!);
  }
  return out.slice(0, n);
}
