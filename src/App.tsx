import { useEffect, useState, type ReactNode } from 'react';
import { APP_NAME } from './config.ts';
import { course } from './content/index.ts';
import { buildReview, reviewQuestionCount } from './engine/select.ts';
import { clearAway } from './engine/progress.ts';
import { Home } from './pages/Home.tsx';
import { AboutPage, DataPage, FiguresPage, GuidePage, LibraryPage } from './pages/LibraryPages.tsx';
import { MockHub, MockResultPage, MockRun } from './pages/MockPages.tsx';
import { ProgressPage } from './pages/ProgressPage.tsx';
import { CheckPage, DrillPage, ReviewPage } from './pages/QuizPages.tsx';
import { RoutePage } from './pages/RoutePage.tsx';
import { UnitPage } from './pages/UnitPage.tsx';
import { Welcome } from './pages/Welcome.tsx';
import { getProgress, update, useProgress } from './store/store.ts';
import { rng } from './ui/common.tsx';
import { useToday } from './ui/hooks.ts';
import { Link, navigate, useRoute, type Route } from './ui/router.tsx';

const ICONS: Record<string, ReactNode> = {
  home: <path d="M12 3v18M12 5h7l-2 3 2 3h-7M12 12H6l-2 2.5L6 17h6" />,
  route: <path d="M6 20a2 2 0 100-4 2 2 0 000 4zm12-12a2 2 0 100-4 2 2 0 000 4zM6 16V9a3 3 0 013-3h7M18 8v7a3 3 0 01-3 3H8" />,
  mock: <path d="M9 4h6v3H9zM7 5.5H5.5v15h13v-15H17M9 12l2 2 4-4M9 17h6" />,
  progress: <path d="M5 20V11M12 20V5M19 20v-6M3 20h18" />,
  library: <path d="M5 4h5v16H5zM10 4h4v16h-4zM15.5 6.5l3.5-1 3 13.5-3.5 1z" />,
};

const NAV: { key: string; label: string; to: Route; match: Route['name'][] }[] = [
  { key: 'home', label: '今日', to: { name: 'home' }, match: ['home', 'review'] },
  { key: 'route', label: 'ルート', to: { name: 'route' }, match: ['route', 'unit', 'check', 'drill'] },
  { key: 'mock', label: '模試', to: { name: 'mock' }, match: ['mock', 'mockrun', 'result'] },
  { key: 'progress', label: '進み具合', to: { name: 'progress' }, match: ['progress'] },
  { key: 'library', label: '資料室', to: { name: 'library' }, match: ['library', 'guide', 'data', 'about', 'figures'] },
];

/** 問題を解いている間は、ナビを隠して集中できるようにする */
const FOCUS: Route['name'][] = ['check', 'review', 'drill', 'mockrun'];

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'route':
      return <RoutePage />;
    case 'unit':
      return <UnitPage id={route.id} />;
    case 'check':
      return <CheckPage id={route.id} />;
    case 'review':
      return <ReviewPage />;
    case 'drill':
      return <DrillPage id={route.id} />;
    case 'mock':
      return <MockHub />;
    case 'mockrun':
      return <MockRun />;
    case 'result':
      return <MockResultPage id={route.id} />;
    case 'progress':
      return <ProgressPage />;
    case 'library':
      return <LibraryPage />;
    case 'guide':
      return <GuidePage />;
    case 'data':
      return <DataPage />;
    case 'about':
      return <AboutPage />;
    case 'figures':
      return <FiguresPage />;
  }
}

/** 外部教材から戻ってきたときの声かけ */
function AwaySheet({ route }: { route: Route }) {
  const p = useProgress();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const check = () => {
      const away = getProgress().away;
      if (!away || document.visibilityState !== 'visible') return;
      const elapsed = Date.now() - away.at;
      if (elapsed > 24 * 3600_000) update(clearAway);
      else if (elapsed > 15_000) setVisible(true);
    };
    check();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  const away = p.away;
  const unit = away ? course.units.get(away.unitId) : undefined;
  if (!visible || !away || !unit || FOCUS.includes(route.name)) return null;
  const close = () => {
    update(clearAway);
    setVisible(false);
  };
  const hasCheck = course.content.has(unit.id);
  return (
    <div className="sheet" role="dialog" aria-label="おかえりなさい">
      <div className="sheet__inner">
        <p>
          <b>おかえりなさい。</b>「{unit.title}」の教材は読めましたか？ 読んだ内容は、思い出して使うと定着します。
        </p>
        <div className="row">
          {hasCheck ? (
            <button type="button" className="btn btn--primary" onClick={() => { close(); navigate({ name: 'check', id: unit.id }); window.scrollTo(0, 0); }}>
              確認テストへ
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={() => {
              close();
              navigate({ name: 'unit', id: unit.id });
              window.setTimeout(() => document.getElementById('points')?.scrollIntoView({ block: 'start' }), 60);
            }}
          >
            先に要点を見る
          </button>
          <button type="button" className="btn btn--ghost" onClick={close}>
            まだ途中
          </button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const p = useProgress();
  const today = useToday();
  const onboarded = p.settings.onboarded;
  const focus = FOCUS.includes(route.name);
  const due = onboarded ? reviewQuestionCount(buildReview(course, p, today, rng)) : 0;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name, 'id' in route ? route.id : '']);

  const infoPage = ['about', 'guide', 'figures'].includes(route.name);

  return (
    <div className={`shell${focus ? ' shell--focus' : ''}`}>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to={{ name: 'home' }} className="brand">
            <svg className="brand__mark" viewBox="0 0 26 26" aria-hidden="true">
              <path d="M12 2v22" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M12 4h9l3 3.5-3 3.5h-9z" fill="var(--accent)" />
              <path d="M12 13H5l-3 3 3 3h7z" fill="var(--ink-3)" />
            </svg>
            {APP_NAME}
            <span className="brand__sub">非公式</span>
          </Link>
          {onboarded && !focus ? (
            <nav className="topnav" aria-label="メインメニュー">
              {NAV.map((n) => (
                <Link key={n.key} to={n.to} aria-current={n.match.includes(route.name) ? 'page' : undefined}>
                  {n.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {focus ? (
            <Link to={route.name === 'mockrun' ? { name: 'mock' } : { name: 'home' }} className="small" style={{ marginLeft: 'auto' }}>
              {route.name === 'mockrun' ? '中断して戻る' : 'やめる'}
            </Link>
          ) : null}
        </div>
      </header>

      <main className="main">{onboarded || infoPage ? <Page route={route} /> : <Welcome />}</main>

      <footer className="footer">
        <p>
          {APP_NAME}は非公式の学習支援サイトです。「統計検定」は一般財団法人統計質保証推進協会の登録商標で、当サイトは同協会とは関係がありません。問題はオリジナルで、合格を保証するものではありません。
          <Link to={{ name: 'about' }}>このサイトについて</Link>
        </p>
      </footer>

      {onboarded ? (
        <nav className="tabbar" aria-label="メインメニュー">
          <ul>
            {NAV.map((n) => (
              <li key={n.key}>
                <Link to={n.to} aria-current={n.match.includes(route.name) ? 'page' : undefined}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {ICONS[n.key]}
                  </svg>
                  {n.label}
                  {n.key === 'home' && due > 0 ? (
                    <span className="tabbar__badge num" aria-label={`復習${due}問`}>
                      {due}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {onboarded ? <AwaySheet route={route} /> : null}
    </div>
  );
}
