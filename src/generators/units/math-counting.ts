/** 場合の数（階乗・順列・組合せ）の類題 */
import { choicesFrom, int, pick, type Candidate } from '../kit.ts';
import type { QuestionGenerator } from '../types.ts';

function fact(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function perm(n: number, r: number): number {
  let p = 1;
  for (let i = 0; i < r; i++) p *= n - i;
  return p;
}
const comb = (n: number, r: number) => perm(n, r) / fact(r);
/** n×(n−1)×…（r 個）の TeX */
const prodDown = (n: number, r: number) => Array.from({ length: r }, (_, i) => n - i).join('\\times ');
const label = (v: number) => `${v}通り`;

const LINE_UP: { qs: string[]; text: (n: number, q: string) => string }[] = [
  { qs: ['理科', '社会', '総合学習', '英語'], text: (n, q) => `${q}の授業で、ある班の${n}人が1人ずつ順に調べ学習の結果を発表する。発表の順番の決め方は全部で何通りあるか。` },
  { qs: ['運動会', '地区大会', '校内大会', '記録会'], text: (n, q) => `${q}に向けて、${n}人の選手でリレーのチームを作り、${n}人全員が1回ずつ走る。走る順番の決め方は全部で何通りあるか。` },
  { qs: ['小説', '図鑑', '絵本', '辞典'], text: (n, q) => `種類の違う${n}冊の${q}を、本棚の1段に横一列に並べる。並べ方は全部で何通りあるか。` },
  { qs: ['会社の採用面接', '奨学金の面接', 'アルバイトの面接', '部活動の入部面接'], text: (n, q) => `ある${q}で、${n}人の応募者が1人ずつ面接を受ける。面接の順番の決め方は全部で何通りあるか。` },
  { qs: ['家族', '班の仲間', 'サークルの仲間', 'いとこどうし'], text: (n, q) => `${n}人の${q}が記念写真を撮るため、横一列に並ぶ。並び方は全部で何通りあるか。` },
];

const ROLES: { r: number; qs: string[]; text: (n: number, q: string) => string }[] = [
  { r: 2, qs: ['写真部', '美術部', '吹奏楽部', '陸上部'], text: (n, q) => `${q}の${n}人の部員の中から、部長と副部長を1人ずつ選ぶ（同じ人が兼ねることはない）。選び方は全部で何通りあるか。` },
  { r: 3, qs: ['体育祭', '文化祭', '合唱祭', '修学旅行'], text: (n, q) => `${q}の実行委員${n}人の中から、委員長・副委員長・書記を1人ずつ選ぶ（1人が2つ以上の役を兼ねることはない）。選び方は全部で何通りあるか。` },
  { r: 3, qs: ['バレーボール', 'ソフトボール', 'ドッジボール', 'バスケットボール'], text: (n, q) => `${n}チームが参加する${q}の大会で、1位・2位・3位の決まり方は全部で何通りあるか（同順位はないものとする）。` },
  { r: 2, qs: ['アンケート調査', '聞き取り調査', '商品の試食', '使い心地の調査'], text: (n, q) => `${n}人の応募者の中から、${q}の1番目の参加者と2番目の参加者を決める。決め方は全部で何通りあるか。` },
  { r: 3, qs: ['映画', 'アニメ', 'ドキュメンタリー', '演劇の記録映像'], text: (n, q) => `種類の違う${n}本の${q}の中から3本を選び、上映する順番（1本目・2本目・3本目）も決める。決め方は全部で何通りあるか。` },
];

const CHOOSE = [
  (n: number, r: number) => `${n}人のクラス委員の候補の中から、${r}人の代表を選ぶ（選ぶ順番は考えない）。選び方は全部で何通りあるか。`,
  (n: number, r: number) => `ピザ店で、${n}種類のトッピングの中から違う種類を${r}つ選んでのせる（のせる順番は考えない）。選び方は全部で何通りあるか。`,
  (n: number, r: number) => `サッカーのPK練習で${n}回キックし、1回ごとに「成功」か「失敗」かを順に記録する。${n}回のうち**ちょうど${r}回**が成功である記録のしかた（何回目が成功かの選び方）は何通りあるか。`,
  (n: number, r: number) => `図書室の新着本${n}冊の中から、違う本を${r}冊選んで借りる（借りる順番は考えない）。選び方は全部で何通りあるか。`,
  (n: number, r: number) => `ある商品のモニター${n}人の中から、聞き取り調査をする${r}人を選ぶ（順番は考えない）。選び方は全部で何通りあるか。`,
];

export const generators: QuestionGenerator[] = [
  {
    id: 'math-counting-factorial',
    unitId: 'math-counting',
    skill: '階乗の計算（全員を1列に並べる）',
    grade: 4,
    difficulty: 1,
    replaces: ['math-counting-q02'],
    build(rng) {
      const n = int(rng, 4, 8);
      const ans = fact(n);
      const ctx = pick(rng, LINE_UP);
      const terms = Array.from({ length: n }, (_, i) => n - i);
      const wrongs: Candidate[] = [
        { value: terms.reduce((a, b) => a + b, 0), label: label(terms.reduce((a, b) => a + b, 0)), note: `$${terms.join('+')}$と、かけ算にすべきところを足し算にした値。` },
        { value: n * n, label: label(n * n), note: `$${n}\\times ${n}$と、${n}を2回かけただけの値。並べ方の数は$${n}\\times ${n - 1}\\times \\cdots\\times 1$と1ずつ減らしてかける。` },
        { value: n ** n, label: label(n ** n), note: `$${n}$を${n}回かけた値。同じものを何度でも選べるとして数えている。一度並べたものは除くので、${n}、${n - 1}、…と減っていく。` },
        { value: fact(n - 1), label: label(fact(n - 1)), note: `$${n - 1}!$を計算した値。最後の1つも数に入れて、$${n}!$を計算する。` },
        { value: n * (n - 1), label: label(n * (n - 1)), note: `$${n}\\times ${n - 1}$と、最初の2つの位置だけで計算をやめた値。最後の位置まで続けてかける。` },
      ];
      return {
        stem: `${ctx.text(n, pick(rng, ctx.qs))}正しいものを一つ選べ。`,
        ...choicesFrom({ value: ans, label: label(ans), note: `正しい。$${n}!=${terms.join('\\times ')}=${ans}$。` }, wrongs, { rng }),
        explanation: `${ans}通りである。${n}個のものを1列に並べる並べ方は$${n}!$通り。\n1番目は${n}通り、2番目は残りから${n - 1}通り、…、最後は1通りなので、積の法則から$${n}!=${terms.join('\\times ')}=${ans}$（通り）。`,
      };
    },
  },
  {
    id: 'math-counting-perm',
    unitId: 'math-counting',
    skill: '順列の計算（選んで並べる）',
    grade: 4,
    difficulty: 1,
    replaces: [],
    build(rng) {
      const ctx = pick(rng, ROLES);
      const r = ctx.r;
      const n = int(rng, r + 3, 10);
      const ans = perm(n, r);
      const P = `{}_{${n}}\\mathrm{P}_{${r}}`;
      const C = `{}_{${n}}\\mathrm{C}_{${r}}`;
      const wrongs: Candidate[] = [
        { value: comb(n, r), label: label(comb(n, r)), note: `組合せ$${C}=${comb(n, r)}$で計算した値。役や順位が区別されるので、選んだ${r}人（個）の並べ方の$${r}!$通りも数える。` },
        { value: n ** r, label: label(n ** r), note: `$${n}$を${r}回かけた値。同じ人（もの）が2つ以上の役や順位を兼ねられるとして数えている。` },
        { value: n * r, label: label(n * r), note: `$${n}\\times ${r}$と、全体の数と選ぶ数をそのままかけた値。` },
        { value: n <= 7 ? fact(n) : NaN, label: label(fact(n)), note: `$${n}!$で、全員を1列に並べる並べ方を数えている。並べるのは選んだ${r}人（個）だけである。` },
        { value: ans * fact(r), label: label(ans * fact(r)), note: `$${P}=${ans}$に、さらに$${r}!$をかけた値。順列にはすでに選んだものの並べ方が入っているので、並べ方を二重に数えている。` },
        { value: fact(r), label: label(fact(r)), note: `$${r}!$で、選んだ${r}人（個）の並べ方だけを数えている。だれを選ぶかの数も考える。` },
      ];
      return {
        stem: `${ctx.text(n, pick(rng, ctx.qs))}正しいものを一つ選べ。`,
        ...choicesFrom({ value: ans, label: label(ans), note: `正しい。$${P}=${prodDown(n, r)}=${ans}$。` }, wrongs, { rng }),
        explanation: `${ans}通りである。${n}個のものから${r}個を選んで順番（役）をつけて並べるので順列で数え、$${P}$通り。\n$${P}=${prodDown(n, r)}=${ans}$（通り）。`,
      };
    },
  },
  {
    id: 'math-counting-comb',
    unitId: 'math-counting',
    skill: '組合せの計算（順番を考えずに選ぶ）',
    grade: 4,
    difficulty: 2,
    // 固定問題 q05（成功・失敗の記録のしかた＝何回目かの選び方）は文脈の読み替えが主眼で、
    // この類題の大半（そのまま「n人からr人を選ぶ」）とは技能が違うので置き換えない。
    replaces: [],
    build(rng) {
      const n = int(rng, 5, 10);
      const r = int(rng, 2, Math.min(4, n - 2));
      const ans = comb(n, r);
      const P = `{}_{${n}}\\mathrm{P}_{${r}}`;
      const C = `{}_{${n}}\\mathrm{C}_{${r}}`;
      const p = perm(n, r);
      const rf = fact(r);
      const rDown = prodDown(r, r);
      const wrongs: Candidate[] = [
        { value: p, label: label(p), note: `順列$${P}=${prodDown(n, r)}=${p}$で計算した値。選ぶ順番は区別しないので、$${r}!=${rf}$で割る必要がある。` },
        { value: n * r, label: label(n * r), note: `$${n}\\times ${r}$と、全体の数と選ぶ数をそのままかけた値。分子は${n}から1ずつ減らして${r}個かけ、$${r}!$で割る。` },
        { value: n + r, label: label(n + r), note: `$${n}+${r}$と、全体の数と選ぶ数を足した値。` },
        { value: p / r, label: label(p / r), note: `$${P}=${p}$を$${r}!$ではなく${r}で割った値。順番の重なりは$${r}!=${rf}$通りある。` },
        { value: n ** r, label: label(n ** r), note: `$${n}$を${r}回かけた値。同じものを何度でも選べて、しかも順番も区別する数え方になっている。` },
      ];
      return {
        stem: `${pick(rng, CHOOSE)(n, r)}正しいものを一つ選べ。`,
        ...choicesFrom({ value: ans, label: label(ans), note: `正しい。$${C}=\\dfrac{${prodDown(n, r)}}{${rDown}}=${ans}$。` }, wrongs, { rng }),
        explanation: `${ans}通りである。${n}個のものから${r}個を選ぶだけで順番は区別しないので、組合せ$${C}$で数える。\n$${C}=\\dfrac{${P}}{${r}!}=\\dfrac{${prodDown(n, r)}}{${rDown}}=\\dfrac{${p}}{${rf}}=${ans}$（通り）。`,
      };
    },
  },
];
