/**
 * コンテンツの検証。スキーマ（形）に加えて、参照の整合・数式の構文・図表の数値・
 * 問題構成の偏りなど、機械的に確かめられることをすべて確かめる。
 * 内容（統計的な正しさ）はここでは保証できない。content/AUTHORING.md の検証手順を参照。
 */
import katex from 'katex';
import type { z } from 'zod';
import { extractMath, RichTextError } from './richtext.ts';
import { curriculumSchema, resourceCatalogSchema, unitContentSchema } from './schema.ts';
import type { Curriculum, Figure, ResourceCatalog, SingleFigure, UnitContent } from './types.ts';

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

/** 1 単元あたりに必要な問題数 */
export const QUESTION_RULES = {
  /** 通常の単元: 確認テスト・復習用 */
  practiceMin: 8,
  /** 通常の単元: 模試専用（4級の単元は模試 1 回分を初見でまかなうため多めに取る） */
  examMin: { 4: 5, 3: 4 } as Record<number, number>,
  /** 数学の学び直し単元（模試には出さない） */
  mathPracticeMin: 6,
};

function zodIssues(where: string, error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({
    level: 'error' as const,
    where: `${where}${i.path.length ? ` › ${i.path.join('.')}` : ''}`,
    message: i.message,
  }));
}

