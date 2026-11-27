/** 時系列（指数・増減率・移動平均）の類題 */
import { choicesFrom, fixed, int, num, pick, sum } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

/** 小数第1位に四捨五入するとき、ぎりぎり（x.x5 付近）の値なら作り直す */
function safe1(x: number): number {
  const f = Math.abs(x * 10) % 1;
  if (Math.abs(f - 0.5) < 0.02) throw new Reject();
  return x;
}

/** 割り算の結果を数式用に。割り切れれば最大3桁、そうでなければ小数第3位までで打ち切って「…」 */
function approx(x: number): string {
  if (Math.abs(x * 1000 - Math.round(x * 1000)) < 1e-6) return num(x, 3);
  return `${(Math.floor(x * 1000 + 1e-9) / 1000).toFixed(3)}\\cdots`;
}

/** 符号つきの百分率（負は全角のマイナス記号） */
function signedPct(v: number): string {
  const s = fixed(Math.abs(v), 1);
  return Number(s) === 0 ? `${s}%` : `${v < 0 ? '−' : ''}${s}%`;
}

const SERIES = [
  { title: '食パン1斤の価格', what: '食パン1斤の価格', col: '価格（円）', unit: '円', lo: 180, hi: 320, step: 10 },
  { title: '市民プールの年間利用者数', what: '市民プールの年間利用者数', col: '利用者数（人）', unit: '人', lo: 8000, hi: 20000, step: 100 },
  { title: '家庭の1か月の電気料金', what: 'ある家庭の1月の電気料金', col: '電気料金（円）', unit: '円', lo: 7000, hi: 12000, step: 50 },
  { title: '農園のみかんの収穫量', what: '農園のみかんの収穫量', col: '収穫量（kg）', unit: 'kg', lo: 1500, hi: 4000, step: 10 },
  { title: '図書館の年間貸出冊数', what: '図書館の年間貸出冊数', col: '貸出冊数（冊）', unit: '冊', lo: 20000, hi: 50000, step: 100 },
];

const CHANGE_ITEMS = [
  { what: 'ある町の家庭ごみの排出量', unit: 'トン', lo: 120, hi: 600, mult: 10 },
  { what: 'ある遊園地の年間入場者数', unit: '人', lo: 40, hi: 300, mult: 1000 },
  { what: 'ある学校の図書室の貸出冊数', unit: '冊', lo: 30, hi: 120, mult: 100 },
  { what: 'ある商店街の歩行者数（休日1日あたり）', unit: '人', lo: 20, hi: 90, mult: 100 },
  { what: 'ある工場の電力使用量', unit: '千kWh', lo: 40, hi: 160, mult: 10 },
];

const MA_CONTEXTS = [
  { title: 'おにぎりの販売個数', what: 'ある売店のおにぎりの販売個数', labels: ['月', '火', '水', '木', '金', '土', '日'], self: '日', period: '日', head: '曜日', col: '販売個数（個）', unit: '個', lo: 60, hi: 130, sfx: '曜日' },
  { title: '月別の来館者数', what: 'ある科学館の月別の来館者数', labels: ['4月', '5月', '6月', '7月', '8月', '9月', '10月'], self: '月', period: 'か月', head: '月', col: '来館者数（百人）', unit: '百人', lo: 30, hi: 90, sfx: '' },
  { title: '週ごとの問い合わせ件数', what: 'ある窓口の週ごとの問い合わせ件数', labels: ['第1週', '第2週', '第3週', '第4週', '第5週', '第6週', '第7週'], self: '週', period: '週', head: '週', col: '件数（件）', unit: '件', lo: 20, hi: 70, sfx: '' },
  { title: '月別の降水量', what: 'ある町の月別の降水量', labels: ['5月', '6月', '7月', '8月', '9月', '10月', '11月'], self: '月', period: 'か月', head: '月', col: '降水量（mm）', unit: 'mm', lo: 50, hi: 250, sfx: '' },
];

