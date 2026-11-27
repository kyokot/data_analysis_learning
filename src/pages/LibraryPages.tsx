/** 資料室: 教材リスト・受験ガイド・設定とバックアップ・このサイトについて・図表ギャラリー */
import { useState } from 'react';
import { APP_NAME, REPO_URL } from '../config.ts';
import { blindVerified, course, examGuide } from '../content/index.ts';
import type { Grade, Provider } from '../content/types.ts';
import { isValidDateStr, toDateStr } from '../engine/dates.ts';
import { emptyProgress } from '../engine/model.ts';
import { updateSettings } from '../engine/progress.ts';
import { exportBackup, importBackup } from '../store/storage.ts';
import { replaceProgress, update, useProgress } from '../store/store.ts';
import { typeLabel } from '../ui/common.tsx';
import { FigureView } from '../ui/figures/Figure.tsx';
import { useToday } from '../ui/hooks.ts';
import { Rich } from '../ui/RichText.tsx';
import { Ext, Link, navigate } from '../ui/router.tsx';

const KIND: Record<Provider['kind'], string> = {
  official: '公式',
  public: '公的機関',
  university: '大学',
  textbook: 'Web教科書',
  math: '数学の学び直し',
  video: '動画',
  interactive: '触って学ぶ',
  practice: '問題演習・模試',
  data: '実データ',
};
const TIER: Record<Provider['tier'], string> = { S: '主教材', A: '補助', B: '必要に応じて' };