function checkTex(tex: string, display: boolean): string | null {
  try {
    katex.renderToString(tex, { throwOnError: true, displayMode: display, strict: 'error' });
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

function checkRich(where: string, value: string | undefined, issues: Issue[]) {
  if (!value) return;
  try {
    for (const m of extractMath(value)) {
      const err = checkTex(m.tex, m.display);
      if (err) issues.push({ level: 'error', where, message: `数式エラー: ${err}（${m.tex}）` });
    }
  } catch (e) {
    if (e instanceof RichTextError) issues.push({ level: 'error', where, message: e.message });
    else throw e;
  }
  if (/\\\(|\\\[/.test(value)) issues.push({ level: 'error', where, message: '数式は \\( \\) ではなく $...$ で書いてください' });
}

const approx = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function checkSingleFigure(where: string, f: SingleFigure, issues: Issue[]) {
  const err = (message: string) => issues.push({ level: 'error', where, message });
  switch (f.type) {
    case 'table':
      for (const [i, row] of f.rows.entries()) {
        if (row.length !== f.columns.length) err(`表の ${i + 1} 行目の列数（${row.length}）が見出し（${f.columns.length}）と一致しません`);
        row.forEach((c) => typeof c === 'string' && checkRich(where, c, issues));
      }
      f.columns.forEach((c) => checkRich(where, c, issues));
      break;
    case 'bar':
      for (const s of f.series) {
        if (s.values.length !== f.categories.length) err(`棒グラフの系列「${s.name ?? ''}」の値の数が項目数と一致しません`);
        if (s.values.some((v) => v < 0)) err('棒グラフに負の値は使えません');
      }
      if (f.series.length > 1 && f.series.some((s) => !s.name)) err('系列が複数ある棒グラフには系列名（name）が必要です');
      break;
    case 'band':
      for (const s of f.segments) {
        if (!s.name) err('帯グラフの区分には name が必要です');
        if (s.values.length !== f.rows.length) err(`帯グラフの区分「${s.name ?? ''}」の値の数が行数と一致しません`);
      }
      f.rows.forEach((r, i) => {
        const sum = f.segments.reduce((a, s) => a + (s.values[i] ?? 0), 0);
        if (Math.abs(sum - 100) > 0.11) err(`帯グラフ「${r}」の合計が 100 になりません（${sum}）`);
      });
      break;
    case 'line':
      for (const s of f.series) {
        if (s.values.length !== f.x.length) err(`折れ線グラフの系列「${s.name ?? ''}」の値の数が横軸の数と一致しません`);
      }
      if (f.series.length > 1 && f.series.some((s) => !s.name)) err('系列が複数ある折れ線グラフには系列名（name）が必要です');
      break;
    case 'histogram': {
      if (f.edges.length !== f.counts.length + 1) err('ヒストグラムの edges の長さは counts の長さ + 1 にしてください');
      const w = (f.edges[1] ?? 0) - (f.edges[0] ?? 0);
      for (let i = 1; i < f.edges.length; i++) {
        const d = f.edges[i]! - f.edges[i - 1]!;
        if (d <= 0) err('ヒストグラムの edges は昇順にしてください');
        else if (!approx(d, w)) err('ヒストグラムの階級幅は等間隔にしてください');
      }
      if (f.relative && !approx(f.counts.reduce((a, b) => a + b, 0), 1, 1e-3)) err('相対度数の合計が 1 になりません');
      break;
    }
    case 'boxplot':
      for (const b of f.boxes) {
        if (!(b.min <= b.q1 && b.q1 <= b.median && b.median <= b.q3 && b.q3 <= b.max)) {
          err(`箱ひげ図「${b.label}」は min ≤ q1 ≤ median ≤ q3 ≤ max を満たしません`);
        }
        for (const o of b.outliers ?? []) {
          if (o >= b.min && o <= b.max) err(`箱ひげ図「${b.label}」の外れ値 ${o} がひげの内側にあります`);
        }
      }
      if (f.boxes.length > 1 && f.boxes.some((b) => !b.label)) err('箱が複数ある箱ひげ図には label が必要です');
      break;
    case 'dotplot':
      break;
    case 'stemleaf':
      break;
    case 'normal':
      for (const s of f.shade ?? []) {
        if (s.from !== undefined && s.to !== undefined && s.from >= s.to) err('正規分布の塗り区間は from < to にしてください');
      }
      break;
    case 'pie':
    case 'scatter':
      break;
  }
}

function checkFigure(where: string, f: Figure | undefined, issues: Issue[]) {
  if (!f) return;
  if (f.type === 'panels') f.panels.forEach((p) => checkSingleFigure(`${where} › ${p.label}`, p.figure, issues));
  else checkSingleFigure(where, f, issues);
}

/* ---------- カリキュラム ---------- */

export function validateCurriculum(raw: unknown): { curriculum: Curriculum | null; issues: Issue[] } {
  const parsed = curriculumSchema.safeParse(raw);
  if (!parsed.success) return { curriculum: null, issues: zodIssues('curriculum.json', parsed.error) };
  const c = parsed.data as Curriculum;
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where: `curriculum.json › ${where}`, message });

  const stageIds = new Set(c.stages.map((s) => s.id));
  const domainSet = new Set(c.domains.map((d) => d.id));
  const stageOrder = new Map(c.stages.map((s, i) => [s.id, i]));
  const seen = new Map<string, number>();
  let lastStage = -1;
  c.units.forEach((u, index) => {
    if (seen.has(u.id)) err(u.id, '単元 id が重複しています');
    if (!stageIds.has(u.stageId)) err(u.id, `存在しないステージ: ${u.stageId}`);
    if (!domainSet.has(u.domain)) err(u.id, `domains に無い分野: ${u.domain}`);
    const so = stageOrder.get(u.stageId) ?? -1;
    if (so < lastStage) err(u.id, '単元はステージの順に並べてください');
    lastStage = Math.max(lastStage, so);
    u.goals.forEach((g, gi) => checkRich(`curriculum.json › ${u.id}.goals[${gi}]`, g, issues));
    for (const r of u.refreshers ?? []) {
      const ri = seen.get(r);
      if (ri === undefined || c.units[ri]!.domain !== 'math') err(u.id, `refreshers には、先に定義された数学の補習単元を指定してください: ${r}`);
    }
    if (u.domain === 'math' && !c.stages.find((s) => s.id === u.stageId)?.support) err(u.id, '数学の補習単元は support: true のステージに置いてください');
    for (const p of u.prerequisites) {
      const pi = seen.get(p);
      if (pi === undefined) err(u.id, `前提単元 ${p} が、この単元より前に定義されていません（並び順が学習順になります）`);
      else if (c.units[pi]!.domain === 'math') err(u.id, `補習単元 ${p} は prerequisites ではなく refreshers に書いてください`);
      else if (c.units[pi]!.grade < u.grade) err(u.id, `${u.grade}級の単元が${c.units[pi]!.grade}級の単元 ${p} を前提にしています`);
    }
    seen.set(u.id, index);
  });
  for (const m of c.mocks) {
    const sum = Object.values(m.domains).reduce((a, b) => a + (b ?? 0), 0);
    if (sum !== m.questions) err(`mocks(${m.grade}級)`, `分野別の出題数の合計（${sum}）が questions（${m.questions}）と一致しません`);
  }
  return { curriculum: c, issues };
}

/* ---------- 単元コンテンツ ---------- */

export function validateUnitContent(
  fileUnitId: string,
  raw: unknown,
  curriculum: Curriculum,
): { content: UnitContent | null; issues: Issue[] } {
  const file = `units/${fileUnitId}.json`;
  const parsed = unitContentSchema.safeParse(raw);
  if (!parsed.success) return { content: null, issues: zodIssues(file, parsed.error) };
  const content = parsed.data as UnitContent;
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where: `${file} › ${where}`, message });
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where: `${file} › ${where}`, message });

  const unit = curriculum.units.find((u) => u.id === fileUnitId);
  if (!unit) {
    err('unitId', `curriculum.json に無い単元です: ${fileUnitId}`);
    return { content, issues };
  }
  if (content.unitId !== fileUnitId) err('unitId', `ファイル名（${fileUnitId}）と unitId（${content.unitId}）が一致しません`);

  // 要点
  const L = content.lesson;
  checkRich(`${file} › lesson.intro`, L.intro, issues);
  L.points.forEach((p, i) => checkRich(`${file} › lesson.points[${i}]`, `${p.title}\n${p.body}`, issues));
  (L.formulas ?? []).forEach((f, i) => {
    const e = checkTex(f.tex, true);
    if (e) err(`lesson.formulas[${i}]`, `数式エラー: ${e}（tex には $ を付けずに書きます）`);
    checkRich(`${file} › lesson.formulas[${i}].note`, f.note, issues);
  });
  checkRich(`${file} › lesson.example.problem`, L.example.problem, issues);
  checkFigure(`${file} › lesson.example.figure`, L.example.figure, issues);
  L.example.steps.forEach((s, i) => checkRich(`${file} › lesson.example.steps[${i}]`, s, issues));
  checkRich(`${file} › lesson.example.answer`, L.example.answer, issues);
  L.pitfalls.forEach((s, i) => checkRich(`${file} › lesson.pitfalls[${i}]`, s, issues));
  L.examTips.forEach((s, i) => checkRich(`${file} › lesson.examTips[${i}]`, s, issues));

  // 問題
  const ids = new Set<string>();
  const stems = new Set<string>();
  const positions: number[] = [];
  content.questions.forEach((q, i) => {
    const w = q.id || `questions[${i}]`;
    const expected = `${fileUnitId}-q${String(i + 1).padStart(2, '0')}`;
    if (q.id !== expected) err(w, `id は並び順に ${expected} としてください`);
    if (ids.has(q.id)) err(w, 'id が重複しています');
    ids.add(q.id);
    if (q.answer >= q.choices.length) err(w, `answer（${q.answer}）が選択肢の範囲外です`);
    if (new Set(q.choices.map((c) => c.trim())).size !== q.choices.length) err(w, '同じ選択肢が複数あります');
    if (q.grade > unit.grade) err(w, `${unit.grade}級の単元に ${q.grade}級の問題は置けません（grade は数字が小さいほど上の級）`);
    if (unit.grade === 4 && q.pool === 'exam' && q.grade !== 4) err(w, '4級の単元の模試用問題は grade: 4 にしてください');
    if (unit.domain === 'math' && q.pool === 'exam') err(w, '数学の学び直し単元に模試用問題は置けません');
    const key = `${q.stem}|${JSON.stringify(q.figure ?? null)}`;
    if (stems.has(key)) err(w, '同じ問題文・同じ図の問題があります');
    stems.add(key);
    checkRich(`${file} › ${w}.stem`, q.stem, issues);
    q.choices.forEach((c, j) => checkRich(`${file} › ${w}.choices[${j}]`, c, issues));
    checkRich(`${file} › ${w}.explanation`, q.explanation, issues);
    if (q.choiceNotes.length !== q.choices.length) err(w, 'choiceNotes は choices と同じ数だけ書いてください');
    q.choiceNotes.forEach((c, j) => checkRich(`${file} › ${w}.choiceNotes[${j}]`, c, issues));
    checkFigure(`${file} › ${w}.figure`, q.figure, issues);
    if (/上記|以上のすべて|いずれでもない|どれでもない/.test(q.choices.join(''))) {
      warn(w, '「上記すべて」「どれでもない」型の選択肢は避けてください');
    }
    positions.push(q.answer);
  });

  const practice = content.questions.filter((q) => q.pool === 'practice');
  const exam = content.questions.filter((q) => q.pool === 'exam');
  if (unit.domain === 'math') {
    if (practice.length < QUESTION_RULES.mathPracticeMin) err('questions', `practice の問題が ${QUESTION_RULES.mathPracticeMin} 問以上必要です（現在 ${practice.length}）`);
  } else {
    const examMin = QUESTION_RULES.examMin[unit.grade]!;
    if (practice.length < QUESTION_RULES.practiceMin) err('questions', `practice の問題が ${QUESTION_RULES.practiceMin} 問以上必要です（現在 ${practice.length}）`);
    if (exam.length < examMin) err('questions', `exam（模試専用）の問題が ${examMin} 問以上必要です（現在 ${exam.length}）`);
    if (exam.some((q) => q.difficulty === 1) && exam.every((q) => q.difficulty === 1)) warn('questions', '模試専用の問題がすべて difficulty 1 です');
  }
  if (!practice.some((q) => q.difficulty === 1)) err('questions', 'practice に difficulty 1（基礎の確認）が 1 問以上必要です');
  if (practice.filter((q) => q.difficulty >= 2).length < 3) err('questions', 'practice に difficulty 2 以上が 3 問以上必要です');
  if (positions.length >= 8) {
    const counts = new Map<number, number>();
    positions.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1));
    const max = Math.max(...counts.values());
    if (max / positions.length > 0.4) err('questions', `正答の位置が偏っています（同じ位置が ${max}/${positions.length} 問）。位置を散らしてください`);
    if (counts.size < 3) err('questions', '正答の位置が 2 種類以下です');
  }
  return { content, issues };
}

