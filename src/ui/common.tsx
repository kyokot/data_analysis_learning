import { course } from '../content/index.ts';
import type { Provider, ResourceLink, ResourceRole } from '../content/types.ts';
import type { UnitStatus } from '../engine/model.ts';

/** 出題の並べ替えに使う乱数（テスト以外は Math.random） */
export const rng = Math.random;

const STATUS: Record<UnitStatus, { label: string; cls: string }> = {
  new: { label: '未着手', cls: 'chip' },
  learning: { label: '学習中', cls: 'chip chip--accent' },
  passed: { label: '合格・定着チェック待ち', cls: 'chip chip--accent' },
  mastered: { label: '定着', cls: 'chip chip--good' },
};

export function StatusChip({ status }: { status: UnitStatus }) {
  const s = STATUS[status];
  return <span className={s.cls}>{s.label}</span>;
}

export function stageOf(unitId: string) {
  const u = course.units.get(unitId);
  return course.curriculum.stages.find((s) => s.id === u?.stageId);
}

export function provider(id: string): Provider | undefined {
  return course.resources.providers.find((p) => p.id === id);
}

export function linksFor(unitId: string, role?: ResourceRole): ResourceLink[] {
  return course.resources.links.filter((l) => l.unitIds.includes(unitId) && (!role || l.role === role));
}

const TYPE_LABEL: Record<ResourceLink['type'], string> = {
  text: '読む',
  video: '動画',
  interactive: '触って試す',
  practice: '問題演習',
  mock: '模試',
  official: '公式',
  reference: '用語・資料',
  data: 'データ',
};
export const typeLabel = (t: ResourceLink['type']) => TYPE_LABEL[t];

export function hours(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.round((minutes / 60) * 2) / 2;
  return `約${h}時間`;
}
