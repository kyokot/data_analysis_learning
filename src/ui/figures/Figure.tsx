/**
 * 問題・要点に添える図表。content の数値データから SVG / 表として描く。
 * 色はすべて CSS のトークン（--chart-*）経由。系列は色に加えて凡例と印の形でも区別する。
 * 試験と同じく目盛りから値を読み取らせるため、値を教えるツールチップは付けない。
 */
import type { ReactNode } from 'react';
import type {
  BandFigure,
  BarFigure,
  BoxplotFigure,
  DotplotFigure,
  Figure,
  HistogramFigure,
  LineFigure,
  NormalFigure,
  PieFigure,
  ScatterFigure,
  SingleFigure,
  StemLeafFigure,
  TableFigure,
} from '../../content/types.ts';
import { Inline } from '../RichText.tsx';
import { fmt, makeAxis, scaleLinear, textWidth, type Axis } from './scale.ts';

const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-axis)'];
const color = (i: number) => SERIES[i % SERIES.length]!;

interface Box {
  w: number;
  h: number;
  l: number;
  r: number;
  t: number;
  b: number;
}

function Frame({ title, note, legend, children }: { title?: string; note?: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <figure className="figure">
      {title ? (
        <figcaption className="figure__title">
          <Inline text={title} />
        </figcaption>
      ) : null}
      {children}
      {legend}
      {note ? (
        <p className="figure__note">
          <Inline text={note} />
        </p>
      ) : null}
    </figure>
  );
}

function Legend({ items }: { items: { name: string; index: number }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.index}>
          <i style={{ background: color(it.index) }} />
          {it.name}
        </span>
      ))}
    </div>
  );
}