/* ---------- 外部教材 ---------- */

export function validateResources(
  raw: unknown,
  curriculum: Curriculum,
  opts: { requirePrimary: boolean },
): { catalog: ResourceCatalog | null; issues: Issue[] } {
  const parsed = resourceCatalogSchema.safeParse(raw);
  if (!parsed.success) return { catalog: null, issues: zodIssues('resources.json', parsed.error) };
  const catalog = parsed.data as ResourceCatalog;
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where: `resources.json › ${where}`, message });

  const providers = new Set<string>();
  for (const p of catalog.providers) {
    if (providers.has(p.id)) err(p.id, '提供元 id が重複しています');
    providers.add(p.id);
  }
  const unitIds = new Set(curriculum.units.map((u) => u.id));
  const linkIds = new Set<string>();
  const urlsByUnit = new Set<string>();
  const primary = new Map<string, number>();
  for (const l of catalog.links) {
    if (linkIds.has(l.id)) err(l.id, 'リンク id が重複しています');
    linkIds.add(l.id);
    if (!providers.has(l.providerId)) err(l.id, `存在しない提供元: ${l.providerId}`);
    for (const u of l.unitIds) {
      if (!unitIds.has(u)) err(l.id, `存在しない単元: ${u}`);
      const key = `${u}|${l.url}`;
      if (urlsByUnit.has(key)) err(l.id, `単元 ${u} に同じ URL が重複しています`);
      urlsByUnit.add(key);
      if (l.role === 'primary') primary.set(u, (primary.get(u) ?? 0) + 1);
    }
  }
  for (const u of curriculum.units) {
    const n = primary.get(u.id) ?? 0;
    // 数学の補習は、当サイトの要点と確認テストだけで完結する（外部教材は補助）
    if (n === 0 && u.domain !== 'math') {
      issues.push({
        level: opts.requirePrimary ? 'error' : 'warning',
        where: `resources.json › ${u.id}`,
        message: 'この単元に主教材（role: primary）のリンクがありません',
      });
    }
  }
  return { catalog, issues };
}

