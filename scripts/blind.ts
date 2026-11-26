/**
 * 独立した解き直し（ブラインド検証）のための補助 CLI。
 *
 *   tsx scripts/blind.ts export <単元id>
 *       正答・解説・選択肢メモを除いた問題だけを JSON で出力する。
 *   tsx scripts/blind.ts check <単元id> <解答ファイル.json>
 *       解答ファイル { "<問題id>": <選んだ添字>, ... } を正答と突き合わせ、不一致を出力する。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentRoot } from './lib/load-content.ts';
import type { UnitContent } from '../src/content/types.ts';

const [mode, unitId, answersPath] = process.argv.slice(2);
if (!mode || !unitId) {
  console.error('usage: tsx scripts/blind.ts export <unitId> | check <unitId> <answers.json>');
  process.exit(2);
}
const content = JSON.parse(readFileSync(join(contentRoot, 'units', `${unitId}.json`), 'utf8')) as UnitContent;

if (mode === 'export') {
  const blind = content.questions.map((q) => ({
    id: q.id,
    grade: q.grade,
    difficulty: q.difficulty,
    pool: q.pool,
    skill: q.skill,
    stem: q.stem,
    figure: q.figure,
    choices: q.choices.map((c, i) => `[${i}] ${c}`),
  }));
  console.log(JSON.stringify(blind, null, 2));
} else if (mode === 'check') {
  if (!answersPath) {
    console.error('解答ファイルを指定してください');
    process.exit(2);
  }
  const answers = JSON.parse(readFileSync(answersPath, 'utf8')) as Record<string, number>;
  let mismatch = 0;
  for (const q of content.questions) {
    const a = answers[q.id];
    if (a === undefined) {
      mismatch++;
      console.log(`MISSING  ${q.id}: 解答がありません`);
    } else if (a !== q.answer) {
      mismatch++;
      console.log(`MISMATCH ${q.id}: 解き直し = [${a}] ${q.choices[a] ?? '?'} / 正答キー = [${q.answer}] ${q.choices[q.answer]}`);
    }
  }
  console.log(`\n${content.questions.length} 問中 不一致 ${mismatch} 問`);
  process.exit(mismatch ? 1 : 0);
} else {
  console.error(`unknown mode: ${mode}`);
  process.exit(2);
}
