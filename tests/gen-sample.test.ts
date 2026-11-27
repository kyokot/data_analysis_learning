/**
 * 類題の見本を表示する（検査ではなく、目で確かめるための道具）。
 *
 *   GEN_SAMPLE=central npx vitest run tests/gen-sample.test.ts
 *     id が "central" で始まるジェネレーターの見本を、種 1〜3 で表示する。GEN_SAMPLE_SEEDS で個数を変えられる。
 */
import { it } from 'vitest';
import { allGenerators } from '../src/generators/index.ts';
import { makeQuestion } from '../src/generators/types.ts';

const prefix = process.env.GEN_SAMPLE;
const seeds = Number(process.env.GEN_SAMPLE_SEEDS ?? 3);

it.skipIf(!prefix)('類題の見本', () => {
  const out: string[] = [];
  for (const g of allGenerators.filter((x) => x.id.startsWith(prefix ?? ''))) {
    for (let s = 1; s <= seeds; s++) {
      const q = makeQuestion(g, s);
      out.push(`### ${q.id}（${q.skill}）`, q.stem);
      if (q.figure) out.push(`図表: ${JSON.stringify(q.figure)}`);
      q.choices.forEach((c, i) => out.push(`${i === q.answer ? '*' : ' '}[${i}] ${c} — ${q.choiceNotes[i]}`));
      out.push(`解説: ${q.explanation}`, '');
    }
  }
  console.log(out.join('\n'));
});
