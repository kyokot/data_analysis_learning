import { useMemo } from 'react';
import { course } from '../content/index.ts';
import { diffDays, formatJa } from '../engine/dates.ts';
import { unitProgress } from '../engine/model.ts';
import { blueprintFor, computePace, computeReadiness, mockPercent, pendingRefreshers, planToday, type Step } from '../engine/planner.ts';
import { isPersisted, useProgress } from '../store/store.ts';
import { hours, rng } from '../ui/common.tsx';
import { useToday } from '../ui/hooks.ts';
import { Link, type Route } from '../ui/router.tsx';

interface StepView {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  to: Route;
}

function describe(step: Step, p: ReturnType<typeof useProgress>): StepView {
  switch (step.kind) {
    case 'review': {
      const confirms = step.plan.confirms.map((c) => course.units.get(c.unitId)?.title ?? '').filter(Boolean);
      const parts: string[] = [];
      if (confirms.length) parts.push(`定着チェック: ${confirms.join('・')}`);
      if (step.plan.retries.length) parts.push(`間違えた問題の出し直し ${step.plan.retries.length}問`);
      return {
        eyebrow: '復習',
        title: `今日の復習（${step.questions}問）`,
        body: `${parts.join('／')}。忘れかけた頃に思い出すのが、いちばん記憶に残ります。${step.plan.deferred > 0 ? `残り${step.plan.deferred}件は明日以降に回します。` : ''}`,
        cta: '復習を始める',
        to: { name: 'review' },
      };
    }
    case 'unit': {
      const u = course.units.get(step.unitId)!;
      const up = unitProgress(p, u.id);
      const refresh = pendingRefreshers(course, p, u);
      return step.phase === 'start'
        ? {
            eyebrow: '次の単元',
            title: u.title,
            body: `目安${u.minutes}分。無料教材を読んで、5問の確認テストまで進みます。${refresh.length ? `計算に不安があれば、先に補習「${refresh[0]!.title}」を。` : ''}`,
            cta: 'この単元を始める',
            to: { name: 'unit', id: u.id },
          }
        : {
            eyebrow: '学習中の単元',
            title: u.title,
            body: up.attempts > 0 ? `確認テストは${up.lastCheck?.correct ?? 0}/${up.lastCheck?.total ?? 5}問でした。解説と教材を見直して、もう一度挑戦しましょう。` : '教材を読み終えたら、確認テストへ進みましょう。',
            cta: '続きから',
            to: { name: 'unit', id: u.id },
          };
    }
    case 'mock': {
      const bp = blueprintFor(course, step.grade);
      const base = `${bp?.questions ?? 30}問・${bp?.minutes ?? 60}分。`;
      if (step.reason === 'milestone')
        return { eyebrow: '腕試し', title: '4級の模試を受けてみる', body: `4級の範囲をひととおり終えました。${base}3級へ進む前に、土台が固まっているかを確かめられます（あとで受けても構いません）。`, cta: '模試のページへ', to: { name: 'mock' } };
      if (step.reason === 'first')
        return { eyebrow: '総仕上げ', title: `${step.grade}級の模試を受ける`, body: `全単元の確認テストに合格しました。${base}まだ見ていない模試専用の問題で、初見の実力を確かめます。`, cta: '模試のページへ', to: { name: 'mock' } };
      return { eyebrow: '総仕上げ', title: `${step.grade}級の模試にもう一度挑戦`, body: `${base}弱点を補強したら、もう一度測りましょう。`, cta: '模試のページへ', to: { name: 'mock' } };
    }
    case 'weak': {
      const names = step.unitIds.map((id) => course.units.get(id)?.title ?? '').slice(0, 4);
      return {
        eyebrow: '弱点の補強',
        title: '模試で落とした単元を補強する',
        body: `${names.join('・')}${step.unitIds.length > 4 ? ' ほか' : ''}。単元の教材を見直してから、補強ドリルで確かめます。`,
        cta: '補強ドリル（10問）',
        to: { name: 'drill' },
      };
    }
    case 'ready':
      return {
        eyebrow: '受験の目安',
        title: '受験の目安に届きました',
        body: `全単元に合格し、${step.grade}級の模試で8割を超えました。公式問題集で初見の実力を最終確認し、受験を申し込みましょう。`,
        cta: '受験ガイドを見る',
        to: { name: 'guide' },
      };
    case 'rest':
      return { eyebrow: '今日の分', title: '今日やることは終わりです', body: '定着チェックは明日以降に出ます。余力があれば、ルートから好きな単元を復習できます。', cta: 'ルートを見る', to: { name: 'route' } };
  }
}

