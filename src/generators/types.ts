/**
 * 類題ジェネレーター: 計算で答えが決まる技能について、数値の違う問題を何問でも作る。
 *
 * - 正答はコードで計算する。誤答は「典型的な取り違え」を同じデータに当てはめて計算する。
 * - 種（seed）から決定的に作る。問題番号 `gen:<ジェネレーターid>~<seed>` だけで同じ問題を再現できる。
 * - 模試には使わない（模試は検証済みの固定問題）。
 */
import type { Difficulty, Figure, Grade, Question, RichText } from '../content/types.ts';
import { seededRng, type Rng } from '../engine/rng.ts';

/** ジェネレーターが組み立てる問題の中身 */
export interface Draft {
  stem: RichText;
  figure?: Figure;
  choices: RichText[];
  answer: number;
  explanation: RichText;
  choiceNotes: RichText[];
}

export interface QuestionGenerator {
  /** 一意の id（英小文字・数字・ハイフン）。単元 id で始める */
  id: string;
  unitId: string;
  /** 問う技能（短い名詞句） */
  skill: string;
  grade: Grade;
  difficulty: Difficulty;
  /**
   * この技能を問う固定の問題（practice）の id。
   * それらを間違えたとき、出し直しで同じ問題の代わりにこの類題を出す。
   */
  replaces: string[];
  /**
   * 問題を1つ作る。数値の組み合わせが悪く選択肢が作れないときは Reject を投げる
   * （別の乱数で作り直す）。
   */
  build(rng: Rng): Draft;
}

/** 数値の組み合わせが悪いときに投げる。makeQuestion が別の乱数で作り直す */
export class Reject extends Error {}

export const GEN_PREFIX = 'gen:';

export function variantId(genId: string, seed: number): string {
  return `${GEN_PREFIX}${genId}~${seed}`;
}

export function parseVariantId(id: string): { genId: string; seed: number } | null {
  const m = /^gen:([a-z0-9-]+)~(\d+)$/.exec(id);
  return m ? { genId: m[1]!, seed: Number(m[2]) } : null;
}

/** 種から問題を作る。同じ種なら必ず同じ問題になる */
export function makeQuestion(gen: QuestionGenerator, seed: number): Question {
  const rng = seededRng(seed * 7919 + 17);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const d = gen.build(rng);
      return {
        id: variantId(gen.id, seed),
        grade: gen.grade,
        difficulty: gen.difficulty,
        pool: 'practice',
        skill: gen.skill,
        ...d,
      };
    } catch (e) {
      if (!(e instanceof Reject)) throw e;
    }
  }
  throw new Error(`${gen.id}: 60 回作り直しても問題を作れませんでした（seed ${seed}）`);
}

export function randomSeed(rng: Rng): number {
  return Math.floor(rng() * 2_000_000_000);
}
