import { describe, expect, it } from 'vitest';
import { loadBundle } from '../scripts/lib/load-content.ts';
import type { Curriculum, ResourceCatalog, UnitContent } from '../src/content/types.ts';
import { validateAll, type Issue } from '../src/content/validate.ts';
import { buildCourse, emptyProgress, gradeUnits } from '../src/engine/model.ts';
import { seededRng } from '../src/engine/rng.ts';
import { buildMock, pickCheckQuestions, pickConfirmQuestions } from '../src/engine/select.ts';

const loadIssues: Issue[] = [];
const bundle = loadBundle(loadIssues);

describe('content/ の整合性', () => {
  it('JSON として読める', () => {
    expect(loadIssues).toEqual([]);
  });
  it('検証エラーがない', () => {
    const errors = validateAll(bundle).filter((i) => i.level === 'error');
    expect(errors.map((e) => `${e.where}: ${e.message}`)).toEqual([]);
  });
});

describe('実際の教材でエンジンが組める', () => {
  const course = buildCourse(bundle.curriculum as Curriculum, Object.values(bundle.units) as UnitContent[], bundle.resources as ResourceCatalog);
  const fresh = emptyProgress('2026-01-01');

  it('すべての単元で、確認テストと定着チェックに別々の問題を出せる', () => {
    for (const unit of course.curriculum.units) {
      const check = pickCheckQuestions(course, fresh, unit.id, seededRng(1));
      expect(check.length, unit.id).toBe(5);
      if (unit.domain === 'math') continue;
      const p = { ...fresh, units: { [unit.id]: { status: 'passed' as const, attempts: 1, visited: [], lastCheck: { date: '2026-01-01', correct: 5, total: 5, questionIds: check.map((q) => q.id) } } } };
      const confirm = pickConfirmQuestions(course, p, unit.id, seededRng(2));
      expect(confirm.length, unit.id).toBe(3);
      expect(confirm.some((q) => check.includes(q)), unit.id).toBe(false);
    }
  });

  it('4級・3級の模試を、初回は模試専用の初見問題だけで組める', () => {
    for (const bp of course.curriculum.mocks) {
      const paper = buildMock(course, fresh, bp, seededRng(3));
      expect(paper.questionIds.length).toBe(bp.questions);
      expect(new Set(paper.questionIds).size).toBe(bp.questions);
      expect(paper.unseenIds.length).toBe(bp.questions);
      for (const id of paper.questionIds) {
        const e = course.questions.get(id)!;
        expect(e.question.pool, id).toBe('exam');
        if (bp.grade === 4) expect(e.question.grade, id).toBe(4);
      }
    }
  });

  it('4級コースの単元すべてに主教材のリンクがある', () => {
    for (const unit of gradeUnits(course, 4)) {
      const primary = course.resources.links.filter((l) => l.role === 'primary' && l.unitIds.includes(unit.id));
      expect(primary.length, unit.id).toBeGreaterThan(0);
    }
  });
});