/** 縦軸（左）と横方向の目盛り線 */
function YAxis({ axis, box, label }: { axis: Axis; box: Box; label?: string }) {
  const y = scaleLinear(axis, box.h - box.b, box.t);
  return (
    <g>
      {axis.ticks.map((t) => (
        <g key={t}>
          <line x1={box.l} x2={box.w - box.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
          <text x={box.l - 6} y={y(t) + 4} textAnchor="end">
            {fmt(t)}
          </text>
        </g>
      ))}
      <line x1={box.l} x2={box.l} y1={box.t} y2={box.h - box.b} stroke="var(--chart-axis)" strokeWidth={1} />
      {label ? (
        <text x={4} y={11} className="fig-label">
          {label}
        </text>
      ) : null}
    </g>
  );
}

function XLabel({ box, label }: { box: Box; label?: string }) {
  if (!label) return null;
  return (
    <text x={(box.l + box.w - box.r) / 2} y={box.h - 4} textAnchor="middle" className="fig-label">
      {label}
    </text>
  );
}

/** 横軸の項目ラベル。入りきらないときは斜めにする */
function categoryLayout(labels: string[], band: number): { rotate: boolean; extra: number } {
  const widest = Math.max(...labels.map((l) => textWidth(l)));
  const rotate = widest > band - 2;
  return { rotate, extra: rotate ? Math.min(46, widest * 0.6 + 6) : 0 };
}

function CategoryLabels({ labels, x, y, rotate }: { labels: string[]; x: (i: number) => number; y: number; rotate: boolean }) {
  return (
    <g>
      {labels.map((l, i) =>
        rotate ? (
          <text key={i} x={x(i)} y={y} textAnchor="end" transform={`rotate(-35 ${x(i)} ${y})`}>
            {l}
          </text>
        ) : (
          <text key={i} x={x(i)} y={y + 4} textAnchor="middle">
            {l}
          </text>
        ),
      )}
    </g>
  );
}

/* ---------- 棒グラフ ---------- */

function Bar({ f, compact }: { f: BarFigure; compact: boolean }) {
  const w = compact ? 200 : 340;
  const n = f.categories.length;
  const plotW = w - 40 - 10;
  const band = plotW / n;
  const lay = categoryLayout(f.categories, band);
  const box: Box = { w, h: (compact ? 150 : 200) + lay.extra + (f.xLabel ? 14 : 0), l: 40, r: 10, t: f.yLabel ? 22 : 12, b: 22 + lay.extra + (f.xLabel ? 14 : 0) };
  const totals = f.categories.map((_, i) => f.series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const maxV = f.stacked ? Math.max(...totals) : Math.max(...f.series.flatMap((s) => s.values));
  const axis = makeAxis(0, maxV * (f.showValues ? 1.08 : 1), { includeZero: true, target: compact ? 4 : 5 });
  const y = scaleLinear(axis, box.h - box.b, box.t);
  const groups = f.stacked ? 1 : f.series.length;
  const barW = Math.min(24, Math.max(4, (band * 0.72 - (groups - 1) * 2) / groups));
  const groupW = barW * groups + (groups - 1) * 2;
  const cx = (i: number) => box.l + band * (i + 0.5);
  const base = y(0);
  const canLabel = f.showValues && (f.stacked || barW >= 14 || groups === 1);
  return (
    <Frame title={f.title} legend={f.series.length > 1 ? <Legend items={f.series.map((s, i) => ({ name: s.name ?? '', index: i }))} /> : undefined}>
      <svg viewBox={`0 0 ${box.w} ${box.h}`} role="img" aria-label={`${f.title ?? ''} 棒グラフ`}>
        <YAxis axis={axis} box={box} label={f.yLabel} />
        {f.categories.map((_, i) => {
          let acc = 0;
          return (
            <g key={i}>
              {f.series.map((s, si) => {
                const v = s.values[i] ?? 0;
                const x0 = f.stacked ? cx(i) - barW / 2 : cx(i) - groupW / 2 + si * (barW + 2);
                const top = y(acc + v);
                const bottom = f.stacked ? y(acc) : base;
                if (f.stacked) acc += v;
                const h = Math.max(0, bottom - top - (f.stacked && si > 0 ? 2 : 0));
                return (
                  <g key={si}>
                    <rect x={x0} y={top} width={barW} height={h} fill={color(si)} rx={f.stacked ? 0 : Math.min(3, barW / 3)} />
                    {canLabel && !f.stacked ? (
                      <text x={x0 + barW / 2} y={top - 4} textAnchor="middle" className="fig-value">
                        {fmt(v)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {canLabel && f.stacked ? (
                <text x={cx(i)} y={y(totals[i] ?? 0) - 4} textAnchor="middle" className="fig-value">
                  {fmt(totals[i] ?? 0)}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={box.l} x2={box.w - box.r} y1={base} y2={base} stroke="var(--chart-axis)" strokeWidth={1} />
        <CategoryLabels labels={f.categories} x={cx} y={base + 12} rotate={lay.rotate} />
        <XLabel box={box} label={f.xLabel} />
      </svg>
    </Frame>
  );
}

/* ---------- 帯グラフ ---------- */

function Band({ f }: { f: BandFigure }) {
  const w = 340;
  const rowH = 44;
  const l = 6;
  const r = 10;
  const h = f.rows.length * rowH + 26;
  const x = scaleLinear({ min: 0, max: 100 }, l, w - r);
  const ticks = [0, 20, 40, 60, 80, 100];
  return (
    <Frame title={f.title} legend={<Legend items={f.segments.map((s, i) => ({ name: s.name ?? '', index: i }))} />}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${f.title ?? ''} 帯グラフ`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={4} y2={h - 20} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={x(t)} y={h - 6} textAnchor={t === 0 ? 'start' : t === 100 ? 'end' : 'middle'}>
              {t}%
            </text>
          </g>
        ))}
        {f.rows.map((row, ri) => {
          let acc = 0;
          const top = ri * rowH + 18;
          return (
            <g key={ri}>
              <text x={l} y={top - 5} className="fig-label">
                {row}
              </text>
              {f.segments.map((s, si) => {
                const v = s.values[ri] ?? 0;
                const x0 = x(acc);
                const x1 = x(acc + v);
                acc += v;
                const segW = Math.max(0, x1 - x0 - (si > 0 ? 2 : 0));
                const label = fmt(v);
                return (
                  <g key={si}>
                    <rect x={x0 + (si > 0 ? 2 : 0)} y={top} width={segW} height={18} fill={color(si)} />
                    {f.showValues && segW > textWidth(label) + 6 ? (
                      <text x={x0 + (si > 0 ? 2 : 0) + segW / 2} y={top + 13} textAnchor="middle" style={{ fill: '#0d1626', fontWeight: 700 }}>
                        {label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/* ---------- 円グラフ ---------- */

function Pie({ f, compact }: { f: PieFigure; compact: boolean }) {
  const size = compact ? 150 : 190;
  const r = size / 2 - 6;
  const c = size / 2;
  const total = f.slices.reduce((a, s) => a + s.value, 0);
  let acc = 0;
  const pct = (v: number) => Math.round((v / total) * 1000) / 10;
  const arcs = f.slices.map((s, i) => {
    const a0 = (acc / total) * Math.PI * 2;
    acc += s.value;
    const a1 = (acc / total) * Math.PI * 2;
    const p = (a: number, rad: number) => [c + rad * Math.sin(a), c - rad * Math.cos(a)] as const;
    const [x0, y0] = p(a0, r);
    const [x1, y1] = p(a1, r);
    const mid = p((a0 + a1) / 2, r * 0.64);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return { i, d: `M ${c} ${c} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`, mid, share: s.value / total, label: `${fmt(pct(s.value))}%` };
  });
  return (
    <Frame
      title={f.title}
      legend={
        <div className="legend">
          {f.slices.map((s, i) => (
            <span key={i}>
              <i style={{ background: color(i) }} />
              {s.label}
              {f.showPercent ? `（${fmt(pct(s.value))}%）` : ''}
            </span>
          ))}
        </div>
      }
    >
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${f.title ?? ''} 円グラフ`} style={{ maxWidth: compact ? 170 : 220 }}>
        {arcs.map((a) => (
          <path key={a.i} d={a.d} fill={color(a.i)} stroke="var(--chart-surface)" strokeWidth={2} strokeLinejoin="round" />
        ))}
        {f.showPercent
          ? arcs
              .filter((a) => a.share >= 0.08)
              .map((a) => (
                <text key={a.i} x={a.mid[0]} y={a.mid[1] + 4} textAnchor="middle" style={{ fill: '#0d1626', fontWeight: 700 }}>
                  {a.label}
                </text>
              ))
          : null}
      </svg>
    </Frame>
  );
}

/* ---------- 折れ線グラフ ---------- */

function marker(shape: number, x: number, y: number, fill: string): ReactNode {
  const s = 4;
  const common = { fill, stroke: 'var(--chart-surface)', strokeWidth: 1.5 };
  switch (shape % 4) {
    case 0:
      return <circle cx={x} cy={y} r={s} {...common} />;
    case 1:
      return <rect x={x - s} y={y - s} width={s * 2} height={s * 2} {...common} />;
    case 2:
      return <path d={`M ${x} ${y - s - 1} L ${x + s + 1} ${y + s} L ${x - s - 1} ${y + s} Z`} {...common} />;
    default:
      return <path d={`M ${x} ${y - s - 1} L ${x + s + 1} ${y} L ${x} ${y + s + 1} L ${x - s - 1} ${y} Z`} {...common} />;
  }
}

function Line({ f, compact }: { f: LineFigure; compact: boolean }) {
  const w = compact ? 200 : 340;
  const n = f.x.length;
  const plotW = w - 40 - 14;
  const lay = categoryLayout(f.x, plotW / Math.max(1, n - 1));
  const box: Box = { w, h: (compact ? 150 : 200) + lay.extra + (f.xLabel ? 14 : 0), l: 40, r: 14, t: f.yLabel ? 22 : 12, b: 22 + lay.extra + (f.xLabel ? 14 : 0) };
  const all = f.series.flatMap((s) => s.values);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  // 0 から始めても形がつぶれない場合は 0 を含める（軸の省略で変化を誇張しない）
  const includeZero = f.yMin === undefined && lo >= 0 && lo <= hi * 0.5;
  const pad = (hi - lo || 1) * 0.08;
  const axis = makeAxis(lo - (includeZero ? 0 : pad), hi + pad, { includeZero, fixedMin: f.yMin, fixedMax: f.yMax, target: compact ? 4 : 5 });
  const y = scaleLinear(axis, box.h - box.b, box.t);
  const x = (i: number) => (n === 1 ? box.l + plotW / 2 : box.l + 6 + ((plotW - 12) * i) / (n - 1));
  const single = f.series.length === 1;
  return (
    <Frame
      title={f.title}
      legend={
        single ? undefined : (
          <div className="legend">
            {f.series.map((s, i) => (
              <span key={i}>
                <svg viewBox="0 0 22 12" style={{ width: 22, height: 12, margin: 0 }} aria-hidden="true">
                  <line x1={0} x2={22} y1={6} y2={6} stroke={color(i)} strokeWidth={2} />
                  {marker(i, 11, 6, color(i))}
                </svg>
                {s.name}
              </span>
            ))}
          </div>
        )
      }
    >
      <svg viewBox={`0 0 ${box.w} ${box.h}`} role="img" aria-label={`${f.title ?? ''} 折れ線グラフ`}>
        <YAxis axis={axis} box={box} label={f.yLabel} />
        <line x1={box.l} x2={box.w - box.r} y1={box.h - box.b} y2={box.h - box.b} stroke="var(--chart-axis)" strokeWidth={1} />
        {f.series.map((s, si) => (
          <g key={si}>
            <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color(si)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (
              <g key={i}>{marker(si, x(i), y(v), color(si))}</g>
            ))}
            {f.showValues && single
              ? s.values.map((v, i) => (
                  <text key={i} x={x(i)} y={y(v) - 8} textAnchor="middle" className="fig-value">
                    {fmt(v)}
                  </text>
                ))
              : null}
          </g>
        ))}
        <CategoryLabels labels={f.x} x={x} y={box.h - box.b + 12} rotate={lay.rotate} />
        <XLabel box={box} label={f.xLabel} />
      </svg>
    </Frame>
  );
}

/* ---------- ヒストグラム ---------- */

function Histogram({ f, compact }: { f: HistogramFigure; compact: boolean }) {
  const w = compact ? 200 : 340;
  const box: Box = { w, h: (compact ? 150 : 200) + (f.xLabel ? 14 : 0), l: 40, r: 12, t: f.yLabel ? 22 : 12, b: 22 + (f.xLabel ? 14 : 0) };
  const maxC = Math.max(...f.counts);
  const axis = makeAxis(0, maxC * (f.showCounts ? 1.1 : 1), { includeZero: true, target: compact ? 4 : 5 });
  const y = scaleLinear(axis, box.h - box.b, box.t);
  const x = scaleLinear({ min: f.edges[0]!, max: f.edges[f.edges.length - 1]! }, box.l, box.w - box.r);
  const binW = x(f.edges[1]!) - x(f.edges[0]!);
  // 目盛りラベルが重なるときは 1 つおきにする
  const widest = Math.max(...f.edges.map((e) => textWidth(fmt(e))));
  const every = widest + 4 > binW ? Math.ceil((widest + 4) / binW) : 1;
  return (
    <Frame title={f.title}>
      <svg viewBox={`0 0 ${box.w} ${box.h}`} role="img" aria-label={`${f.title ?? ''} ヒストグラム`}>
        <YAxis axis={axis} box={box} label={f.yLabel} />
        {f.counts.map((c, i) => {
          const x0 = x(f.edges[i]!);
          const top = y(c);
          return (
            <g key={i}>
              <rect x={x0 + 0.5} y={top} width={Math.max(0, binW - 1)} height={Math.max(0, y(0) - top)} fill="var(--chart-1)" />
              {f.showCounts && c > 0 ? (
                <text x={x0 + binW / 2} y={top - 4} textAnchor="middle" className="fig-value">
                  {fmt(c)}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={box.l} x2={box.w - box.r} y1={y(0)} y2={y(0)} stroke="var(--chart-axis)" strokeWidth={1} />
        {f.edges.map((e, i) => (
          <g key={i}>
            <line x1={x(e)} x2={x(e)} y1={y(0)} y2={y(0) + 4} stroke="var(--chart-axis)" strokeWidth={1} />
            {i % every === 0 ? (
              <text x={x(e)} y={y(0) + 16} textAnchor="middle">
                {fmt(e)}
              </text>
            ) : null}
          </g>
        ))}
        <XLabel box={box} label={f.xLabel} />
      </svg>
    </Frame>
  );
}

/* ---------- 横軸（数値）と縦の目盛り線: 箱ひげ図・散布図・ドットプロット用 ---------- */

function XAxisNumeric({ axis, box, minor }: { axis: Axis; box: Box; minor?: boolean }) {
  const x = scaleLinear(axis, box.l, box.w - box.r);
  const bottom = box.h - box.b;
  return (
    <g>
      {minor
        ? axis.minor.map((t) => <line key={`m${t}`} x1={x(t)} x2={x(t)} y1={box.t} y2={bottom} stroke="var(--chart-grid-minor)" strokeWidth={1} />)
        : null}
      {axis.ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={box.t} y2={bottom + 4} stroke="var(--chart-grid)" strokeWidth={1} />
          <text x={x(t)} y={bottom + 16} textAnchor="middle">
            {fmt(t)}
          </text>
        </g>
      ))}
      <line x1={box.l} x2={box.w - box.r} y1={bottom} y2={bottom} stroke="var(--chart-axis)" strokeWidth={1} />
    </g>
  );
}

/* ---------- 箱ひげ図 ---------- */

function Boxplot({ f, compact }: { f: BoxplotFigure; compact: boolean }) {
  const w = compact ? 200 : 340;
  const rowH = compact ? 30 : 36;
  const labelW = Math.min(compact ? 50 : 84, Math.max(0, ...f.boxes.map((b) => textWidth(b.label))) + (f.boxes.some((b) => b.label) ? 10 : 0));
  const box: Box = { w, h: f.boxes.length * rowH + 16 + 22 + (f.axisLabel ? 14 : 0), l: 10 + labelW, r: 14, t: 8, b: 22 + (f.axisLabel ? 14 : 0) };
  const values = f.boxes.flatMap((b) => [b.min, b.max, ...(b.outliers ?? [])]);
  const axis = makeAxis(Math.min(...values), Math.max(...values), { fixedMin: f.axisMin, fixedMax: f.axisMax, target: compact ? 4 : 6 });
  const x = scaleLinear(axis, box.l, box.w - box.r);
  const bh = compact ? 14 : 18;
  return (
    <Frame title={f.title}>
      <svg viewBox={`0 0 ${box.w} ${box.h}`} role="img" aria-label={`${f.title ?? ''} 箱ひげ図`}>
        <XAxisNumeric axis={axis} box={box} minor />
        {f.boxes.map((b, i) => {
          const cy = box.t + 8 + rowH * i + rowH / 2;
          const ink = 'var(--chart-ink)';
          return (
            <g key={i}>
              {b.label ? (
                <text x={box.l - 8} y={cy + 4} textAnchor="end" className="fig-label">
                  {b.label}
                </text>
              ) : null}
              <line x1={x(b.min)} x2={x(b.q1)} y1={cy} y2={cy} stroke={ink} strokeWidth={1.5} />
              <line x1={x(b.q3)} x2={x(b.max)} y1={cy} y2={cy} stroke={ink} strokeWidth={1.5} />
              <line x1={x(b.min)} x2={x(b.min)} y1={cy - bh / 3} y2={cy + bh / 3} stroke={ink} strokeWidth={1.5} />
              <line x1={x(b.max)} x2={x(b.max)} y1={cy - bh / 3} y2={cy + bh / 3} stroke={ink} strokeWidth={1.5} />
              <rect x={x(b.q1)} y={cy - bh / 2} width={Math.max(0, x(b.q3) - x(b.q1))} height={bh} fill="var(--chart-fill)" stroke={ink} strokeWidth={1.5} />
              <line x1={x(b.median)} x2={x(b.median)} y1={cy - bh / 2} y2={cy + bh / 2} stroke={ink} strokeWidth={2.5} />
              {(b.outliers ?? []).map((o, oi) => (
                <circle key={oi} cx={x(o)} cy={cy} r={3} fill="var(--chart-surface)" stroke={ink} strokeWidth={1.5} />
              ))}
            </g>
          );
        })}
        <XLabel box={box} label={f.axisLabel} />
      </svg>
    </Frame>
  );
}

/* ---------- 散布図 ---------- */

function Scatter({ f, compact }: { f: ScatterFigure; compact: boolean }) {
  const w = compact ? 200 : 340;
  const box: Box = { w, h: (compact ? 170 : 250) + (f.xLabel ? 14 : 0), l: 40, r: 14, t: f.yLabel ? 22 : 12, b: 22 + (f.xLabel ? 14 : 0) };
  const xs = f.points.map((p) => p[0]);
  const ys = f.points.map((p) => p[1]);
  const padX = (Math.max(...xs) - Math.min(...xs) || 1) * 0.06;
  const padY = (Math.max(...ys) - Math.min(...ys) || 1) * 0.06;
  const ax = makeAxis(Math.min(...xs) - padX, Math.max(...xs) + padX, { fixedMin: f.xMin, fixedMax: f.xMax, target: compact ? 3 : 5 });
  const ay = makeAxis(Math.min(...ys) - padY, Math.max(...ys) + padY, { fixedMin: f.yMin, fixedMax: f.yMax, target: compact ? 3 : 5 });
  const x = scaleLinear(ax, box.l, box.w - box.r);
  const y = scaleLinear(ay, box.h - box.b, box.t);
  let line: ReactNode = null;
  if (f.line) {
    // 描画範囲で直線を切り取る
    const { slope, intercept } = f.line;
    const pts: [number, number][] = [];
    const at = (vx: number) => intercept + slope * vx;
    for (const vx of [ax.min, ax.max]) {
      const vy = at(vx);
      if (vy >= ay.min && vy <= ay.max) pts.push([vx, vy]);
    }
    if (slope !== 0) {
      for (const vy of [ay.min, ay.max]) {
        const vx = (vy - intercept) / slope;
        if (vx > ax.min && vx < ax.max) pts.push([vx, vy]);
      }
    }
    if (pts.length >= 2) {
      pts.sort((a, b) => a[0] - b[0]);
      const a = pts[0]!;
      const b = pts[pts.length - 1]!;
      line = <line x1={x(a[0])} y1={y(a[1])} x2={x(b[0])} y2={y(b[1])} stroke="var(--chart-2)" strokeWidth={2} />;
    }
  }
  return (
    <Frame title={f.title}>
      <svg viewBox={`0 0 ${box.w} ${box.h}`} role="img" aria-label={`${f.title ?? ''} 散布図`}>
        <YAxis axis={ay} box={box} label={f.yLabel} />
        <XAxisNumeric axis={ax} box={box} />
        {line}
        {f.points.map((p, i) => (
          <circle key={i} cx={x(p[0])} cy={y(p[1])} r={compact ? 2.8 : 3.6} fill="var(--chart-1)" stroke="var(--chart-surface)" strokeWidth={1} />
        ))}
        <XLabel box={box} label={f.xLabel} />
      </svg>
    </Frame>
  );
}

/* ---------- ドットプロット ---------- */

function Dotplot({ f, compact }: { f: DotplotFigure; compact: boolean }) {
  const w = compact ? 200 : 340;
  const counts = new Map<number, number>();
  f.values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const lo = Math.min(...f.values);
  const hi = Math.max(...f.values);
  const maxCount = Math.max(...counts.values());
  const span = hi - lo + 1;
  const dot = Math.min(compact ? 5 : 6, (w - 40) / span / 2 - 0.5);
  const stepY = dot * 2 + 2;
  const box: Box = { w, h: maxCount * stepY + 14 + 22 + (f.axisLabel ? 14 : 0), l: 20, r: 20, t: 8, b: 22 + (f.axisLabel ? 14 : 0) };
  const x = scaleLinear({ min: lo, max: hi === lo ? lo + 1 : hi }, box.l, box.w - box.r);
  const bottom = box.h - box.b;
  const labelEvery = Math.max(1, Math.ceil((textWidth(String(hi)) + 4) / ((box.w - box.l - box.r) / Math.max(1, span - 1))));
  const ticks = Array.from({ length: span }, (_, i) => lo + i);
  return (
    <Frame title={f.title}>
      <svg viewBox={`0 0 ${box.w} ${box.h}`} role="img" aria-label={`${f.title ?? ''} ドットプロット`}>
        <line x1={box.l - 10} x2={box.w - box.r + 10} y1={bottom} y2={bottom} stroke="var(--chart-axis)" strokeWidth={1} />
        {ticks.map((t, i) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={bottom} y2={bottom + 4} stroke="var(--chart-axis)" strokeWidth={1} />
            {i % labelEvery === 0 ? (
              <text x={x(t)} y={bottom + 16} textAnchor="middle">
                {t}
              </text>
            ) : null}
            {Array.from({ length: counts.get(t) ?? 0 }, (_, k) => (
              <circle key={k} cx={x(t)} cy={bottom - dot - 3 - k * stepY} r={dot} fill="var(--chart-1)" />
            ))}
          </g>
        ))}
        <XLabel box={box} label={f.axisLabel} />
      </svg>
    </Frame>
  );
}

/* ---------- 正規分布 ---------- */

function Normal({ f, compact }: { f: NormalFigure; compact: boolean }) {
  const w = compact ? 200 : 340;
  const box: Box = { w, h: (compact ? 120 : 160) + (f.xLabel ? 14 : 0), l: 12, r: 12, t: 10, b: 22 + (f.xLabel ? 14 : 0) };
  const lo = f.mean - 3.6 * f.sd;
  const hi = f.mean + 3.6 * f.sd;
  const x = scaleLinear({ min: lo, max: hi }, box.l, box.w - box.r);
  const bottom = box.h - box.b;
  const pdf = (v: number) => Math.exp(-0.5 * ((v - f.mean) / f.sd) ** 2);
  const y = (v: number) => bottom - pdf(v) * (bottom - box.t - 4);
  const path = (from: number, to: number, close: boolean) => {
    const n = 60;
    const pts = Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n).map((v) => `${x(v).toFixed(1)},${y(v).toFixed(1)}`);
    return close ? `M ${x(from).toFixed(1)},${bottom} L ${pts.join(' L ')} L ${x(to).toFixed(1)},${bottom} Z` : `M ${pts.join(' L ')}`;
  };
  const marks = f.marks ?? (compact ? [-2, 0, 2] : [-3, -2, -1, 0, 1, 2, 3]).map((k) => f.mean + k * f.sd);
  return (
    <Frame title={f.title}>
      <svg viewBox={`0 0 ${box.w} ${box.h}`} role="img" aria-label={`${f.title ?? ''} 正規分布の曲線`}>
        {(f.shade ?? []).map((s, i) => (
          <path key={i} d={path(Math.max(lo, s.from ?? lo), Math.min(hi, s.to ?? hi), true)} fill="var(--chart-1)" opacity={0.45} />
        ))}
        <path d={path(lo, hi, false)} fill="none" stroke="var(--chart-ink)" strokeWidth={2} />
        <line x1={box.l} x2={box.w - box.r} y1={bottom} y2={bottom} stroke="var(--chart-axis)" strokeWidth={1} />
        {marks
          .filter((m) => m >= lo && m <= hi)
          .map((m) => (
            <g key={m}>
              <line x1={x(m)} x2={x(m)} y1={bottom} y2={bottom + 4} stroke="var(--chart-axis)" strokeWidth={1} />
              <line x1={x(m)} x2={x(m)} y1={y(m)} y2={bottom} stroke="var(--chart-axis)" strokeWidth={1} strokeDasharray="none" opacity={0.5} />
              <text x={x(m)} y={bottom + 16} textAnchor="middle">
                {fmt(m)}
              </text>
            </g>
          ))}
        <XLabel box={box} label={f.xLabel} />
      </svg>
    </Frame>
  );
}

/* ---------- 表・幹葉図 ---------- */

const numericLike = (c: string | number) => typeof c === 'number' || /^[\s\d.,%+\-−±]+$/.test(c);

function Table({ f }: { f: TableFigure }) {
  return (
    <Frame title={f.title} note={f.note}>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {f.columns.map((c, i) => (
                <th key={i} scope="col">
                  <Inline text={c} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((c, ci) =>
                  ci === 0 && f.headerColumn ? (
                    <th key={ci} scope="row">
                      <Inline text={String(c)} />
                    </th>
                  ) : (
                    <td key={ci} className={numericLike(c) ? undefined : 'is-text'}>
                      {typeof c === 'number' ? fmt(c) : <Inline text={c} />}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

function StemLeaf({ f }: { f: StemLeafFigure }) {
  return (
    <Frame title={f.title} note={f.note}>
      <div className="table-wrap">
        <table className="stemleaf">
          <thead>
            <tr>
              <th scope="col">{f.stemLabel ?? '幹'}</th>
              <th scope="col">{f.leafLabel ?? '葉'}</th>
            </tr>
          </thead>
          <tbody>
            {f.rows.map((r, i) => (
              <tr key={i}>
                <td>{r.stem}</td>
                <td>{r.leaves.join('')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

/* ---------- 入口 ---------- */

function Single({ f, compact }: { f: SingleFigure; compact: boolean }) {
  switch (f.type) {
    case 'table':
      return <Table f={f} />;
    case 'bar':
      return <Bar f={f} compact={compact} />;
    case 'band':
      return <Band f={f} />;
    case 'pie':
      return <Pie f={f} compact={compact} />;
    case 'line':
      return <Line f={f} compact={compact} />;
    case 'histogram':
      return <Histogram f={f} compact={compact} />;
    case 'boxplot':
      return <Boxplot f={f} compact={compact} />;
    case 'scatter':
      return <Scatter f={f} compact={compact} />;
    case 'dotplot':
      return <Dotplot f={f} compact={compact} />;
    case 'stemleaf':
      return <StemLeaf f={f} />;
    case 'normal':
      return <Normal f={f} compact={compact} />;
  }
}

/** 横幅が必要な図は、パネルを 1 列に並べる */
const WIDE = new Set(['table', 'band', 'boxplot', 'stemleaf']);

export function FigureView({ figure }: { figure: Figure }) {
  if (figure.type !== 'panels') return <Single f={figure} compact={false} />;
  const wide = figure.panels.some((p) => WIDE.has(p.figure.type) || (p.figure.type === 'bar' && p.figure.categories.length > 5));
  return (
    <Frame title={figure.title}>
      <div className={`panels${wide ? ' panels--wide' : ''}`}>
        {figure.panels.map((p) => (
          <div className="panel" key={p.label}>
            <span className="panel__label">{p.label}</span>
            <Single f={p.figure} compact={!wide} />
          </div>
        ))}
      </div>
    </Frame>
  );
}
