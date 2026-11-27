/** 模試: 案内 → 受験（制限時間つき）→ 結果 */
import { useEffect, useState } from 'react';
import { course } from '../content/index.ts';
import type { Grade } from '../content/types.ts';
import { formatJa } from '../engine/dates.ts';
import { gradeUnits, lookup } from '../engine/model.ts';
import { blueprintFor, isDone, missedUnits, mockPercent } from '../engine/planner.ts';
import { abandonMock, answerMock, finishMock, flagMock, startMock } from '../engine/progress.ts';
import { buildMock } from '../engine/select.ts';
import { getProgress, update, useProgress } from '../store/store.ts';
import { rng } from '../ui/common.tsx';
import { useNow, useToday } from '../ui/hooks.ts';
import { Feedback, QuestionView } from '../ui/Quiz.tsx';
import { Link, navigate } from '../ui/router.tsx';

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/* ---------- 案内 ---------- */

export function MockHub() {
  const p = useProgress();
  const [asking, setAsking] = useState<Grade | null>(null);
  const [discard, setDiscard] = useState(false);
  const grades: Grade[] = p.settings.goal === 3 ? [4, 3] : [4];
  const now = useNow(30_000);

  const start = (grade: Grade) => {
    const bp = blueprintFor(course, grade);
    if (!bp) return;
    const paper = buildMock(course, getProgress(), bp, rng);
    update((prev) => startMock(prev, grade, paper, bp.minutes, Date.now()));
    navigate({ name: 'mockrun' });
    window.scrollTo(0, 0);
  };

  return (
    <div className="stack stack--lg">
      <div className="stack">
        <h1 className="page-title">模試</h1>
        <p className="muted small">本試験と同じ30問・60分。模試専用に取り置いた問題から出すので、確認テストや復習で見た問題は原則として出ません。</p>
      </div>

      {p.activeMock ? (
        <section className="step-card">
          <p className="eyebrow">受験中</p>
          <h2 className="step-card__title">{p.activeMock.grade}級の模試が途中です</h2>
          <p>
            残り時間 <span className="num">{clock(p.activeMock.endsAt - now)}</span>
            （時計は止まりません）。
          </p>
          <Link to={{ name: 'mockrun' }} className="btn btn--primary btn--block">
            再開する
          </Link>
          {discard ? (
            <div className="notice notice--warn stack">
              <p>この模試の解答を破棄します。出題された問題は「初見」ではなくなります。</p>
              <div className="row">
                <button type="button" className="btn btn--danger" onClick={() => { update(abandonMock); setDiscard(false); }}>
                  破棄する
                </button>
                <button type="button" className="btn" onClick={() => setDiscard(false)}>
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={() => setDiscard(true)}>
              この模試を破棄する
            </button>
          )}
        </section>
      ) : null}

      {grades.map((g) => {
        const bp = blueprintFor(course, g);
        if (!bp) return null;
        const units = (g === 3 ? [...gradeUnits(course, 4), ...gradeUnits(course, 3)] : gradeUnits(course, 4)).filter((u) => (bp.domains[u.domain] ?? 0) > 0);
        const done = units.filter((u) => isDone(p, u.id)).length;
        const pool = units.flatMap((u) => course.content.get(u.id)?.questions ?? []).filter((q) => q.pool === 'exam' && q.grade >= g);
        const unseen = pool.filter((q) => (p.questions[q.id]?.seen ?? 0) === 0).length;
        const paper = buildMock(course, p, bp, () => 0.5);
        const available = paper.questionIds.length >= bp.questions;
        const history = p.mocks.filter((m) => m.grade === g);
        return (
          <section className="card stack" key={g} aria-labelledby={`mock-${g}`}>
            <h2 className="section-title" id={`mock-${g}`}>
              {g}級の模試
            </h2>
            <p>
              {bp.questions}問・{bp.minutes}分・本試験の合格基準は{bp.passLine}点。{g === 3 ? '4級の範囲も含めて出題します。' : ''}
            </p>
            <ul className="bullets small">
              <li>
                <span>
                  範囲の単元 {units.length}のうち <b className="num">{done}</b> 単元に合格済み。{done < units.length ? 'まだ学んでいない単元の問題も出ます。' : ''}
                </span>
              </li>
              <li>
                <span>
                  まだ見ていない模試専用問題: <b className="num">{unseen}</b>問（全{pool.length}問）。{unseen < bp.questions ? '次の模試には、見たことのある問題が混じります。' : ''}
                </span>
              </li>
            </ul>
            {!available ? (
              <p className="notice">この級の模試は準備中です（問題がそろっていません）。</p>
            ) : p.activeMock ? null : asking === g ? (
              <div className="notice notice--accent stack">
                <p>
                  <b>始める前に</b>
                </p>
                <ul className="bullets small">
                  <li><span>開始すると{bp.minutes}分の時計が動き、途中で閉じても止まりません。</span></li>
                  <li><span>電卓（四則演算・百分率・平方根）と筆記用具を用意しましょう。本試験でも電卓を持ち込めます。</span></li>
                  <li><span>1問あたり平均2分です。迷う問題は「見直し」の印を付けて先へ進みましょう。</span></li>
                </ul>
                <div className="row">
                  <button type="button" className="btn btn--primary" onClick={() => start(g)}>
                    模試を始める
                  </button>
                  <button type="button" className="btn" onClick={() => setAsking(null)}>
                    あとで
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn--primary btn--block" onClick={() => setAsking(g)}>
                {g}級の模試を受ける
              </button>
            )}
            {history.length > 0 ? (
              <div>
                <p className="eyebrow">これまでの結果</p>
                <ul className="step-list">
                  {[...history].reverse().map((m) => (
                    <li key={m.id}>
                      <div className="step-list__body">
                        <Link to={{ name: 'result', id: m.id }}>{formatJa(m.date)}の模試</Link>
                        <p className="small muted num">
                          初見 {m.unseen}問中 {m.unseenCorrect}問正解
                        </p>
                      </div>
                      <span className={`chip num ${mockPercent(m) >= bp.safeLine ? 'chip--good' : mockPercent(m) >= bp.passLine ? 'chip--accent' : 'chip--warn'}`}>{mockPercent(m)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        );
      })}

      <p className="notice small">
        模試の問題は当サイトのオリジナルで、難しさは本試験に合わせて較正されていません。正答率は目安です。受験前の最終確認には、公式問題集（<Link to={{ name: 'guide' }}>受験ガイド</Link>）をおすすめします。
      </p>
    </div>
  );
}

/* ---------- 受験 ---------- */

export function MockRun() {
  const p = useProgress();
  const m = p.activeMock;
  const now = useNow(1000);
  const today = useToday();
  const [index, setIndex] = useState(0);
  const [palette, setPalette] = useState(false);
  const [ending, setEnding] = useState(false);

  const finish = () => {
    let id: string | undefined;
    update((prev) => {
      const r = finishMock(course, prev, Date.now(), today);
      id = r.result?.id;
      return r.progress;
    });
    navigate(id ? { name: 'result', id } : { name: 'mock' }, { replace: true });
    window.scrollTo(0, 0);
  };

  const expired = !!m && now >= m.endsAt;
  useEffect(() => {
    if (expired) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  if (!m) {
    return (
      <div className="stack">
        <p className="notice">受験中の模試はありません。</p>
        <Link to={{ name: 'mock' }} className="btn btn--primary">
          模試のページへ
        </Link>
      </div>
    );
  }

  const total = m.questionIds.length;
  const entry = lookup(course, m.questionIds[index] ?? '');
  const answeredCount = m.answers.filter((a) => a !== null).length;
  const flagged = m.flags.filter(Boolean).length;
  const remaining = m.endsAt - now;
  const go = (i: number) => {
    setIndex(Math.max(0, Math.min(total - 1, i)));
    setPalette(false);
    setEnding(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className="stack stack--lg">
      <div className="mockbar">
        <span className={`timer${remaining < 5 * 60_000 ? ' timer--low' : ''}`} role="timer" aria-label="残り時間">
          {clock(remaining)}
        </span>
        <span className="num small">
          問{index + 1} / {total}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" style={{ minHeight: 38, padding: '4px 12px' }} aria-pressed={palette} onClick={() => setPalette((v) => !v)}>
          一覧
        </button>
      </div>

      {palette ? (
        <section className="card stack" aria-label="問題の一覧">
          <p className="small muted">
            解答済み {answeredCount}/{total}・見直しの印 {flagged}（右上の点）
          </p>
          <div className="palette">
            {m.questionIds.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`${m.answers[i] !== null ? 'is-answered' : ''}${i === index ? ' is-current' : ''}${m.flags[i] ? ' is-flagged' : ''}`}
                aria-label={`問${i + 1}${m.answers[i] !== null ? '（解答済み）' : '（未解答）'}${m.flags[i] ? '（見直し）' : ''}`}
                onClick={() => go(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => { setPalette(false); setEnding(true); }}>
            採点して終了する
          </button>
        </section>
      ) : null}

      {ending ? (
        <section className="notice notice--warn stack" role="alertdialog" aria-label="採点の確認">
          <p>
            <b>採点しますか？</b> 未解答 {total - answeredCount}問・見直しの印 {flagged}問。採点すると解答は変えられません。
          </p>
          <div className="row">
            <button type="button" className="btn btn--primary" onClick={finish}>
              採点する
            </button>
            <button type="button" className="btn" onClick={() => setEnding(false)}>
              解答に戻る
            </button>
          </div>
        </section>
      ) : null}

      {entry ? (
        <QuestionView
          key={entry.question.id}
          q={entry.question}
          selected={m.answers[index] ?? undefined}
          onSelect={(c) => update((prev) => answerMock(prev, index, prev.activeMock?.answers[index] === c ? null : c))}
        />
      ) : (
        <p className="notice">この問題は表示できません（教材の更新で削除されました）。次の問題へ進んでください。</p>
      )}

      <label className="row" style={{ cursor: 'pointer' }}>
        <input type="checkbox" id="mock-flag" checked={m.flags[index] ?? false} onChange={(e) => update((prev) => flagMock(prev, index, e.target.checked))} />
        あとで見直す（印を付ける）
      </label>

      <div className="sticky-actions">
        <button type="button" className="btn" disabled={index === 0} onClick={() => go(index - 1)}>
          前へ
        </button>
        {index + 1 < total ? (
          <button type="button" className="btn btn--primary" onClick={() => go(index + 1)}>
            次へ
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => { setEnding(true); window.scrollTo(0, 0); }}>
            採点へ進む
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- 結果 ---------- */

export function MockResultPage({ id }: { id: string }) {
  const p = useProgress();
  const m = p.mocks.find((x) => x.id === id);
  if (!m) {
    return (
      <div className="stack">
        <p className="notice">この模試の結果は見つかりませんでした。</p>
        <Link to={{ name: 'mock' }} className="btn btn--primary">
          模試のページへ
        </Link>
      </div>
    );
  }
  const bp = blueprintFor(course, m.grade);
  const total = m.questionIds.length;
  const percent = mockPercent(m);
  const rows = m.questionIds.map((qid, i) => {
    const e = lookup(course, qid);
    return { i, e, choice: m.answers[i] ?? null, ok: !!e && m.answers[i] === e.question.answer };
  });
  const domains = course.curriculum.domains
    .map((d) => {
      const rs = rows.filter((r) => r.e && course.units.get(r.e.unitId)?.domain === d.id);
      return { title: d.title, total: rs.length, right: rs.filter((r) => r.ok).length };
    })
    .filter((d) => d.total > 0);
  const weak = missedUnits(course, m);
  const pass = bp ? percent >= bp.passLine : false;
  const safe = bp ? percent >= bp.safeLine : false;

  return (
    <div className="stack stack--lg">
      <div>
        <p className="eyebrow">
          {formatJa(m.date)}・{m.grade}級の模試
        </p>
        <h1 className="page-title">模試の結果</h1>
      </div>
      <section className="card stack">
        <p className="result-score">
          <b>{percent}</b>
          <span className="num">
            % （{m.correct} / {total}問）
          </span>
        </p>
        <p className="row">
          <span className={`chip ${safe ? 'chip--good' : pass ? 'chip--accent' : 'chip--warn'}`}>
            {safe ? `安全圏（${bp?.safeLine}%以上）` : pass ? `合格基準（${bp?.passLine}点）以上・安全圏まであと少し` : `合格基準（${bp?.passLine}点）に届いていません`}
          </span>
          <span className="small muted num">所要時間 {Math.round(m.seconds / 60)}分</span>
        </p>
        <p className="small">
          初見の問題 {m.unseen}問のうち <b className="num">{m.unseenCorrect}</b>問正解
          {m.unseen > 0 ? `（${Math.round((m.unseenCorrect / m.unseen) * 100)}%）` : ''}。
          {m.unseen < total ? '見たことのある問題を含むため、全体の正答率は実力より高く出ている可能性があります。' : ''}
        </p>
        <p className="small muted">本試験は出題のばらつきがあるため、初見の問題で安定して8割を取れることを受験の目安にしています。この正答率は本試験の合否を保証するものではありません。</p>
      </section>

      <section className="card stack">
        <h2 className="section-title">分野ごとの正答</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">分野</th>
                <th scope="col">正答 / 出題</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.title}>
                  <th scope="row">{d.title}</th>
                  <td>
                    {d.right} / {d.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">1分野あたりの問題数が少ないので、1回の結果だけで得意・不得意を決めつけないでください。</p>
      </section>

      {weak.length > 0 ? (
        <section className="card stack">
          <h2 className="section-title">見直す単元</h2>
          <ul className="step-list">
            {weak.map((uid) => (
              <li key={uid}>
                <div className="step-list__body">
                  <Link to={{ name: 'unit', id: uid }}>{course.units.get(uid)?.title}</Link>
                </div>
                <span className="chip chip--warn num">{rows.filter((r) => r.e?.unitId === uid && !r.ok).length}問</span>
              </li>
            ))}
          </ul>
          <Link to={{ name: 'drill' }} className="btn btn--block">
            これらの単元の補強ドリル（10問）
          </Link>
        </section>
      ) : null}

      <section className="card stack">
        <h2 className="section-title">全問の解説</h2>
        <p className="small muted">間違えた問題は、明日の復習にも出ます。</p>
        <div>
          {rows.map((r) => (
            <details className="review-item" key={r.i}>
              <summary>
                <span className="num">問{r.i + 1}</span> {r.ok ? '○' : r.choice === null ? '×（未解答）' : '×'} <span style={{ fontWeight: 500 }}>{r.e?.question.skill ?? ''}</span>
              </summary>
              {r.e ? (
                <div className="stack">
                  <QuestionView q={r.e.question} selected={r.choice} reveal />
                  <Feedback q={r.e.question} choice={r.choice} />
                </div>
              ) : (
                <p className="small muted">この問題は教材の更新で削除されました。</p>
              )}
            </details>
          ))}
        </div>
      </section>

      <Link to={{ name: 'home' }} className="btn btn--primary btn--block">
        次の一歩へ
      </Link>
    </div>
  );
}
