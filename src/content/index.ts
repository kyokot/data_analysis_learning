/** content/ 以下の JSON をアプリに取り込む（ビルド時に束ねる） */
import curriculumJson from '../../content/curriculum.json';
import examGuideJson from '../../content/exam-guide.json';
import resourcesJson from '../../content/resources.json';
import verificationJson from '../../content/verification.json';
import { buildCourse } from '../engine/model.ts';
import { allGenerators } from '../generators/index.ts';
import type { Curriculum, ResourceCatalog, UnitContent } from './types.ts';

const modules = import.meta.glob<UnitContent>('../../content/units/*.json', { eager: true, import: 'default' });

export const course = buildCourse(
  curriculumJson as unknown as Curriculum,
  Object.values(modules),
  resourcesJson as unknown as ResourceCatalog,
  allGenerators,
);

export interface ExamGuide {
  checkedOn: string;
  basis: string;
  grades: {
    grade: 4 | 3;
    level: string;
    format: string;
    questions: string;
    minutes: string;
    passLine: string;
    fee: string;
    tools: string;
  }[];
  links: { title: string; url: string; note?: string }[];
  books: { title: string; publisher: string; price: string; note: string }[];
}

export const examGuide = examGuideJson as ExamGuide;

/** 正答を隠した解き直し検証を終えた単元（単元 id → 日付） */
export const blindVerified: Record<string, string> = verificationJson.blindVerified;