/* ---------- 全体 ---------- */

export interface ContentBundle {
  curriculum: unknown;
  resources: unknown;
  /** 単元 id（ファイル名）→ JSON */
  units: Record<string, unknown>;
}

export function validateAll(bundle: ContentBundle, opts: { allowMissing?: boolean; only?: string[] } = {}): Issue[] {
  const { curriculum, issues } = validateCurriculum(bundle.curriculum);
  if (!curriculum) return issues;
  const all = [...issues];
  const loaded = new Map<string, UnitContent>();
  for (const [id, raw] of Object.entries(bundle.units)) {
    if (opts.only && !opts.only.includes(id)) continue;
    const r = validateUnitContent(id, raw, curriculum);
    all.push(...r.issues);
    if (r.content) loaded.set(id, r.content);
  }
  if (opts.only) return all;

  for (const u of curriculum.units) {
    if (!(u.id in bundle.units)) {
      all.push({ level: opts.allowMissing ? 'warning' : 'error', where: `units/${u.id}.json`, message: '単元コンテンツがありません' });
    }
  }
  all.push(...validateResources(bundle.resources, curriculum, { requirePrimary: !opts.allowMissing }).issues);

  // 模試の配分を、模試専用問題だけでまかなえるか
  if (!opts.allowMissing) {
    for (const m of curriculum.mocks) {
      for (const [domain, need] of Object.entries(m.domains)) {
        const have = curriculum.units
          .filter((u) => u.domain === domain && u.grade >= m.grade)
          .flatMap((u) => loaded.get(u.id)?.questions ?? [])
          .filter((q) => q.pool === 'exam' && q.grade >= m.grade).length;
        if (have < (need ?? 0)) {
          all.push({
            level: 'error',
            where: `curriculum.json › mocks(${m.grade}級) › ${domain}`,
            message: `模試専用問題が足りません（必要 ${need} / 現在 ${have}）`,
          });
        }
      }
    }
  }
  return all;
}
