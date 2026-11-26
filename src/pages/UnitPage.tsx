import { reportUrl } from '../config.ts';
import { course } from '../content/index.ts';
import type { ResourceLink, Unit } from '../content/types.ts';
import { formatJa } from '../engine/dates.ts';
import { isSupportUnit, RULES, unitProgress } from '../engine/model.ts';
import { missingPrerequisites, pendingRefreshers } from '../engine/planner.ts';
import { markVisited } from '../engine/progress.ts';
import { update, useProgress } from '../store/store.ts';
import { linksFor, provider, stageOf, StatusChip, typeLabel } from '../ui/common.tsx';
import { FigureView } from '../ui/figures/Figure.tsx';
import { Formula, Inline, Rich } from '../ui/RichText.tsx';
import { Ext, Link } from '../ui/router.tsx';

function searchUrl(link: ResourceLink, unit: Unit): string {
  let host = '';
  try {
    host = new URL(link.url).hostname;
  } catch {
    // 無視
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${host ? `site:${host} ` : ''}${link.search ?? unit.title}`)}`;
}

function ResourceCard({ link, unit, visited, primary }: { link: ResourceLink; unit: Unit; visited: boolean; primary?: boolean }) {
  const pr = provider(link.providerId);
  return (
    <li className={`resource${primary ? ' resource--primary' : ''}`}>
      <div className="resource__meta">
        <span className="chip">{typeLabel(link.type)}</span>
        <span>{pr?.name ?? link.providerId}</span>
        {link.minutes ? <span>目安{link.minutes}分</span> : null}
        {visited ? <span className="chip chip--good">開いた</span> : null}
      </div>
      <Ext href={link.url} className="resource__title" onClick={() => update((p) => markVisited(p, unit.id, link.id, Date.now()))}>
        {link.title}
        <span className="sr-only">（別のタブで開きます）</span> ↗
      </Ext>
      <p className="small">
        <b>読みどころ: </b>
        {link.focus}
      </p>
      {link.note ? <p className="small muted">{link.note}</p> : null}
      <p className="small muted">
        {link.verifiedOn ? `${link.verifiedOn}に内容を確認` : 'リンク先の内容は未確認（検索結果で所在のみ確認）'}・ 開けないときは
        <Ext href={searchUrl(link, unit)}>サイト内を検索</Ext>・<Ext href={reportUrl('リンク', link.id)}>報告</Ext>
      </p>
    </li>
  );
}

export function UnitPage({ id }: { id: string }) {
  const p = useProgress();
  const unit = course.units.get(id);
  if (!unit) {
    return (
      <div className="stack">
        <p className="notice">この単元は見つかりませんでした。</p>
        <Link to={{ name: 'route' }} className="btn">
          学習ルートへ
        </Link>
      </div>
    );
  }
  const content = course.content.get(id);
  const up = unitProgress(p, id);
  const support = isSupportUnit(course, unit);
  const stage = stageOf(id);
  const primary = linksFor(id, 'primary');
  const supplement = linksFor(id, 'supplement');
  const math = linksFor(id, 'math');
  const practice = linksFor(id, 'practice');
  const missing = missingPrerequisites(course, p, unit);
  const refreshers = pendingRefreshers(course, p, unit);
  const L = content?.lesson;
  const practiceCount = content?.questions.filter((q) => q.pool === 'practice').length ?? 0;

  return (
    <div className="stack stack--lg">
      <header className="stack">
        <p className="eyebrow">
          {stage?.title}・{support ? '補習' : `${unit.grade}級の範囲`}
        </p>
        <h1 className="page-title">{unit.title}</h1>
        <div className="row">
          <StatusChip status={up.status} />
          <span className="small muted">目安{unit.minutes}分</span>
        </div>
        <div className="card stack">
          <h2 className="eyebrow">この単元のゴール</h2>
          <ul className="goal-list">
            {unit.goals.map((g, i) => (
              <li key={i}>
                <span>
                  <Inline text={g} />
                </span>
              </li>
            ))}
          </ul>
          <p className="small muted">出題範囲表での位置づけ: {unit.official}</p>
        </div>
        {missing.length > 0 ? (
          <p className="notice notice--warn">
            この単元は「{missing.map((u) => u.title).join('」「')}」の内容を使います。先に
            <Link to={{ name: 'unit', id: missing[0]!.id }}>{missing[0]!.title}</Link>
            を終えるのがおすすめです。
          </p>
        ) : null}
        {refreshers.length > 0 ? (
          <p className="notice notice--accent">
            計算に不安があれば、先に補習を5〜10分:{' '}
            {refreshers.map((u, i) => (
              <span key={u.id}>
                {i > 0 ? '、' : ''}
                <Link to={{ name: 'unit', id: u.id }}>{u.title}</Link>
              </span>
            ))}
          </p>
        ) : null}
      </header>

      <div className="unit-steps">
        {L ? (
          <section className="ustep" aria-labelledby="st-ask">
            <h2 className="section-title ustep__head" id="st-ask">
              まず、この問いを見ておく
            </h2>
            <p className="small muted">いまは解けなくて大丈夫です。教材を読みながら、この問いに答えられるようになることを目指します。</p>
            <Rich text={L.example.problem} />
            {L.example.figure ? <FigureView figure={L.example.figure} /> : null}
          </section>
        ) : null}

        <section className="ustep" aria-labelledby="st-read">
          <h2 className="section-title ustep__head" id="st-read">
            無料の教材で学ぶ
          </h2>
          {primary.length > 0 ? (
            <>
              <p className="small muted">まずはこの1本。外部サイトが別のタブで開きます。読み終えたら、このタブに戻ってきてください。</p>
              <ul className="stack">
                {primary.map((l) => (
                  <ResourceCard key={l.id} link={l} unit={unit} visited={up.visited.includes(l.id)} primary />
                ))}
              </ul>
            </>
          ) : (
            <p className="notice">この単元の教材リンクは準備中です。下の要点を読み、「{unit.title}」で検索するか、資料室の教材リストから探してください。</p>
          )}
          {supplement.length > 0 ? (
            <details>
              <summary>合わなかったら・別の角度から（{supplement.length}件）</summary>
              <ul className="stack">
                {supplement.map((l) => (
                  <ResourceCard key={l.id} link={l} unit={unit} visited={up.visited.includes(l.id)} />
                ))}
              </ul>
            </details>
          ) : null}
          {math.length > 0 ? (
            <details>
              <summary>数学でつまずいたら（{math.length}件）</summary>
              <ul className="stack">
                {math.map((l) => (
                  <ResourceCard key={l.id} link={l} unit={unit} visited={up.visited.includes(l.id)} />
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        {L ? (
          <section className="ustep" aria-labelledby="st-points" id="points">
            <h2 className="section-title ustep__head" id="st-points">
              要点を整理する
            </h2>
            <Rich text={L.intro} />
            <ul className="points">
              {L.points.map((pt, i) => (
                <li key={i}>
                  <h3>
                    <Inline text={pt.title} />
                  </h3>
                  <Rich text={pt.body} />
                </li>
              ))}
            </ul>
            {(L.formulas ?? []).map((f, i) => (
              <div className="formula" key={i}>
                <p className="formula__name">{f.name}</p>
                <Formula tex={f.tex} />
                {f.note ? <Rich text={f.note} className="small" /> : null}
              </div>
            ))}
            <details>
              <summary>最初の問いの解き方を見る</summary>
              <ol className="steps-ol">
                {L.example.steps.map((s, i) => (
                  <li key={i}>
                    <Rich text={s} />
                  </li>
                ))}
              </ol>
              <div className="notice notice--accent" style={{ marginTop: 8 }}>
                <Rich text={L.example.answer} />
              </div>
            </details>
            <div>
              <h3 className="eyebrow">よくある間違い</h3>
              <ul className="bullets">
                {L.pitfalls.map((s, i) => (
                  <li key={i}>
                    <Rich text={s} />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="eyebrow">試験での問われ方</h3>
              <ul className="bullets">
                {L.examTips.map((s, i) => (
                  <li key={i}>
                    <Rich text={s} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="ustep" aria-labelledby="st-check">
          <h2 className="section-title ustep__head" id="st-check">
            確認テストで確かめる
          </h2>
          {!content ? (
            <p className="notice">この単元の確認テストは準備中です。</p>
          ) : (
            <>
              {up.status === 'mastered' ? (
                <p>
                  この単元は<b>定着</b>しています{up.masteredOn ? `（${formatJa(up.masteredOn)}）` : ''}。練習として受け直すこともできます。
                </p>
              ) : up.status === 'passed' ? (
                <p>
                  確認テストに<b>合格</b>しました。{up.confirmDue ? `${formatJa(up.confirmDue)}以降の復習に「定着チェック」（別の${RULES.confirmSize}問）が出ます。` : ''}
                </p>
              ) : (
                <p>
                  {Math.min(RULES.checkSize, practiceCount)}問のうち{RULES.checkPass}問以上の正解で合格です。読んだだけでは進みません。<b>解けたら次へ</b>進みます。
                  {up.lastCheck ? `（前回 ${up.lastCheck.correct}/${up.lastCheck.total}問）` : ''}
                </p>
              )}
              <Link to={{ name: 'check', id }} className={`btn btn--block${up.status === 'new' || up.status === 'learning' ? ' btn--primary' : ''}`}>
                {up.status === 'new' || up.status === 'learning' ? '確認テストを受ける' : '練習としてもう一度受ける'}
              </Link>
              {!support && up.status === 'new' ? <p className="small muted">すでに知っている内容なら、教材を読まずに受けて構いません。合格すれば次の単元へ進めます。</p> : null}
            </>
          )}
        </section>
      </div>

      {content || practice.length > 0 ? (
        <section className="card stack" aria-labelledby="more">
          <h2 className="section-title" id="more">
            もっと解きたいとき
          </h2>
          {content ? (
            <p>
              <Link to={{ name: 'drill', id }}>この単元の問題を続けて解く</Link>
              <span className="small muted">（合否には関係しない練習）</span>
            </p>
          ) : null}
          {practice.length > 0 ? (
            <ul className="stack">
              {practice.map((l) => (
                <ResourceCard key={l.id} link={l} unit={unit} visited={up.visited.includes(l.id)} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
