/**
 * 進み具合の保存と、バックアップ（書き出し・読み込み）。
 * 保存先はこの端末のブラウザ（localStorage）だけ。使えない環境ではメモリ上で動かす。
 */
import { isValidDateStr, toDateStr } from '../engine/dates.ts';
import { emptyProgress, type Progress, type UnitProgress, type UnitStatus } from '../engine/model.ts';

const KEY = 'toukei-michishirube.progress.v1';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const statuses: UnitStatus[] = ['new', 'learning', 'passed', 'mastered'];

/**
 * 保存データ・バックアップを検査して Progress に整える。
 * 形が合わない部分は捨てる（壊れたデータで画面が落ちないようにする）。読めなければ null。
 */
export function sanitizeProgress(raw: unknown): Progress | null {
  if (!isObj(raw) || raw.version !== 1 || !isObj(raw.settings)) return null;
  const base = emptyProgress(isValidDateStr(raw.createdOn) ? raw.createdOn : toDateStr(new Date()));
  const s = raw.settings;
  base.settings = {
    onboarded: s.onboarded === true,
    goal: s.goal === 4 ? 4 : 3,
    minutesPerDay: typeof s.minutesPerDay === 'number' && s.minutesPerDay >= 5 && s.minutesPerDay <= 600 ? s.minutesPerDay : 40,
    ...(isValidDateStr(s.examDate) ? { examDate: s.examDate } : {}),
  };
  if (isObj(raw.units)) {
    for (const [id, v] of Object.entries(raw.units)) {
      if (!isObj(v) || !statuses.includes(v.status as UnitStatus)) continue;
      const u: UnitProgress = {
        status: v.status as UnitStatus,
        attempts: typeof v.attempts === 'number' ? v.attempts : 0,
        visited: Array.isArray(v.visited) ? v.visited.filter((x): x is string => typeof x === 'string') : [],
      };
      if (isValidDateStr(v.passedOn)) u.passedOn = v.passedOn;
      if (isValidDateStr(v.confirmDue)) u.confirmDue = v.confirmDue;
      if (isValidDateStr(v.masteredOn)) u.masteredOn = v.masteredOn;
      const lc = v.lastCheck;
      if (isObj(lc) && isValidDateStr(lc.date) && typeof lc.correct === 'number' && typeof lc.total === 'number' && Array.isArray(lc.questionIds)) {
        u.lastCheck = { date: lc.date, correct: lc.correct, total: lc.total, questionIds: lc.questionIds.filter((x): x is string => typeof x === 'string') };
      }
      // 合格済みなのに定着チェックの日付が無いと、永久に定着しない。今日出せるようにする
      if (u.status === 'passed' && !u.confirmDue) u.confirmDue = toDateStr(new Date());
      base.units[id] = u;
    }
  }
  if (isObj(raw.questions)) {
    for (const [id, v] of Object.entries(raw.questions)) {
      if (!isObj(v) || typeof v.seen !== 'number' || typeof v.correct !== 'number') continue;
      const r = v.review;
      base.questions[id] = {
        seen: v.seen,
        correct: v.correct,
        ...(isValidDateStr(v.lastDate) ? { lastDate: v.lastDate } : {}),
        ...(typeof v.lastCorrect === 'boolean' ? { lastCorrect: v.lastCorrect } : {}),
        ...(isObj(r) && typeof r.stage === 'number' && isValidDateStr(r.due) ? { review: { stage: r.stage, due: r.due } } : {}),
      };
    }
  }
  if (Array.isArray(raw.mocks)) {
    for (const m of raw.mocks) {
      if (!isObj(m) || !Array.isArray(m.questionIds) || !Array.isArray(m.answers) || !isValidDateStr(m.date)) continue;
      if (m.questionIds.length !== m.answers.length) continue;
      base.mocks.push({
        id: typeof m.id === 'string' ? m.id : `mock-${base.mocks.length}`,
        grade: m.grade === 4 ? 4 : 3,
        date: m.date,
        seconds: typeof m.seconds === 'number' ? m.seconds : 0,
        questionIds: m.questionIds.filter((x): x is string => typeof x === 'string'),
        answers: m.answers.map((a) => (typeof a === 'number' ? a : null)),
        correct: typeof m.correct === 'number' ? m.correct : 0,
        unseen: typeof m.unseen === 'number' ? m.unseen : 0,
        unseenCorrect: typeof m.unseenCorrect === 'number' ? m.unseenCorrect : 0,
      });
    }
  }
  const am = raw.activeMock;
  if (isObj(am) && Array.isArray(am.questionIds) && Array.isArray(am.answers) && Array.isArray(am.flags) && typeof am.startedAt === 'number' && typeof am.endsAt === 'number') {
    const n = am.questionIds.length;
    if (n > 0 && am.answers.length === n && am.flags.length === n && am.questionIds.every((x) => typeof x === 'string')) {
      base.activeMock = {
        grade: am.grade === 4 ? 4 : 3,
        questionIds: am.questionIds as string[],
        answers: am.answers.map((a) => (typeof a === 'number' ? a : null)),
        flags: am.flags.map((f) => f === true),
        startedAt: am.startedAt,
        endsAt: am.endsAt,
        unseenIds: Array.isArray(am.unseenIds) ? am.unseenIds.filter((x): x is string => typeof x === 'string') : [],
      };
    }
  }
  if (Array.isArray(raw.external)) {
    for (const e of raw.external) {
      if (!isObj(e) || !isValidDateStr(e.date) || typeof e.label !== 'string' || typeof e.percent !== 'number') continue;
      base.external.push({
        id: typeof e.id === 'string' ? e.id : `ext-${base.external.length}`,
        date: e.date,
        grade: e.grade === 4 ? 4 : 3,
        label: e.label.slice(0, 80),
        percent: Math.max(0, Math.min(100, e.percent)),
      });
    }
  }
  if (isObj(raw.days)) {
    for (const [d, v] of Object.entries(raw.days)) {
      if (isValidDateStr(d) && isObj(v) && typeof v.answered === 'number' && typeof v.correct === 'number') {
        base.days[d] = { answered: v.answered, correct: v.correct };
      }
    }
  }
  const aw = raw.away;
  if (isObj(aw) && typeof aw.unitId === 'string' && typeof aw.linkId === 'string' && typeof aw.at === 'number') {
    base.away = { unitId: aw.unitId, linkId: aw.linkId, at: aw.at };
  }
  if (isValidDateStr(raw.lastBackupOn)) base.lastBackupOn = raw.lastBackupOn;
  return base;
}

export function loadProgress(): Progress {
  try {
    const text = localStorage.getItem(KEY);
    if (text) {
      const p = sanitizeProgress(JSON.parse(text));
      if (p) return p;
    }
  } catch {
    // 保存領域が使えない・壊れている場合は新規に始める
  }
  return emptyProgress(toDateStr(new Date()));
}

/** 保存できたら true。保存領域が使えない場合は false（画面はそのまま動く）。 */
export function saveProgress(p: Progress): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export const STORAGE_KEY = KEY;

/** バックアップ用の文字列（JSON）。学習中の模試や離席の記録は含めない */
export function exportBackup(p: Progress): string {
  const { activeMock: _m, away: _a, ...rest } = p;
  return JSON.stringify({ app: 'toukei-michishirube', ...rest });
}

export function importBackup(text: string): Progress | null {
  try {
    return sanitizeProgress(JSON.parse(text.trim()));
  } catch {
    return null;
  }
}
