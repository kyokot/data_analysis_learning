import type { Curriculum, Question, UnitContent } from '../src/content/types.ts';
import { buildCourse, type Course } from '../src/engine/model.ts';

function questions(unitId: string, grade: 4 | 3, practice: number, exam: number): Question[] {
  return Array.from({ length: practice + exam }, (_, i) => ({
    id: `${unitId}-q${String(i + 1).padStart(2, '0')}`,
    grade,
    difficulty: i < 2 ? 1 : i === practice - 1 ? 3 : 2,
    pool: i < practice ? 'practice' : 'exam',
    skill: 'skill',
    stem: `${unitId} ${i}`,
    choices: ['a', 'b', 'c', 'd'],
    answer: i % 4,
    explanation: 'explanation',
    choiceNotes: ['a', 'b', 'c', 'd'],
  })) as Question[];
}

const lesson = {
  intro: 'intro',
  points: [{ title: 't', body: 'b' }],
  example: { problem: 'p', steps: ['s1', 's2'], answer: 'a' },
  pitfalls: ['p'],
  examTips: ['t'],
};

/** 補習 1・4級 2・3級 2 の小さなコース */
export function fixtureCourse(): Course {
  const curriculum: Curriculum = {
    domains: [
      { id: 'math', title: '数学' },
      { id: 'summary', title: '要約' },
      { id: 'probability', title: '確率' },
      { id: 'inference', title: '推測' },
    ],
    stages: [
      { id: 's0', title: '補習', description: 'd', grade: 4, support: true },
      { id: 's1', title: '入門', description: 'd', grade: 4 },
      { id: 's2', title: '発展', description: 'd', grade: 3 },
    ],
    units: [
      { id: 'm1', stageId: 's0', title: '割合', grade: 4, domain: 'math', prerequisites: [], goals: ['g'], minutes: 10, official: 'o' },
      { id: 'a1', stageId: 's1', title: '代表値', grade: 4, domain: 'summary', prerequisites: [], refreshers: ['m1'], goals: ['g'], minutes: 30, official: 'o' },
      { id: 'a2', stageId: 's1', title: '確率', grade: 4, domain: 'probability', prerequisites: ['a1'], goals: ['g'], minutes: 30, official: 'o' },
      { id: 'b1', stageId: 's2', title: '分散', grade: 3, domain: 'summary', prerequisites: ['a1'], goals: ['g'], minutes: 40, official: 'o' },
      { id: 'b2', stageId: 's2', title: '推定', grade: 3, domain: 'inference', prerequisites: ['b1'], goals: ['g'], minutes: 40, official: 'o' },
    ],
    mocks: [
      { grade: 4, questions: 6, minutes: 12, passLine: 60, safeLine: 80, domains: { summary: 3, probability: 3 } },
      { grade: 3, questions: 8, minutes: 16, passLine: 65, safeLine: 80, domains: { summary: 4, probability: 2, inference: 2 } },
    ],
  };
  const contents: UnitContent[] = [
    { unitId: 'm1', lesson, questions: questions('m1', 4, 6, 0) },
    { unitId: 'a1', lesson, questions: questions('a1', 4, 8, 5) },
    { unitId: 'a2', lesson, questions: questions('a2', 4, 8, 5) },
    { unitId: 'b1', lesson, questions: questions('b1', 3, 8, 4) },
    { unitId: 'b2', lesson, questions: questions('b2', 3, 8, 4) },
  ];
  return buildCourse(curriculum, contents, { providers: [], links: [] });
}
