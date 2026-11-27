/**
 * 問題の表示と、1 問ずつ答えてすぐ解説を読む形式の出題（確認テスト・復習・補強ドリル）。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { reportUrl } from '../config.ts';
import type { Question } from '../content/types.ts';
import type { Answer } from '../engine/progress.ts';
import { FigureView } from './figures/Figure.tsx';
import { Inline, Rich } from './RichText.tsx';
import { Ext } from './router.tsx';

export const MARKS = ['①', '②', '③', '④', '⑤'];

export function QuestionView({
  q,
  selected,
  onSelect,
  reveal,
}: {
  q: Question;
  /** 選んだ選択肢。未選択は undefined、「わからない」は null */
  selected: number | null | undefined;
  onSelect?: (choice: number) => void;
  /** true で正誤を表示し、選択できなくする */
  reveal?: boolean;
}) {
  return (
    <div className="question" data-qid={q.id}>
      <Rich text={q.stem} className="question__stem" />
      {q.figure ? <FigureView figure={q.figure} /> : null}
      <ol className="choices">
        {q.choices.map((c, i) => {
          const isSel = selected === i;
          const cls = reveal ? (i === q.answer ? ' choice--correct' : isSel ? ' choice--wrong' : '') : isSel ? ' choice--selected' : '';
          return (
            <li key={i}>
              <button type="button" className={`choice${cls}`} disabled={reveal || !onSelect} aria-pressed={isSel} onClick={() => onSelect?.(i)}>
                <span className="choice__no" aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <span className="sr-only">選択肢{i + 1}: </span>
                  <Inline text={c} />
                </span>
                {reveal && i === q.answer ? <span className="choice__mark">正答</span> : reveal && isSel ? <span className="choice__mark">あなたの答え</span> : <span />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Mark({ good }: { good: boolean }) {
  return good ? (
    <svg className="verdict__mark" viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
    </svg>
  ) : (
    <svg className="verdict__mark" viewBox="0 0 34 34" aria-hidden="true">
      <path d="M8 8 L26 26 M26 8 L8 26" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** 答えたあとの解説。選んだ誤答が「どんな取り違えか」を最初に見せる */
export function Feedback({ q, choice, headingRef }: { q: Question; choice: number | null; headingRef?: React.Ref<HTMLDivElement> }) {
  const good = choice === q.answer;
  return (
    <section className="feedback" aria-live="polite">
      <div className={`verdict ${good ? 'verdict--good' : 'verdict--bad'}`} tabIndex={-1} ref={headingRef}>
        <Mark good={good} />
        {good ? '正解' : choice === null ? 'わからない → 解説を読もう' : '不正解'}
      </div>
      {!good && choice !== null ? (
        <div className="yours">
          <p className="feedback__label">あなたの答え（{MARKS[choice]}）について</p>
          <Rich text={q.choiceNotes[choice] ?? ''} />
        </div>
      ) : null}
      <div>
        <p className="feedback__label">
          正答は {MARKS[q.answer]} — 考え方
        </p>
        <Rich text={q.explanation} />
      </div>
      <details>
        <summary>ほかの選択肢はなぜ違う？</summary>
        <ol className="note-list">
          {q.choiceNotes.map((n, i) => (
            <li key={i}>
              <span className="num">{MARKS[i]}</span>
              <Rich text={n} />
            </li>
          ))}
        </ol>
      </details>
      <p className="small muted">
        {q.id.startsWith('gen:') ? '類題（数値を自動で作った問題）' : '問題番号'} <span className="num">{q.id}</span>・{q.skill}　
        <Ext href={reportUrl('問題', q.id)}>誤りを報告</Ext>
      </p>
    </section>
  );
}

export interface QuizItem {
  question: Question;
  unitId: string;
  /** 問題の上に出す見出し（例: 定着チェック｜代表値） */
  label?: string;
}

/**
 * 1 問ずつ出題する。答えるとすぐ解説を表示し、「次へ」で進む。
 * onAnswer は 1 問答えるたび、onFinish は最後の問題の解説を読み終えたときに呼ぶ。
 */
export function QuizRunner({
  items,
  onAnswer,
  onFinish,
  finishLabel = '結果を見る',
  header,
}: {
  items: QuizItem[];
  onAnswer?: (index: number, answer: Answer) => void;
  onFinish: (answers: Answer[]) => void;
  finishLabel?: string;
  header?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const item = items[index];
  const answered = answers.length > index;
  const current = answers[index];

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [index]);
  useEffect(() => {
    if (answered) feedbackRef.current?.focus({ preventScroll: true });
  }, [answered]);

  if (!item) return null;

  const answer = (choice: number | null) => {
    if (answered) return;
    const a: Answer = { questionId: item.question.id, choice };
    setAnswers((prev) => [...prev, a]);
    onAnswer?.(index, a);
  };
  const next = () => {
    if (index + 1 < items.length) setIndex(index + 1);
    else onFinish(answers);
  };

  return (
    <div className="stack stack--lg" ref={topRef} style={{ scrollMarginTop: 70 }}>
      {header}
      <div className="quiz-head">
        <span className="num small" aria-label={`${items.length}問中${index + 1}問目`}>
          {index + 1} / {items.length}
        </span>
        <div className="meter" aria-hidden="true">
          <span className="meter__a" style={{ width: `${((index + (answered ? 1 : 0)) / items.length) * 100}%` }} />
        </div>
      </div>
      {item.label ? <span className="chip chip--accent" style={{ alignSelf: 'flex-start' }}>{item.label}</span> : null}
      <QuestionView q={item.question} selected={answered ? (current?.choice ?? null) : undefined} onSelect={answered ? undefined : answer} reveal={answered} />
      {answered ? (
        <>
          <Feedback q={item.question} choice={current?.choice ?? null} headingRef={feedbackRef} />
          <div className="sticky-actions">
            <button type="button" className="btn btn--primary" onClick={next}>
              {index + 1 < items.length ? '次の問題へ' : finishLabel}
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn" onClick={() => answer(null)}>
          わからない（解説を見る）
        </button>
      )}
    </div>
  );
}
