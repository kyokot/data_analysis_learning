/**
 * コンテンツ（カリキュラム・要点・問題・外部教材リンク）の型定義。
 * 実体は content/ 以下の JSON。スキーマ検証は src/content/schema.ts が行う。
 */

/** 統計検定の級。3級の範囲は4級の範囲を含む。 */
export type Grade = 4 | 3;

/**
 * 簡易マークアップ付きテキスト。
 *  - `$...$`   : インライン数式（KaTeX）
 *  - `$$...$$` : ディスプレイ数式（KaTeX）
 *  - `**...**` : 強調
 *  - 改行      : 段落区切り
 */
export type RichText = string;

export type DomainId =
  | 'math'
  | 'survey'
  | 'graphs'
  | 'summary'
  | 'relation'
  | 'timeseries'
  | 'probability'
  | 'distribution'
  | 'inference';

export interface Domain {
  id: DomainId;
  title: string;
}

export interface Stage {
  id: string;
  title: string;
  description: string;
  /** このステージの主な対象級 */
  grade: Grade;
  /** true のステージは学習ルートに含めない補習（数学の学び直し）。必要な単元の直前に案内する */
  support?: boolean;
}

export interface Unit {
  id: string;
  stageId: string;
  title: string;
  /** この単元が出題範囲に入る最も下の級 */
  grade: Grade;
  domain: DomainId;
  /** 先に習得しておくべき単元 */
  prerequisites: string[];
  /** この単元の直前に確認しておくとよい補習単元（数学） */
  refreshers?: string[];
  /** 「〜できる」の形の到達目標 */
  goals: RichText[];
  /** 外部教材での学習＋確認テストの目安時間（分） */
  minutes: number;
  /** 公式出題範囲表での対応項目（表記の要約） */
  official: string;
}

export interface MockBlueprint {
  grade: Grade;
  questions: number;
  minutes: number;
  /** 合格基準（100点満点） */
  passLine: number;
  /** 安全圏の目安（%） */
  safeLine: number;
  /** 分野ごとの出題数（合計が questions と一致する） */
  domains: Partial<Record<DomainId, number>>;
}

export interface Curriculum {
  domains: Domain[];
  stages: Stage[];
  units: Unit[];
  mocks: MockBlueprint[];
}

/* ---------- 図表 ---------- */

export interface TableFigure {
  type: 'table';
  title?: string;
  columns: string[];
  rows: (string | number)[][];
  /** true のとき各行の先頭セルを行見出しとして表示する */
  headerColumn?: boolean;
  note?: string;
}

export interface Series {
  name?: string;
  values: number[];
}

export interface BarFigure {
  type: 'bar';
  title?: string;
  xLabel?: string;
  yLabel?: string;
  categories: string[];
  series: Series[];
  /** true で積み上げ棒グラフ */
  stacked?: boolean;
  /** true で棒の上に値を表示 */
  showValues?: boolean;
}

/** 帯グラフ（構成比を横向きの 100% 帯で表す） */
export interface BandFigure {
  type: 'band';
  title?: string;
  /** 帯（行）の名前。例: 年度 */
  rows: string[];
  /** 区分ごとの構成比（%）。values[i] が rows[i] の値。各行の合計は 100 */
  segments: Series[];
  showValues?: boolean;
}

export interface PieFigure {
  type: 'pie';
  title?: string;
  slices: { label: string; value: number }[];
  /** true で各扇形に割合（%）を表示 */
  showPercent?: boolean;
}

export interface LineFigure {
  type: 'line';
  title?: string;
  xLabel?: string;
  yLabel?: string;
  /** 横軸の目盛りラベル（年・月など） */
  x: string[];
  series: Series[];
  yMin?: number;
  yMax?: number;
  showValues?: boolean;
}

export interface HistogramFigure {
  type: 'histogram';
  title?: string;
  xLabel?: string;
  yLabel?: string;
  /** 階級の境界値（等間隔・昇順）。長さは counts.length + 1 */
  edges: number[];
  /** 各階級の度数（relative が true のときは相対度数） */
  counts: number[];
  showCounts?: boolean;
  relative?: boolean;
}

export interface BoxSummary {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  /** 外れ値（ひげの外に点で表示）。min / max はひげの端の値を指す */
  outliers?: number[];
}

export interface BoxplotFigure {
  type: 'boxplot';
  title?: string;
  axisLabel?: string;
  boxes: BoxSummary[];
  axisMin?: number;
  axisMax?: number;
}

export interface ScatterFigure {
  type: 'scatter';
  title?: string;
  xLabel?: string;
  yLabel?: string;
  points: [number, number][];
  /** 回帰直線 y = intercept + slope x を重ねる */
  line?: { slope: number; intercept: number };
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
}

export interface DotplotFigure {
  type: 'dotplot';
  title?: string;
  axisLabel?: string;
  /** 整数値のデータ */
  values: number[];
}

