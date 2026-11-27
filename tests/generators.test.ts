/**
 * 類題ジェネレーターの性質テスト。各ジェネレーターを多数の種で動かし、
 * どの種でも「1 問として正しい形」になることを確かめる。
 * 正答の値そのもの（統計的な正しさ）は、各ジェネレーターがコードで計算している。
 */
import { describe, expect, it } from 'vitest';
import { loadBundle } from '../scripts/lib/load-content.ts';
import { questionSchema } from '../src/content/schema.ts';
import type { Curriculum, UnitContent } from '../src/content/types.ts';
import { checkFigure, checkRich, type Issue } from '../src/content/validate.ts';
import { allGenerators } from '../src/generators/index.ts';
import { makeQuestion, parseVariantId } from '../src/generators/types.ts';

const SEEDS = Number(process.env.GEN_SEEDS ?? 300);
const bundle = loadBundle();
const curriculum = bundle.curriculum as Curriculum;
const units = new Map(curriculum.units.map((u) => [u.id, u]));
const staticQuestions = new Map(
  Object.values(bundle.units as Record<string, UnitContent>).flatMap((c) => c.questions.map((q) => [q.id, { q, unitId: c.unitId }] as const)),
);

describe('ジェネレーターの登録', () => {
  it('1 つ以上あり、id が重ならない', () => {
    expect(allGenerators.length).toBeGreaterThan(0);
    const ids = allGenerators.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  for (const g of allGenerators) {
    it(`${g.id}: 単元・級・置き換え先が正しい`, () => {
      expect(g.id).toMatch(/^[a-z0-9-]+$/);
      expect(g.id.startsWith(g.unitId)).toBe(true);
      const unit = units.get(g.unitId);
      expect(unit, g.unitId).toBeDefined();
      expect(g.grade).toBeLessThanOrEqual(unit!.grade);
      for (const r of g.replaces) {
        const s = staticQuestions.get(r);
        expect(s, `${r} が見つからない`).toBeDefined();
        expect(s!.unitId).toBe(g.unitId);
        expect(s!.q.pool, `${r} は practice の問題だけを置き換えられる`).toBe('practice');
      }
    });
  }
});

describe.each(allGenerators.map((g) => [g.id, g] as const))('%s', (_id, g) => {
  it(`${SEEDS} 個の種で、正しい形の問題になる`, () => {
    const stems = new Set<string>();
    const answers = new Map<number, number>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const q = makeQuestion(g, seed);
      const where = `${q.id}`;
      const parsed = questionSchema.safeParse(q);
      expect(parsed.success, `${where}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3))}`).toBe(true);
      expect(parseVariantId(q.id)).toEqual({ genId: g.id, seed });
      // 正答は 1 つ・選択肢は重ならない・解説と選択肢メモがそろっている
      expect(q.answer, where).toBeGreaterThanOrEqual(0);
      expect(q.answer, where).toBeLessThan(q.choices.length);
      expect(new Set(q.choices).size, `${where}: 選択肢が重なっている ${JSON.stringify(q.choices)}`).toBe(q.choices.length);
      expect(q.choiceNotes.length, where).toBe(q.choices.length);
      expect(q.choiceNotes[q.answer]!.startsWith('正しい'), `${where}: 正答のメモは「正しい」で始める`).toBe(true);
      q.choiceNotes.forEach((n, i) => {
        if (i !== q.answer) expect(n.startsWith('正しい'), `${where}: 誤答のメモが「正しい」で始まっている`).toBe(false);
      });
      // 数式・図表が表示できる
      const issues: Issue[] = [];
      checkRich(`${where}.stem`, q.stem, issues);
      q.choices.forEach((c, i) => checkRich(`${where}.choices[${i}]`, c, issues));
      q.choiceNotes.forEach((c, i) => checkRich(`${where}.choiceNotes[${i}]`, c, issues));
      checkRich(`${where}.explanation`, q.explanation, issues);
      checkFigure(`${where}.figure`, q.figure, issues);
      expect(issues.filter((i) => i.level === 'error').map((i) => `${i.where}: ${i.message}`)).toEqual([]);
      // NaN や undefined が文字列に紛れ込んでいない
      const text = JSON.stringify(q);
      expect(/NaN|undefined|Infinity|\[object Object\]/.test(text), `${where}: ${text.slice(0, 300)}`).toBe(false);
      stems.add(q.stem + JSON.stringify(q.figure ?? null));
      answers.set(q.answer, (answers.get(q.answer) ?? 0) + 1);
    }
    // 同じ種なら同じ問題
    expect(makeQuestion(g, 42)).toEqual(makeQuestion(g, 42));
    // 種を変えれば、たいてい違う問題になる（類題として意味がある）
    expect(stems.size, '問題のバリエーションが少なすぎる').toBeGreaterThanOrEqual(Math.min(SEEDS, 50));
    // 正答の位置が 1 か所に偏っていない（値の小さい順に並べるので、偏りやすい）
    const top = Math.max(...answers.values());
    expect(top / SEEDS, `正答の位置の分布 ${JSON.stringify([...answers.entries()])}`).toBeLessThan(0.7);
  });
});
