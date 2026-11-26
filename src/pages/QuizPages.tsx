/** 確認テスト・今日の復習・補強ドリル */
import { useRef, useState } from 'react';
import { course } from '../content/index.ts';
import { isSupportUnit, RULES, unitProgress } from '../engine/model.ts';
import { computeReadiness, latestMock, missedUnits, missingPrerequisites, doneUnitIds } from '../engine/planner.ts';
import { completeCheck, completeConfirm, isCorrect, recordAnswer, type Answer, type CheckOutcome } from '../engine/progress.ts';
import { buildReview, pickCheckQuestions, pickDrillQuestions } from '../engine/select.ts';
import { getProgress, update } from '../store/store.ts';
import { rng } from '../ui/common.tsx';
import { useToday } from '../ui/hooks.ts';
import { QuizRunner, type QuizItem } from '../ui/Quiz.tsx';
import { Link } from '../ui/router.tsx';

function Score({ correct, total }: { correct: number; total: number }) {
  return (
    <p className="result-score">
      <b>{correct}</b>
      <span className="num">/ {total} 問正解</span>
    </p>
  );
}

/* ---------- 確認テスト ---------- */

export function CheckPage({ id }: { id: string }) {
  const [attempt, setAttempt] = useState(0);
  return <CheckRun key={`${id}-${attempt}`} id={id} onRetry={() => setAttempt((a) => a + 1)} />;
}

