import { useMemo, useState } from 'react';
import { course } from '../content/index.ts';
import type { Grade } from '../content/types.ts';
import { formatJa } from '../engine/dates.ts';
import { blueprintFor, computeReadiness, mockPercent } from '../engine/planner.ts';
import { addExternalScore, removeExternalScore } from '../engine/progress.ts';
import { update, useProgress } from '../store/store.ts';
import { useToday } from '../ui/hooks.ts';
import { Link } from '../ui/router.tsx';

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li>
      <span className={`step-list__n ${ok ? 'num' : ''}`} style={ok ? { borderColor: 'var(--good)', color: 'var(--good)' } : undefined} aria-hidden="true">
        {ok ? '✓' : ''}
      </span>
      <div className="step-list__body">
        <span className="sr-only">{ok ? '達成: ' : '未達成: '}</span>
        {children}
      </div>
    </li>
  );
}

export function ProgressPage() {
  const p = useProgress();
  const today = useToday();
  const r = useMemo(() => computeReadiness(course, p), [p]);
  const bp = blueprintFor(course, r.goal);
  const [label, setLabel] = useState('公式問題集');
  const [percent, setPercent] = useState('');
  const [date, setDate] = useState(today);
  const [grade, setGrade] = useState<Grade>(r.goal);
  const days = Object.values(p.days);
  const answered = days.reduce((n, d) => n + d.answered, 0);
  const correct = days.reduce((n, d) => n + d.correct, 0);
  const pct = Number(percent);
  const valid = label.trim().length > 0 && percent !== '' && pct >= 0 && pct <= 100;
  const bestExternal = p.external.filter((e) => e.grade === r.goal).reduce((m, e) => Math.max(m, e.percent), -1);

  return (
    <div className="stack stack--lg">
      <div className="stack">
        <h1 className="page-title">進み具合</h1>
        <p className="muted small">目標: 統計検定{r.goal}級。受験してよいかどうかを、解けた事実だけで判断します。</p>
      </div>

      <section className="card stack" aria-labelledby="ready">
        <h2 className="section-title" id="ready">
          受験の目安
        </h2>
        {r.ready ? <p className="notice notice--accent">目安に届いています。公式問題集で最終確認をして、受験を申し込みましょう。</p> : null}
        <ul className="step-list">
          <Check ok={r.total > 0 && r.done === r.total}>
            <p>全単元の確認テストに合格する</p>
            <p className="small muted num">
              {r.done} / {r.total} 単元
            </p>
          </Check>
          <Check ok={r.total > 0 && r.mastered === r.total}>
            <p>日を空けた定着チェックにも合格する</p>
            <p className="small muted num">
              {r.mastered} / {r.total} 単元が定着
            </p>
          </Check>
          <Check ok={r.lastMockPercent !== undefined && !!bp && r.lastMockPercent >= bp.safeLine}>
            <p>模試で{bp?.safeLine ?? 80}%以上を取る（合格基準は{bp?.passLine}点）</p>
            <p className="small muted num">
              {r.lastMockPercent !== undefined ? `直近 ${r.lastMockPercent}%${r.lastMockUnseenPercent !== undefined ? `（初見の問題では ${r.lastMockUnseenPercent}%）` : ''}` : 'まだ受けていません'}
            </p>
          </Check>
          <Check ok={bestExternal >= 80}>
            <p>公式問題集など、初見の問題でも8割を取る（おすすめ）</p>
            <p className="small muted num">{bestExternal >= 0 ? `記録した最高 ${bestExternal}%` : '下の欄で自己採点を記録できます'}</p>
          </Check>
        </ul>
      </section>

      <section className="card stack" aria-labelledby="weak">
        <h2 className="section-title" id="weak">
          いまの弱点
        </h2>
        {r.weakUnits.length === 0 ? (
          <p className="muted small">直近の解答で正答率が6割を下回っている単元はありません。</p>
        ) : (
          <>
            <ul className="step-list">
              {r.weakUnits.map((s) => (
                <li key={s.unit.id}>
                  <div className="step-list__body">
                    <Link to={{ name: 'unit', id: s.unit.id }}>{s.unit.title}</Link>
                    <p className="small muted">見た{s.seen}問のうち、直近で正解できたのは{Math.round((s.accuracy ?? 0) * 100)}%</p>
                  </div>
                  <Link to={{ name: 'drill', id: s.unit.id }} className="btn" style={{ minHeight: 38, padding: '4px 12px' }}>
                    練習
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="small muted">復習待ちの問題: {r.pendingReviews}問（1日後・3日後・7日後に出し直します）</p>
      </section>

      <section className="card stack" aria-labelledby="mocks">
        <h2 className="section-title" id="mocks">
          模試の記録
        </h2>
        {p.mocks.length === 0 ? (
          <p className="muted small">まだ模試を受けていません。</p>
        ) : (
          <ul className="step-list">
            {[...p.mocks].reverse().map((m) => (
              <li key={m.id}>
                <div className="step-list__body">
                  <Link to={{ name: 'result', id: m.id }}>
                    {formatJa(m.date)}・{m.grade}級
                  </Link>
                  <p className="small muted num">
                    {m.correct}/{m.questionIds.length}問・初見 {m.unseen}問中 {m.unseenCorrect}問正解
                  </p>
                </div>
                <span className="chip num">{mockPercent(m)}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="ext">
        <h2 className="section-title" id="ext">
          外部の模試・公式問題集の記録
        </h2>
        <p className="small muted">このサイトの問題を解き切ったあとの実力は、公式問題集や外部の模試で測ります。自己採点の結果を残しておきましょう。</p>
        {p.external.length > 0 ? (
          <ul className="step-list">
            {[...p.external].reverse().map((e) => (
              <li key={e.id}>
                <div className="step-list__body">
                  <p>{e.label}</p>
                  <p className="small muted">
                    {formatJa(e.date)}・{e.grade}級
                  </p>
                </div>
                <span className="chip num">{e.percent}%</span>
                <button type="button" className="linklike small" onClick={() => update((prev) => removeExternalScore(prev, e.id))} aria-label={`${e.label}の記録を削除`}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="stack"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!valid) return;
            update((prev) => addExternalScore(prev, { id: `ext-${Date.now()}`, date, grade, label: label.trim().slice(0, 80), percent: Math.round(pct) }));
            setPercent('');
          }}
        >
          <div className="field">
            <label htmlFor="ext-label">何を解いたか</label>
            <input className="input" id="ext-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
          </div>
          <div className="row">
            <div className="field" style={{ flex: '1 1 120px' }}>
              <label htmlFor="ext-percent">正答率（%）</label>
              <input className="input" id="ext-percent" type="number" inputMode="numeric" min={0} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '1 1 100px' }}>
              <label htmlFor="ext-grade">級</label>
              <select className="input" id="ext-grade" value={grade} onChange={(e) => setGrade(Number(e.target.value) === 4 ? 4 : 3)}>
                <option value={4}>4級</option>
                <option value={3}>3級</option>
              </select>
            </div>
            <div className="field" style={{ flex: '1 1 150px' }}>
              <label htmlFor="ext-date">日付</label>
              <input className="input" id="ext-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
            </div>
          </div>
          <button type="submit" className="btn" disabled={!valid}>
            記録する
          </button>
        </form>
      </section>

      <section className="stats" aria-label="学習の記録">
        <div className="stat">
          <p className="stat__label">学習した日</p>
          <p className="stat__value num">
            {days.length}
            <small> 日</small>
          </p>
        </div>
        <div className="stat">
          <p className="stat__label">解いた問題</p>
          <p className="stat__value num">
            {answered}
            <small> 問</small>
          </p>
        </div>
        <div className="stat">
          <p className="stat__label">正答率</p>
          <p className="stat__value num">
            {answered ? Math.round((correct / answered) * 100) : '—'}
            <small>{answered ? ' %' : ''}</small>
          </p>
        </div>
      </section>
    </div>
  );
}
