/** content/ 以下の JSON をアプリに取り込む（ビルド時に束ねる） */
import curriculumJson from '../../content/curriculum.json';
import examGuideJson from '../../content/exam-guide.json';
import resourcesJson from '../../content/resources.json';
import { buildCourse } from '../engine/model.ts';
import type { Curriculum, ResourceCatalog, UnitContent } from './types.ts';

const modules = import.meta.glob<UnitContent>('../../content/units/*.json', { eager: true, import: 'default' });

export const course = buildCourse(
  curriculumJson as unknown as Curriculum,
  Object.values(modules),
  resourcesJson as unknown as ResourceCatalog,
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