function CheckRun({ id, onRetry }: { id: string; onRetry: () => void }) {
  const today = useToday();
  const unit = course.units.get(id);
  const [items] = useState<QuizItem[]>(() => pickCheckQuestions(course, getProgress(), id, rng).map((q) => ({ question: q, unitId: id })));
  const [outcome, setOutcome] = useState<(CheckOutcome & { answers: Answer[] }) | null>(null);

  if (!unit || items.length === 0) {
    return (
      <div className="stack">
        <p className="notice">この単元の確認テストは準備中です。</p>
        <Link to={{ name: 'route' }} className="btn">
          学習ルートへ
        </Link>
      </div>
    );
  }

  if (!outcome) {
    return (
      <QuizRunner
        items={items}
        header={
          <div>
            <p className="eyebrow">確認テスト</p>
            <h1 className="page-title">{unit.title}</h1>
          </div>
        }
        onFinish={(answers) => {
          let result: CheckOutcome | undefined;
          update((p) => {
            result = completeCheck(course, p, id, answers, today);
            return result.progress;
          });
          if (result) setOutcome({ ...result, answers });
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  const p = getProgress();
  const up = unitProgress(p, id);
  const support = isSupportUnit(course, unit);
  const missed = outcome.answers.filter((a) => !isCorrect(course, a)).map((a) => course.questions.get(a.questionId)!.question);
  const prereq = missingPrerequisites(course, p, unit);

  return (
    <div className="stack stack--lg">
      <div>
        <p className="eyebrow">確認テストの結果</p>
        <h1 className="page-title">{unit.title}</h1>
      </div>
      <div className="card stack">
        <Score correct={outcome.correct} total={outcome.total} />
        {outcome.passed ? (
          <>
            <p>
              <span className="chip chip--good">合格</span>
            </p>
            {support ? (
              <p>補習は確認できました。もとの単元に戻りましょう。</p>
            ) : up.status === 'mastered' ? (
              <p>すでに定着している単元です。この調子です。</p>
            ) : (
              <p>
                明日以降の復習に「定着チェック」（今日とは別の{RULES.confirmSize}問）が出ます。日を空けても解ければ、この単元は<b>定着</b>です。
              </p>
            )}
          </>
        ) : (
          <>
            <p>
              <span className="chip chip--warn">あと{Math.max(1, RULES.checkPass - outcome.correct)}問</span>
            </p>
            <p>合格は{RULES.checkPass}問以上です。間違えた問題は明日の復習にも出ます。いま、教材の該当箇所と要点を見直してから、もう一度挑戦しましょう（まだ出ていない問題を優先して出します）。</p>
            {up.attempts >= 2 ? (
              <p className="notice notice--accent">
                2回続けて届かないときは、説明の合う教材に替えるのが近道です。単元ページの「合わなかったら・別の角度から」を試してみてください。
                {prereq.length > 0 ? `前提の単元「${prereq[0]!.title}」に戻るのも有効です。` : ''}
              </p>
            ) : null}
          </>
        )}
        {missed.length > 0 ? (
          <div>
            <p className="eyebrow">間違えた問題で問われていたこと</p>
            <ul className="bullets">
              {missed.map((q) => (
                <li key={q.id}>
                  <span>{q.skill}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {outcome.passed ? (
        <Link to={{ name: 'home' }} className="btn btn--primary btn--block">
          次の一歩へ
        </Link>
      ) : (
        <div className="stack">
          <Link to={{ name: 'unit', id }} className="btn btn--primary btn--block">
            教材と要点を見直す
          </Link>
          <button type="button" className="btn btn--block" onClick={onRetry}>
            すぐにもう一度受ける
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- 今日の復習 ---------- */

type ReviewItem = QuizItem & { confirmUnit?: string };

export function ReviewPage() {
  const today = useToday();
  const [plan] = useState(() => buildReview(course, getProgress(), today, rng));
  const [items] = useState<ReviewItem[]>(() => [
    ...plan.confirms.flatMap((c) =>
      c.questions.map((q) => ({ question: q, unitId: c.unitId, confirmUnit: c.unitId, label: `定着チェック｜${course.units.get(c.unitId)?.title ?? ''}` })),
    ),
    ...plan.retries.map((r) => ({ question: r.question, unitId: r.unitId, label: `出し直し｜${course.units.get(r.unitId)?.title ?? ''}` })),
  ]);
  const buffers = useRef<Record<string, Answer[]>>({});
  const [confirmed, setConfirmed] = useState<{ unitId: string; passed: boolean; correct: number; total: number }[]>([]);
  const [done, setDone] = useState<Answer[] | null>(null);

  if (items.length === 0) {
    return (
      <div className="stack">
        <h1 className="page-title">今日の復習</h1>
        <p className="notice">いま出せる復習はありません。確認テストに合格した単元の「定着チェック」は翌日以降に、間違えた問題は1日後・3日後・7日後に出ます。</p>
        <Link to={{ name: 'home' }} className="btn btn--primary">
          今日の一歩へ
        </Link>
      </div>
    );
  }

  if (!done) {
    return (
      <QuizRunner
        items={items}
        header={
          <div>
            <p className="eyebrow">今日の復習</p>
            <h1 className="page-title">思い出して、定着させる</h1>
          </div>
        }
        onAnswer={(i, a) => {
          const it = items[i]!;
          if (!it.confirmUnit) {
            update((p) => recordAnswer(course, p, a, 'review', today));
            return;
          }
          const unitId = it.confirmUnit;
          const buf = (buffers.current[unitId] ??= []);
          buf.push(a);
          const size = items.filter((x) => x.confirmUnit === unitId).length;
          if (buf.length === size) {
            let r: CheckOutcome | undefined;
            update((p) => {
              r = completeConfirm(course, p, unitId, buf, today);
              return r.progress;
            });
            if (r) setConfirmed((prev) => [...prev, { unitId, passed: r!.passed, correct: r!.correct, total: r!.total }]);
          }
        }}
        onFinish={(answers) => {
          setDone(answers);
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  const retryAnswers = done.filter((_, i) => !items[i]?.confirmUnit);
  const retryRight = retryAnswers.filter((a) => isCorrect(course, a)).length;
  return (
    <div className="stack stack--lg">
      <h1 className="page-title">復習の結果</h1>
      {confirmed.length > 0 ? (
        <div className="card stack">
          <h2 className="section-title">定着チェック</h2>
          <ul className="step-list">
            {confirmed.map((c) => (
              <li key={c.unitId}>
                <div className="step-list__body">
                  <Link to={{ name: 'unit', id: c.unitId }}>{course.units.get(c.unitId)?.title}</Link>
                  <p className="small muted">
                    {c.passed ? '日を空けても解けました。この単元は定着です。' : '今回は届きませんでした。学習中に戻します。教材を見直して、確認テストからやり直しましょう。'}
                  </p>
                </div>
                <span className={`chip ${c.passed ? 'chip--good' : 'chip--warn'} num`}>
                  {c.correct}/{c.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {retryAnswers.length > 0 ? (
        <div className="card stack">
          <h2 className="section-title">間違えた問題の出し直し</h2>
          <Score correct={retryRight} total={retryAnswers.length} />
          <p className="small muted">正解した問題は間隔を空けて（3日後・7日後）もう一度出ます。間違えた問題は明日また出ます。</p>
        </div>
      ) : null}
      {plan.deferred > 0 ? <p className="notice">残り{plan.deferred}件の復習は、明日以降に回しました（1回の復習は{RULES.reviewCap}問までにしています）。</p> : null}
      <Link to={{ name: 'home' }} className="btn btn--primary btn--block">
        次の一歩へ
      </Link>
    </div>
  );
}

/* ---------- 補強ドリル ---------- */

export function DrillPage({ id }: { id?: string }) {
  const [round, setRound] = useState(0);
  return <DrillRun key={`${id ?? 'weak'}-${round}`} id={id} onAgain={() => setRound((r) => r + 1)} />;
}

function drillUnits(id?: string): string[] {
  if (id) return course.units.has(id) ? [id] : [];
  const p = getProgress();
  const last = latestMock(p, p.settings.goal);
  const fromMock = last ? missedUnits(course, last) : [];
  if (fromMock.length) return fromMock;
  const weak = computeReadiness(course, p).weakUnits.map((s) => s.unit.id);
  return weak.length ? weak : doneUnitIds(course, p);
}

function DrillRun({ id, onAgain }: { id?: string; onAgain: () => void }) {
  const today = useToday();
  const [unitIds] = useState(() => drillUnits(id));
  const [items] = useState<QuizItem[]>(() =>
    pickDrillQuestions(course, getProgress(), unitIds, 10, rng).map((q) => {
      const unitId = course.questions.get(q.id)!.unitId;
      return { question: q, unitId, label: course.units.get(unitId)?.title };
    }),
  );
  const [done, setDone] = useState<Answer[] | null>(null);
  const title = id ? (course.units.get(id)?.title ?? '練習') : '弱点の補強ドリル';

  if (items.length === 0) {
    return (
      <div className="stack">
        <h1 className="page-title">{title}</h1>
        <p className="notice">出題できる問題がまだありません。単元の確認テストに合格すると、ここで練習できるようになります。</p>
        <Link to={{ name: 'home' }} className="btn btn--primary">
          今日の一歩へ
        </Link>
      </div>
    );
  }
  if (!done) {
    return (
      <QuizRunner
        items={items}
        header={
          <div>
            <p className="eyebrow">練習（合否には関係しません）</p>
            <h1 className="page-title">{title}</h1>
          </div>
        }
        onAnswer={(_, a) => update((p) => recordAnswer(course, p, a, 'drill', today))}
        onFinish={(answers) => {
          setDone(answers);
          window.scrollTo(0, 0);
        }}
      />
    );
  }
  return (
    <div className="stack stack--lg">
      <h1 className="page-title">{title}の結果</h1>
      <div className="card stack">
        <Score correct={done.filter((a) => isCorrect(course, a)).length} total={done.length} />
        <p className="small muted">間違えた問題は、明日の復習に出ます。</p>
      </div>
      <div className="stack">
        <button type="button" className="btn btn--block" onClick={onAgain}>
          もう一度（別の問題を優先）
        </button>
        <Link to={{ name: 'home' }} className="btn btn--primary btn--block">
          今日の一歩へ
        </Link>
      </div>
    </div>
  );
}