export function LibraryPage() {
  const kinds = Object.keys(KIND) as Provider['kind'][];
  const used = new Set(course.resources.links.map((l) => l.providerId));
  const general = course.resources.links.filter((l) => l.unitIds.length === 0);
  return (
    <div className="stack stack--lg">
      <div className="stack">
        <h1 className="page-title">資料室</h1>
        <p className="muted small">学習は「今日の一歩」から進めれば足ります。ここは、試験の手続きや教材の全体像を確かめたいときの置き場です。</p>
      </div>
      <nav className="card" aria-label="資料室の項目">
        <ul className="step-list">
          <li>
            <div className="step-list__body">
              <Link to={{ name: 'guide' }}>受験ガイド</Link>
              <p className="small muted">試験の形式・申込先・当日の持ち物・公式問題集</p>
            </div>
          </li>
          <li>
            <div className="step-list__body">
              <Link to={{ name: 'data' }}>設定とバックアップ</Link>
              <p className="small muted">目標の級・1日の学習時間・受験予定日・進み具合の書き出し</p>
            </div>
          </li>
          <li>
            <div className="step-list__body">
              <Link to={{ name: 'about' }}>このサイトについて</Link>
              <p className="small muted">非公式である旨・問題の作り方・リンクの方針</p>
            </div>
          </li>
        </ul>
      </nav>

      <section className="stack" aria-labelledby="providers">
        <h2 className="section-title" id="providers">
          案内している無料教材
        </h2>
        <p className="small muted">各単元のページで、読む順番と読みどころを付けて案内しているサイトの一覧です。内容の著作権は各サイトにあり、当サイトはリンクで案内するだけです。</p>
        {kinds.map((k) => {
          const ps = course.resources.providers.filter((p) => p.kind === k && used.has(p.id));
          if (ps.length === 0) return null;
          return (
            <div className="card stack" key={k}>
              <h3 className="eyebrow">{KIND[k]}</h3>
              <ul className="stack">
                {ps.map((p) => (
                  <li key={p.id} className="stack" style={{ gap: 2 }}>
                    <div className="row">
                      <Ext href={p.url} style={{ fontWeight: 700 }}>
                        {p.name} ↗
                      </Ext>
                      <span className="chip">{TIER[p.tier]}</span>
                      {p.free !== 'free' ? <span className="chip chip--warn">{p.free === 'freemium' ? '一部有料' : '有料'}</span> : null}
                      {p.loginRequired === 'yes' ? <span className="chip">要登録</span> : null}
                    </div>
                    <p className="small">{p.description}</p>
                    <p className="small muted">運営: {p.operator}</p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {course.resources.providers.length === 0 ? <p className="notice">教材リストは準備中です。</p> : null}
      </section>

      {general.length > 0 ? (
        <section className="card stack" aria-labelledby="general">
          <h2 className="section-title" id="general">
            試験全体に関わる資料・追加の演習
          </h2>
          <ul className="stack">
            {general.map((l) => (
              <li key={l.id} className="stack" style={{ gap: 2 }}>
                <div className="row">
                  <span className="chip">{typeLabel(l.type)}</span>
                  <Ext href={l.url} style={{ fontWeight: 700 }}>
                    {l.title} ↗
                  </Ext>
                </div>
                <p className="small">{l.focus}</p>
                {l.note ? <p className="small muted">{l.note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function GuidePage() {
  return (
    <div className="stack stack--lg">
      <div className="stack">
        <p className="eyebrow">
          <Link to={{ name: 'library' }}>資料室</Link>
        </p>
        <h1 className="page-title">受験ガイド</h1>
        <p className="notice small">
          {examGuide.checkedOn}時点。{examGuide.basis}
        </p>
      </div>
      {examGuide.grades.map((g) => (
        <section className="card stack" key={g.grade}>
          <h2 className="section-title">統計検定{g.grade}級</h2>
          <div className="table-wrap">
            <table className="data-table">
              <tbody>
                {(
                  [
                    ['レベル', g.level],
                    ['形式', g.format],
                    ['問題数', g.questions],
                    ['試験時間', g.minutes],
                    ['合格基準', g.passLine],
                    ['受験料', g.fee],
                    ['持ち物', g.tools],
                  ] as const
                ).map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td className="is-text">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <section className="card stack">
        <h2 className="section-title">当日までにやっておくこと</h2>
        <ul className="bullets">
          <li><span>本番で使う電卓を決め、模試や練習で同じ電卓を使う（平方根キーの位置に慣れておく）。</span></li>
          <li><span>30問を60分で解くので、1問あたり平均2分。図表の読み取りは速く、計算は確実に。迷う問題は印を付けて後回しにする。</span></li>
          <li><span>CBT方式では、パソコンの画面で問題を読み、選択肢をクリックして答える。このサイトの模試で、画面上で図表を読む感覚に慣れておく。</span></li>
          <li><span>申込は試験会場ごとに行う。受験の流れ・本人確認書類・持ち込めるものは、下の公式ページで必ず確かめる。</span></li>
        </ul>
      </section>
      <section className="card stack">
        <h2 className="section-title">公式ページ</h2>
        <ul className="stack">
          {examGuide.links.map((l) => (
            <li key={l.url}>
              <Ext href={l.url}>{l.title} ↗</Ext>
              {l.note ? <span className="small muted">（{l.note}）</span> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="card stack">
        <h2 className="section-title">買うなら、この本</h2>
        <p className="small muted">無料教材とこのサイトだけでも学習は進められますが、本試験との難しさ・形式のずれを確かめるには公式の問題集がいちばん確実です。当サイトは書籍の販売で報酬を受け取っていません。</p>
        <ul className="stack">
          {examGuide.books.map((b) => (
            <li key={b.title} className="stack" style={{ gap: 2 }}>
              <p style={{ fontWeight: 700 }}>{b.title}</p>
              <p className="small muted">
                {b.publisher}・{b.price}
              </p>
              <p className="small">{b.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function DataPage() {
  const p = useProgress();
  const today = useToday();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState<'import' | 'reset' | null>(null);
  const [copied, setCopied] = useState(false);
  const backup = exportBackup(p);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(backup);
      setCopied(true);
    } catch {
      (document.getElementById('backup-out') as HTMLTextAreaElement | null)?.select();
      setCopied(false);
      setMessage('自動でコピーできませんでした。選択された文字列を手動でコピーしてください。');
    }
    update((prev) => ({ ...prev, lastBackupOn: today }));
  };
  const doImport = () => {
    const next = importBackup(text);
    setAsking(null);
    if (!next) {
      setMessage('読み込めませんでした。バックアップの文字列を、最初の { から最後の } まで貼り付けてください。');
      return;
    }
    replaceProgress({ ...next, lastBackupOn: today });
    setText('');
    setMessage('バックアップから復元しました。');
  };

  return (
    <div className="stack stack--lg">
      <div className="stack">
        <p className="eyebrow">
          <Link to={{ name: 'library' }}>資料室</Link>
        </p>
        <h1 className="page-title">設定とバックアップ</h1>
      </div>

      <section className="card stack" aria-labelledby="set">
        <h2 className="section-title" id="set">
          学習の設定
        </h2>
        <div className="field">
          <span className="label">目標の級</span>
          <div className="segmented" role="radiogroup" aria-label="目標の級">
            {([4, 3] as Grade[]).map((g) => (
              <label key={g}>
                <input type="radio" name="goal" id={`set-goal-${g}`} checked={p.settings.goal === g} onChange={() => update((prev) => updateSettings(prev, { goal: g }))} />
                <span>{g}級まで</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">1日の学習時間</span>
          <div className="segmented" role="radiogroup" aria-label="1日の学習時間">
            {[20, 40, 60, 90].map((m) => (
              <label key={m}>
                <input type="radio" name="minutes" id={`set-min-${m}`} checked={p.settings.minutesPerDay === m} onChange={() => update((prev) => updateSettings(prev, { minutesPerDay: m }))} />
                <span>{m}分</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="set-exam">受験予定日（空欄で未定）</label>
          <input
            className="input"
            id="set-exam"
            type="date"
            value={p.settings.examDate ?? ''}
            onChange={(e) => update((prev) => updateSettings(prev, { examDate: isValidDateStr(e.target.value) ? e.target.value : undefined }))}
          />
        </div>
      </section>

      <section className="card stack" aria-labelledby="bk">
        <h2 className="section-title" id="bk">
          バックアップ
        </h2>
        <p className="small muted">
          進み具合はこの端末のブラウザにだけ保存されています。ブラウザのデータを消したり、しばらく開かなかったりすると失われることがあります。下の文字列をメモアプリなどに保存しておけば、いつでも元に戻せます。
        </p>
        <div className="field">
          <label htmlFor="backup-out">この端末の進み具合（バックアップ用の文字列）</label>
          <textarea className="input" id="backup-out" readOnly value={backup} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <button type="button" className="btn" onClick={copy}>
          {copied ? 'コピーしました' : 'バックアップをコピー'}
        </button>
        {p.lastBackupOn ? <p className="small muted">最後にバックアップした日: {p.lastBackupOn}</p> : null}

        <div className="field">
          <label htmlFor="backup-in">バックアップから復元する</label>
          <textarea className="input" id="backup-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="保存しておいた文字列を貼り付け" />
        </div>
        {asking === 'import' ? (
          <div className="notice notice--warn stack">
            <p>いまの進み具合を、貼り付けたバックアップの内容で置き換えます。</p>
            <div className="row">
              <button type="button" className="btn btn--primary" onClick={doImport}>
                置き換える
              </button>
              <button type="button" className="btn" onClick={() => setAsking(null)}>
                やめる
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn" disabled={!text.trim()} onClick={() => setAsking('import')}>
            復元する
          </button>
        )}
        {message ? (
          <p className="notice" role="status">
            {message}
          </p>
        ) : null}
      </section>

      <section className="card stack" aria-labelledby="reset">
        <h2 className="section-title" id="reset">
          最初からやり直す
        </h2>
        {asking === 'reset' ? (
          <div className="notice notice--warn stack">
            <p>すべての進み具合（合格した単元・模試の結果・復習の予定）を消します。元に戻せません。</p>
            <div className="row">
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  replaceProgress(emptyProgress(toDateStr(new Date())));
                  setAsking(null);
                  navigate({ name: 'home' });
                }}
              >
                すべて消す
              </button>
              <button type="button" className="btn" onClick={() => setAsking(null)}>
                やめる
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--danger" onClick={() => setAsking('reset')}>
            進み具合をすべて消す
          </button>
        )}
      </section>
    </div>
  );
}

export function AboutPage() {
  const units = course.content.size;
  const questions = course.questions.size;
  const verified = [...course.content.keys()].filter((id) => blindVerified[id]).length;
  return (
    <div className="stack stack--lg">
      <div className="stack">
        <p className="eyebrow">
          <Link to={{ name: 'library' }}>資料室</Link>
        </p>
        <h1 className="page-title">このサイトについて</h1>
      </div>
      <section className="card stack">
        <h2 className="section-title">非公式の学習支援サイトです</h2>
        <p>
          {APP_NAME}は、個人が作成した非公式の学習支援サイトです。「統計検定」は一般財団法人統計質保証推進協会の登録商標です。当サイトは同協会・日本統計学会・試験の運営会社とは関係がなく、公認・推薦も受けていません。試験の内容・日程・料金は、必ず公式サイトで確認してください。
        </p>
      </section>
      <section className="card stack">
        <h2 className="section-title">何をするサイトか</h2>
        <ul className="bullets">
          <li><span>公式の出題範囲表をもとに、学ぶ内容を小さな単元に分け、学ぶ順番を決めています。</span></li>
          <li><span>各単元で、無料で読める外部教材を1本選び、読みどころを添えて案内します。教材の本文は転載せず、リンクで案内するだけです。</span></li>
          <li><span>読んだかどうかではなく、確認テストに合格したかどうかで先へ進みます。翌日以降の「定着チェック」に通って、はじめて定着とみなします。</span></li>
          <li><span>間違えた問題は1日後・3日後・7日後に出し直します。模試は、練習では出さない専用の問題から出します。</span></li>
        </ul>
      </section>
      <section className="card stack">
        <h2 className="section-title">問題と要点について</h2>
        <p>
          現在 <b className="num">{units}</b> 単元・<b className="num">{questions}</b> 問を収録しています。このほか、計算問題は <b className="num">{course.generators.size}</b> 種類の「類題」を、数値を変えて何問でも作れます（正答はプログラムで計算し、誤答はよくある取り違えから作ります。模試には使いません）。問題と要点はすべてこのサイトのオリジナルで、公式問題・市販の問題集・他サイトの問題を写したものではありません（題材とデータは架空です）。
        </p>
        <p>
          作成にはAIを使い、数値が絡む問題は作成時にプログラムで再計算しています。正答を隠した別のAIによる解き直し検証は、{units}単元のうち <b className="num">{verified}</b> 単元で完了しています。ただし作成と検証は同じ系統のAIなので、共通の思い込みは見逃すおそれがあり、統計の専門家による監修も受けていません。誤りが残っている可能性があるので、疑問に思ったら公式テキストで確かめ、各問題の「誤りを報告」から知らせてください。
        </p>
        <p className="small muted">定義の統一: 分散・標準偏差は n で割る定義、四分位数は高校数学Iの方式を使っています。外部教材の中には定義が異なるものがあります。</p>
      </section>
      <section className="card stack">
        <h2 className="section-title">データの扱い</h2>
        <p>登録は不要です。進み具合はお使いの端末のブラウザにだけ保存され、外部には送信しません。アクセス解析や広告は入れていません。外部教材のリンクを開いた先では、各サイトの方針が適用されます。</p>
      </section>
      <section className="card stack">
        <h2 className="section-title">誤りの報告・ソースコード</h2>
        <p>
          <Ext href={`${REPO_URL}/issues`}>問題・リンクの誤りを報告する ↗</Ext>
        </p>
        <p className="small muted">
          数式の表示に KaTeX、画面に React を使っています（どちらも MIT ライセンス）。<Link to={{ name: 'figures' }}>図表の一覧（作成者向け）</Link>
        </p>
      </section>
    </div>
  );
}

/** 作成者向け: すべての図表を並べて、表示崩れがないかを目で確かめる */
export function FiguresPage() {
  return (
    <div className="stack stack--lg">
      <h1 className="page-title">図表の一覧（作成者向け）</h1>
      {course.curriculum.units.map((u) => {
        const c = course.content.get(u.id);
        if (!c) return null;
        const figs = [
          ...(c.lesson.example.figure ? [{ id: `${u.id}（例題）`, stem: c.lesson.example.problem, figure: c.lesson.example.figure }] : []),
          ...c.questions.filter((q) => q.figure).map((q) => ({ id: q.id, stem: q.stem, figure: q.figure! })),
        ];
        if (figs.length === 0) return null;
        return (
          <section key={u.id} className="stack" data-unit={u.id}>
            <h2 className="section-title">{u.title}</h2>
            {figs.map((f) => (
              <div key={f.id} className="card stack" data-figure={f.id}>
                <p className="eyebrow num">{f.id}</p>
                <Rich text={f.stem} className="small" />
                <FigureView figure={f.figure} />
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