export function Home() {
  const p = useProgress();
  const today = useToday();
  const steps = useMemo(() => planToday(course, p, today, rng), [p, today]);
  const pace = useMemo(() => computePace(course, p, today), [p, today]);
  const ready = useMemo(() => computeReadiness(course, p), [p]);
  const first = describe(steps[0]!, p);
  const rest = steps.slice(1).map((s) => describe(s, p));
  const bp = blueprintFor(course, ready.goal);
  const todayLog = p.days[today];
  const needBackup = ready.done > 0 && (!p.lastBackupOn || diffDays(p.lastBackupOn, today) > 14);

  let paceText: string;
  if (pace.remainingMinutes === 0) paceText = '学習ルートを最後まで進みました。';
  else if (pace.daysLeft !== undefined && pace.daysLeft <= 0) paceText = `残りの学習は${hours(pace.remainingMinutes)}。受験予定日を過ぎています（資料室で変更できます）。`;
  else if (pace.requiredPerDay) paceText = `受験予定日まであと${pace.daysLeft}日。残り${hours(pace.remainingMinutes)}なので、1日${pace.requiredPerDay}分のペースで間に合います。`;
  else if (pace.daysLeft !== undefined) paceText = `受験予定日まであと${pace.daysLeft}日。今のペース（1日${p.settings.minutesPerDay}分）なら${formatJa(pace.finishOn)}ごろに終わります。`;
  else paceText = `残りの学習は${hours(pace.remainingMinutes)}。1日${p.settings.minutesPerDay}分のペースなら${formatJa(pace.finishOn)}ごろに終わります。`;

  return (
    <div className="stack stack--lg">
      <div className="hero">
        <p className="eyebrow">目標: 統計検定{ready.goal}級</p>
        <div className="meter" role="img" aria-label={`${ready.total}単元のうち${ready.done}単元に合格、そのうち${ready.mastered}単元が定着`}>
          <span className="meter__a" style={{ width: `${(ready.mastered / Math.max(1, ready.total)) * 100}%` }} />
          <span className="meter__b" style={{ width: `${((ready.done - ready.mastered) / Math.max(1, ready.total)) * 100}%` }} />
        </div>
        <p className="hero__meta">{paceText}</p>
      </div>

      {!isPersisted() ? <p className="notice notice--warn">このブラウザでは進み具合を保存できません（プライベートブラウズなど）。ページを閉じると記録が消えます。</p> : null}

      <section className="step-card" aria-labelledby="today-step">
        <p className="eyebrow">今日の一歩｜{first.eyebrow}</p>
        <h1 className="step-card__title" id="today-step">
          {first.title}
        </h1>
        <p>{first.body}</p>
        <Link to={first.to} className="btn btn--primary btn--block">
          {first.cta}
        </Link>
      </section>

      {rest.length > 0 ? (
        <section className="card stack" aria-labelledby="after-step">
          <h2 className="section-title" id="after-step">
            そのあと
          </h2>
          <ol className="step-list">
            {rest.map((s, i) => (
              <li key={i}>
                <span className="step-list__n num">{i + 2}</span>
                <div className="step-list__body">
                  <p className="small muted">{s.eyebrow}</p>
                  <p>
                    <Link to={s.to}>{s.title}</Link>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="stats" aria-label="進み具合の要約">
        <div className="stat">
          <p className="stat__label">合格した単元</p>
          <p className="stat__value num">
            {ready.done}
            <small> / {ready.total}</small>
          </p>
        </div>
        <div className="stat">
          <p className="stat__label">直近の模試</p>
          <p className="stat__value num">
            {ready.lastMock ? mockPercent(ready.lastMock) : '—'}
            <small>{ready.lastMock ? `% （基準${bp?.passLine}）` : ' 未受験'}</small>
          </p>
        </div>
        <div className="stat">
          <p className="stat__label">今日解いた問題</p>
          <p className="stat__value num">
            {todayLog?.answered ?? 0}
            <small> 問</small>
          </p>
        </div>
      </section>

      {needBackup ? (
        <p className="notice">
          進み具合はこの端末のブラウザにだけ保存されています。ブラウザのデータ消去に備えて、<Link to={{ name: 'data' }}>バックアップ</Link>を取っておくと安心です。
        </p>
      ) : null}
    </div>
  );
}
