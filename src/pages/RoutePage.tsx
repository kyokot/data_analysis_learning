import { useMemo } from 'react';
import { course } from '../content/index.ts';
import type { Grade, Unit } from '../content/types.ts';
import { gradeUnits, isSupportUnit, unitProgress, type Progress } from '../engine/model.ts';
import { blueprintFor, isDone, latestMock, mockPercent, planToday } from '../engine/planner.ts';
import { useProgress } from '../store/store.ts';
import { rng, StatusChip } from '../ui/common.tsx';
import { useToday } from '../ui/hooks.ts';
import { Link } from '../ui/router.tsx';

function Node({ unit, index, p, next }: { unit: Unit; index: number; p: Progress; next: boolean }) {
  const up = unitProgress(p, unit.id);
  const has = course.content.has(unit.id);
  return (
    <li className={`trail__item${isDone(p, unit.id) ? ' trail__item--done' : ''}`}>
      <span className={`trail__node trail__node--${up.status} num`} aria-hidden="true">
        {up.status === 'mastered' ? '✓' : index + 1}
      </span>
      <Link to={{ name: 'unit', id: unit.id }} className={`trail__link${next ? ' trail__link--next' : ''}`}>
        <span className="trail__title">{unit.title}</span>
        <span className="trail__meta">
          {next ? <span className="chip chip--accent">次はここ</span> : null}
          <StatusChip status={up.status} />
          <span>目安{unit.minutes}分</span>
          {up.lastCheck ? (
            <span className="num">
              確認テスト {up.lastCheck.correct}/{up.lastCheck.total}
            </span>
          ) : null}
          {!has ? <span>確認テストは準備中</span> : null}
        </span>
      </Link>
    </li>
  );
}

function MockNode({ grade, p }: { grade: Grade; p: Progress }) {
  const bp = blueprintFor(course, grade);
  const last = latestMock(p, grade);
  if (!bp) return null;
  return (
    <li className={`trail__item${last ? ' trail__item--done' : ''}`}>
      <span className="trail__node trail__node--mock" aria-hidden="true">
        <span />
      </span>
      <Link to={{ name: 'mock' }} className="trail__link">
        <span className="trail__title">{grade}級の模試</span>
        <span className="trail__meta">
          <span>
            {bp.questions}問・{bp.minutes}分
          </span>
          {last ? <span className="num">直近 {mockPercent(last)}%</span> : <span>未受験</span>}
        </span>
      </Link>
    </li>
  );
}

export function RoutePage() {
  const p = useProgress();
  const today = useToday();
  const goal = p.settings.goal;
  const nextId = useMemo(() => {
    const s = planToday(course, p, today, rng).find((x) => x.kind === 'unit');
    return s?.kind === 'unit' ? s.unitId : undefined;
  }, [p, today]);
  const grades: Grade[] = goal === 3 ? [4, 3] : [4];
  const support = course.curriculum.units.filter((u) => isSupportUnit(course, u));

  return (
    <div className="stack stack--lg">
      <div className="stack">
        <h1 className="page-title">学習ルート</h1>
        <p className="muted small">上から順に進みます。知っている単元は、確認テストに合格すれば先へ進めます。目標の級は資料室の「設定とバックアップ」で変えられます。</p>
      </div>
      {grades.map((g) => {
        const units = gradeUnits(course, g);
        const stages = course.curriculum.stages.filter((s) => units.some((u) => u.stageId === s.id));
        let n = 0;
        return (
          <section key={g} className="stack" aria-labelledby={`course-${g}`}>
            <h2 className="section-title" id={`course-${g}`}>
              {g === 4 ? '4級コース' : '3級コース（4級からの差分）'}
            </h2>
            {stages.map((s) => (
              <div key={s.id} className="stack">
                <div>
                  <p className="eyebrow">{s.title}</p>
                  <p className="small muted">{s.description}</p>
                </div>
                <ol className="trail">
                  {units
                    .filter((u) => u.stageId === s.id)
                    .map((u) => (
                      <Node key={u.id} unit={u} index={n++} p={p} next={u.id === nextId} />
                    ))}
                  {s.id === stages[stages.length - 1]!.id ? <MockNode grade={g} p={p} /> : null}
                </ol>
              </div>
            ))}
          </section>
        );
      })}
      <section className="card stack" aria-labelledby="support">
        <h2 className="section-title" id="support">
          数学の補習（必要なときだけ）
        </h2>
        <p className="small muted">計算でつまずいたときに戻る場所です。必要になる単元の直前にも案内します。</p>
        <ul className="step-list">
          {support.map((u) => (
            <li key={u.id}>
              <div className="step-list__body">
                <Link to={{ name: 'unit', id: u.id }}>{u.title}</Link>
                <p className="small muted">目安{u.minutes}分</p>
              </div>
              <StatusChip status={unitProgress(p, u.id).status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
