import { useState } from 'react';
import { APP_NAME } from '../config.ts';
import { course } from '../content/index.ts';
import type { Grade } from '../content/types.ts';
import { isValidDateStr } from '../engine/dates.ts';
import { gradeUnits } from '../engine/model.ts';
import { updateSettings } from '../engine/progress.ts';
import { update } from '../store/store.ts';
import { hours } from '../ui/common.tsx';
import { useToday } from '../ui/hooks.ts';
import { navigate } from '../ui/router.tsx';

export function Welcome() {
  const today = useToday();
  const [goal, setGoal] = useState<Grade>(3);
  const [minutes, setMinutes] = useState(40);
  const [examDate, setExamDate] = useState('');
  const m4 = gradeUnits(course, 4).reduce((n, u) => n + u.minutes, 0);
  const m3 = gradeUnits(course, 3).reduce((n, u) => n + u.minutes, 0);

  const start = () => {
    update((p) => updateSettings(p, { onboarded: true, goal, minutesPerDay: minutes, examDate: isValidDateStr(examDate) && examDate > today ? examDate : undefined }));
    navigate({ name: 'home' });
    window.scrollTo(0, 0);
  };

  return (
    <div className="stack stack--lg">
      <div className="hero">
        <p className="eyebrow">統計検定4級・3級をめざす人の、非公式の独学ナビ</p>
        <h1 className="hero__title">{APP_NAME}へようこそ</h1>
        <p>
          無料で読める良い教材は、すでにたくさんあります。足りないのは「どの順に・どこを読み・本当に分かったか」を決めてくれる案内役です。このサイトは、毎日の<b>次の一歩を1つだけ</b>示し、教材を読んだあとに確認テストで定着を確かめます。
        </p>
      </div>

      <section className="card stack">
        <h2 className="section-title">目標を選ぶ</h2>
        <div className="segmented" role="radiogroup" aria-label="目標の級">
          <label>
            <input type="radio" name="goal" id="goal-4" checked={goal === 4} onChange={() => setGoal(4)} />
            <span>
              4級まで
              <small>中学卒業程度・{hours(m4)}の学習</small>
            </span>
          </label>
          <label>
            <input type="radio" name="goal" id="goal-3" checked={goal === 3} onChange={() => setGoal(3)} />
            <span>
              3級まで
              <small>4級の範囲から順に・{hours(m4 + m3)}の学習</small>
            </span>
          </label>
        </div>
        <p className="small muted">3級の出題範囲は4級の範囲を含みます。3級が目標でも、4級の範囲から順に進みます（知っている単元は確認テストに合格すれば飛ばせます）。</p>
      </section>

      <section className="card stack">
        <h2 className="section-title">1日の学習時間</h2>
        <div className="segmented" role="radiogroup" aria-label="1日の学習時間">
          {[20, 40, 60].map((m) => (
            <label key={m}>
              <input type="radio" name="minutes" id={`minutes-${m}`} checked={minutes === m} onChange={() => setMinutes(m)} />
              <span>{m}分</span>
            </label>
          ))}
        </div>
        <div className="field">
          <label htmlFor="exam-date">受験予定日（決まっていれば）</label>
          <input className="input" id="exam-date" type="date" min={today} value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        </div>
        <p className="small muted">どちらもあとから変えられます。CBT方式の試験は通年で受けられるので、予定日は未定のままでも構いません。</p>
      </section>

      <section className="notice stack">
        <p>
          <b>はじめに知っておいてほしいこと</b>
        </p>
        <ul className="bullets small">
          <li>このサイトは個人が作成した非公式の学習支援サイトです。統計検定の実施団体とは関係がありません。</li>
          <li>問題と要点はすべてオリジナルで、AIを使って作成しています。数値は再計算で確かめていますが、専門家の監修は受けていないため、誤りが残っている可能性があります。</li>
          <li>学習の中心は外部の無料教材です。このサイトは、読む順番と読みどころを案内し、理解を確かめる役目に徹します。</li>
          <li>進み具合はこの端末のブラウザにだけ保存されます。登録は不要です。</li>
        </ul>
      </section>

      <button type="button" className="btn btn--primary btn--block" onClick={start}>
        最初の一歩を見る
      </button>
    </div>
  );
}