export interface StemLeafFigure {
  type: 'stemleaf';
  title?: string;
  stemLabel?: string;
  leafLabel?: string;
  rows: { stem: string; leaves: string[] }[];
  note?: string;
}

export interface NormalFigure {
  type: 'normal';
  title?: string;
  xLabel?: string;
  mean: number;
  sd: number;
  /** 塗りつぶす区間。from 省略で左端から、to 省略で右端まで */
  shade?: { from?: number; to?: number }[];
  /** 横軸に目盛りとして表示する値（省略時は μ, μ±σ, μ±2σ, μ±3σ） */
  marks?: number[];
}

export type SingleFigure =
  | TableFigure
  | BarFigure
  | BandFigure
  | PieFigure
  | LineFigure
  | HistogramFigure
  | BoxplotFigure
  | ScatterFigure
  | DotplotFigure
  | StemLeafFigure
  | NormalFigure;

/** 複数の図を並べる（「次の①〜④のうち…」形式）。入れ子にはできない */
export interface PanelsFigure {
  type: 'panels';
  title?: string;
  panels: { label: string; figure: SingleFigure }[];
}

export type Figure = SingleFigure | PanelsFigure;

/* ---------- 要点（当サイトのオリジナル解説） ---------- */

export interface Lesson {
  /** この単元を学ぶ理由・全体像（1〜2文） */
  intro: RichText;
  points: { title: string; body: RichText }[];
  formulas?: { name: string; tex: string; note?: RichText }[];
  example: {
    problem: RichText;
    figure?: Figure;
    steps: RichText[];
    answer: RichText;
  };
  /** よくある間違い */
  pitfalls: RichText[];
  /** 試験での問われ方 */
  examTips: RichText[];
}

/* ---------- 問題 ---------- */

export type Difficulty = 1 | 2 | 3;

/** practice = 確認テスト・復習用 / exam = 模試専用（初見の実力を測るために取り置く） */
export type QuestionPool = 'practice' | 'exam';

export interface Question {
  id: string;
  /** この問題が出題範囲に入る最も下の級 */
  grade: Grade;
  /** 1 = 基礎の確認, 2 = 本試験の標準, 3 = 本試験のやや難 */
  difficulty: Difficulty;
  pool: QuestionPool;
  /** この問題で問う技能（短い名詞句） */
  skill: string;
  stem: RichText;
  figure?: Figure;
  choices: RichText[];
  /** 正答の添字（0 始まり） */
  answer: number;
  /** 正答の考え方（途中式つき） */
  explanation: RichText;
  /**
   * 選択肢ごとの一言。choices と同じ長さ。
   * 誤答には「どんな取り違えでこの答えになるか」、正答には「正しい」と短く書く。
   */
  choiceNotes: RichText[];
}

export interface UnitContent {
  unitId: string;
  lesson: Lesson;
  questions: Question[];
}

/* ---------- 外部教材 ---------- */

export type ProviderKind =
  | 'official'
  | 'public'
  | 'university'
  | 'textbook'
  | 'math'
  | 'video'
  | 'interactive'
  | 'practice'
  | 'data';

export interface Provider {
  id: string;
  name: string;
  operator: string;
  url: string;
  kind: ProviderKind;
  /** S = 主教材として推奨 / A = 有用な補助 / B = 必要に応じて */
  tier: 'S' | 'A' | 'B';
  description: string;
  free: 'free' | 'freemium' | 'paid';
  loginRequired: 'no' | 'optional' | 'yes';
  /** リンクに関するサイト側の方針の要約（確認できた場合） */
  linkPolicy?: string;
}

export type ResourceType = 'text' | 'video' | 'interactive' | 'practice' | 'mock' | 'official' | 'reference' | 'data';

/** primary = まずこれ / supplement = 別の角度で / math = 数学でつまずいたら / practice = もっと解く */
export type ResourceRole = 'primary' | 'supplement' | 'math' | 'practice';

export interface ResourceLink {
  id: string;
  providerId: string;
  title: string;
  url: string;
  type: ResourceType;
  /** 対応する単元。空配列は試験全体に関わる教材 */
  unitIds: string[];
  role: ResourceRole;
  /** 目安時間（分） */
  minutes?: number;
  /** このページで何を学ぶか・どこを見るか（当サイトの言葉で） */
  focus: string;
  /** 範囲外の内容を含むなどの注意 */
  note?: string;
  /** リンク切れのときにサイト内検索で探すためのキーワード */
  search?: string;
  /** リンク先のページが存在し、タイトルが登録名と合うことを確認した日（npm run check:links の結果による） */
  checkedOn?: string;
  /** 人がリンク先の本文を読み、読みどころの記述と合うことを確認した日。未確認なら省略 */
  verifiedOn?: string;
}

export interface ResourceCatalog {
  providers: Provider[];
  links: ResourceLink[];
}
