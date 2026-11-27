/** すべての類題ジェネレーター（src/generators/units/*.ts が export する generators を集める） */
import type { QuestionGenerator } from './types.ts';

const modules = import.meta.glob<QuestionGenerator[]>('./units/*.ts', { eager: true, import: 'generators' });

export const allGenerators: QuestionGenerator[] = Object.keys(modules)
  .sort()
  .flatMap((k) => modules[k] ?? []);