export const generators: QuestionGenerator[] = [
  {
    id: 'timeseries-index-base100',
    unitId: 'timeseries-index',
    skill: '基準時点を100とした指数の計算',
    grade: 4,
    difficulty: 2,
    replaces: ['timeseries-index-q03'],
    build(rng) {
      const c = pick(rng, SERIES);
      const n = int(rng, 4, 5);
      const y0 = int(rng, 2017, 2020);
      const years = Array.from({ length: n }, (_, i) => y0 + i);
      const vals: number[] = [Math.round(int(rng, c.lo, c.hi) / c.step) * c.step];
      for (let i = 1; i < n; i++) {
        const r = 1 + int(rng, -6, 12) / 100;
        vals.push(Math.round((vals[i - 1]! * r) / c.step) * c.step);
      }
      const t = int(rng, 2, n - 1);
      const base = vals[0]!;
      const v = vals[t]!;
      const prev = vals[t - 1]!;
      if (v === base || prev === base || v === prev) throw new Reject();
      const o = t < n - 1 ? t + 1 : t - 1;
      const other = vals[o]!;
      const idx = safe1((v / base) * 100);
      const wPrev = safe1((v / prev) * 100);
      const wOther = safe1((other / base) * 100);
      const wInv = safe1((base / v) * 100);
      const wDiff = 100 + (v - base);
      const label = (x: number) => fixed(x, 1);
      return {
        stem: `次の表は、${c.what}の推移である。${years[0]}年の値を100としたとき、${years[t]}年の指数として正しいものを一つ選べ。ただし、小数第2位を四捨五入した値で答えよ。`,
        figure: {
          type: 'table',
          title: c.title,
          columns: ['年', c.col],
          rows: years.map((y, i) => [`${y}年`, vals[i]!]),
          headerColumn: true,
        },
        ...choicesFrom(
          { value: idx, label: label(idx), note: `正しい。${years[t]}年の${v}${c.unit}を基準の${base}${c.unit}で割って100を掛ける。` },
          [
            { value: wPrev, label: label(wPrev), note: `基準を${years[0]}年ではなく前年の${years[t - 1]}年（${prev}${c.unit}）にして、$${v}\\div ${prev}\\times 100$ を計算した値。` },
            { value: wOther, label: label(wOther), note: `${years[t]}年ではなく${years[o]}年の${other}${c.unit}を使って、$${other}\\div ${base}\\times 100$ を計算した値。` },
            { value: wInv, label: label(wInv), note: `割る数と割られる数を逆にして、$${base}\\div ${v}\\times 100$ を計算した値。` },
            // 差をそのまま100に足す誤りは、差が数十程度の場面でだけ選択肢にする（大きな値では指数として不自然な数や負の数になる）
            ...(Math.abs(v - base) <= 60
              ? [{ value: wDiff, label: label(wDiff), note: `値の差 $${v}-${base}=${v - base}$（${c.unit}）を、割合に直さずにそのまま100に足した値。` }]
              : []),
          ],
          { rng },
        ),
        explanation: `正答は${label(idx)}である。指数は「その時点の値 ÷ 基準時点の値 × 100」で求める。\n基準は${years[0]}年の${base}${c.unit}なので、$${v}\\div ${base}\\times 100=${approx((v / base) * 100)}$ となり、小数第2位を四捨五入して${label(idx)}。`,
      };
    },
  },
  {
    id: 'timeseries-index-change',
    unitId: 'timeseries-index',
    skill: '増減率の計算（増加・減少の符号）',
    grade: 4,
    difficulty: 1,
    replaces: ['timeseries-index-q02'],
    build(rng) {
      const it = pick(rng, CHANGE_ITEMS);
      const before = int(rng, it.lo, it.hi) * it.mult;
      const up = rng() < 0.5;
      const pct = pick(rng, [4, 5, 8, 10, 12, 15, 16, 20, 24, 25, 30, 40]);
      const after = up ? (before * (100 + pct)) / 100 : (before * (100 - pct)) / 100;
      if (!Number.isInteger(after)) throw new Reject();
      const diff = after - before;
      const rate = (diff / before) * 100;
      const wAfter = safe1((diff / after) * 100);
      const wRatio = (after / before) * 100;
      return {
        stem: `${it.what}は、昨年が${before}${it.unit}、今年が${after}${it.unit}であった。今年の値の、昨年からの増減率として正しいものを一つ選べ。ただし、増加はプラス、減少はマイナスで表し、小数第2位を四捨五入した値で答えよ。`,
        ...choicesFrom(
          { value: rate, label: signedPct(rate), note: `正しい。変化した量 $${after}-${before}=${diff}$（${it.unit}）を、もとにする昨年の${before}${it.unit}で割って100を掛ける。` },
          [
            { value: wAfter, label: signedPct(wAfter), note: `変化した量を、昨年ではなく今年の${after}${it.unit}で割った値。もとにする量は変化の前の昨年である。` },
            { value: -rate, label: signedPct(-rate), note: `割合の大きさは合っているが、${up ? '増えた' : '減った'}のに符号を逆にした値。` },
            { value: wRatio, label: signedPct(wRatio), note: '今年が昨年の何%にあたるか（前年比）を答えたもの。増減率はここから100を引く。' },
            { value: -wAfter, label: signedPct(-wAfter), note: `今年の${after}${it.unit}で割ったうえに、符号も逆にした値。もとにする量は昨年で、符号は変化の向きで決まる。` },
          ],
          { rng },
        ),
        explanation: `正答は${signedPct(rate)}である。増減率は「（今年の値 − 昨年の値）÷ 昨年の値 × 100」で求める。\n$(${after}-${before})\\div ${before}\\times 100=${diff}\\div ${before}\\times 100=${rate}$。${up ? `プラスなので${pct}%の増加` : `マイナスなので${pct}%の減少`}を表す。`,
      };
    },
  },
  {
    id: 'timeseries-index-moving-avg',
    unitId: 'timeseries-index',
    skill: '3期間の移動平均の計算',
    grade: 4,
    difficulty: 2,
    replaces: ['timeseries-index-q06'],
    build(rng) {
      const c = pick(rng, MA_CONTEXTS);
      const n = int(rng, 6, 7);
      const xs = Array.from({ length: n }, () => int(rng, c.lo, c.hi));
      const k = int(rng, 2, n - 3);
      const lab = (i: number) => `${c.labels[i]!}${c.sfx}`;
      const ma = sum(xs.slice(k - 1, k + 2)) / 3;
      const trail = sum(xs.slice(k - 2, k + 1)) / 3;
      const lead = sum(xs.slice(k, k + 3)) / 3;
      const nb = (xs[k - 1]! + xs[k + 1]!) / 2;
      const label = (v: number) => `${fixed(v, 1)}${c.unit}`;
      if ([ma, trail, lead, nb].some((v) => Math.abs(v - xs[k]!) < 1e-9)) throw new Reject();
      const tot = xs[k - 1]! + xs[k]! + xs[k + 1]!;
      return {
        stem: `次の表は、${c.what}を記録したものである。その${c.self}と前後1${c.period}ずつの3${c.period}間の平均を「3${c.period}間の移動平均」とするとき、${lab(k)}の3${c.period}間の移動平均として正しいものを一つ選べ。ただし、小数第2位を四捨五入した値で答えよ。`,
        figure: {
          type: 'table',
          title: c.title,
          columns: [c.head, c.col],
          rows: xs.map((x, i) => [c.labels[i]!, x]),
          headerColumn: true,
        },
        ...choicesFrom(
          { value: ma, label: label(ma), note: `正しい。${lab(k - 1)}・${lab(k)}・${lab(k + 1)}の合計${tot}${c.unit}を3で割る。` },
          [
            { value: xs[k]!, label: label(xs[k]!), note: `平均をとらず、${lab(k)}の値をそのまま答えたもの。` },
            { value: trail, label: label(trail), note: `${lab(k)}とその前の2つ（${lab(k - 2)}〜${lab(k)}）で平均した値。この問題の定義は前後1${c.period}ずつである。` },
            { value: lead, label: label(lead), note: `${lab(k)}とその後の2つ（${lab(k)}〜${lab(k + 2)}）で平均した値。この問題の定義は前後1${c.period}ずつである。` },
            { value: nb, label: label(nb), note: `前後の${lab(k - 1)}と${lab(k + 1)}の2つだけを平均した値。${lab(k)}自身の値も入れて3つで平均する。` },
          ],
          { rng },
        ),
        explanation: `正答は${label(ma)}である。${lab(k)}の3${c.period}間の移動平均は、${lab(k - 1)}・${lab(k)}・${lab(k + 1)}の平均である。\n$(${xs[k - 1]}+${xs[k]}+${xs[k + 1]})\\div 3=${tot}\\div 3=${approx(tot / 3)}$ となり、小数第2位を四捨五入して${label(ma)}。`,
      };
    },
  },
];
