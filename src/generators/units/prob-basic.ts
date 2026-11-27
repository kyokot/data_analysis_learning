/** 確率の基礎（同様に確からしい・2個のさいころ・余事象）の類題 */
import { choicesFrom, frac, int, pick, type Candidate } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

/** 分数の選択肢（値で並べ、表示は既約分数） */
function fc(n: number, d: number, note: string): Candidate {
  return { value: n / d, label: `$${frac(n, d)}$`, note };
}

/** 約分の途中式（約分できなければ分数だけ） */
function reduceTex(n: number, d: number): string {
  const r = frac(n, d);
  return r === `\\dfrac{${n}}{${d}}` ? r : `\\dfrac{${n}}{${d}}=${r}`;
}

const BALL_CONTEXTS = [
  { intro: (n: number) => `抽選箱の中に、1から${n}までの整数が1つずつ書かれた、同じ大きさの玉が${n}個入っている。よくかき混ぜてから玉を1個取り出す`, obj: '取り出した玉に書かれた数', each: 'どの玉を取り出すこと' },
  { intro: (n: number) => `1から${n}までの番号が1つずつ書かれた${n}枚の番号札がある。よくきってから1枚引く`, obj: '引いた番号札の番号', each: 'どの番号札を引くこと' },
  { intro: (n: number) => `あるクラスの生徒${n}人には、1から${n}までの出席番号が1つずつついている。くじで発表者を1人選ぶ`, obj: '選ばれた生徒の出席番号', each: 'どの生徒が選ばれること' },
  { intro: (n: number) => `ある会場の座席には1から${n}までの番号がついていて、${n}人の参加者に座席をくじで1つずつ割り当てる。Aさんがくじを引く`, obj: 'Aさんの座席の番号', each: 'どの座席が割り当てられること' },
];

type DiceEvent = { text: string; test: (s: number) => boolean; desc: string };

function diceEvent(rng: () => number): DiceEvent {
  const kind = int(rng, 0, 3);
  if (kind === 0) {
    const s = pick(rng, [3, 4, 5, 6, 8, 9, 10, 11]);
    return { text: `出た目の和が${s}になる`, test: (x) => x === s, desc: `和が${s}` };
  }
  if (kind === 1) {
    const s = int(rng, 9, 11);
    return { text: `出た目の和が${s}以上になる`, test: (x) => x >= s, desc: `和が${s}以上` };
  }
  if (kind === 2) {
    const s = int(rng, 3, 5);
    return { text: `出た目の和が${s}以下になる`, test: (x) => x <= s, desc: `和が${s}以下` };
  }
  const m = pick(rng, [4, 5, 6]);
  return { text: `出た目の和が${m}の倍数になる`, test: (x) => x % m === 0, desc: `和が${m}の倍数` };
}

/** 場面と、その場面での「2つの目」の呼び方（1個を2回投げるときは「2回」で数える） */
const DICE_WHO = [
  { text: 'AさんとBさんが、さいころを1個ずつ同時に投げる', two: '2個の目', first: 'Aさんの目', second: 'Bさんの目', distinct: 'AさんとBさんのさいころは区別して数える' },
  { text: '大小2個のさいころを同時に投げる', two: '2個の目', first: '大の目', second: '小の目', distinct: '大小2個のさいころは区別して数える' },
  { text: '1個のさいころを2回続けて投げる', two: '2回の目', first: '1回目の目', second: '2回目の目', distinct: '1回目と2回目は区別して数える' },
  { text: 'すごろく遊びで、赤と青の2個のさいころを同時に投げる', two: '2個の目', first: '赤の目', second: '青の目', distinct: '赤と青の2個のさいころは区別して数える' },
];

type Repeat = { trial: string; ev: string; neg: string; cnt: string; at: string; a: number; b: number; n: number; cond: string; why: string };

/** くり返しの試行の場面を1つ作る（1回で起こる確率は a/b） */
function makeRepeat(rng: () => number): Repeat {
  const kind = int(rng, 0, 4);
  if (kind === 0) {
    const n = int(rng, 2, 4);
    return { trial: `1枚の硬貨を${n}回続けて投げる`, ev: '表が出る', neg: '表が出ない', cnt: '回', at: '少なくとも1回は表が出る', a: 1, b: 2, n, cond: '硬貨の表と裏の出方は同様に確からしいとする', why: '表と裏の2通りのうち表は1通り' };
  }
  if (kind === 1) {
    const n = int(rng, 2, 3);
    const f = pick(rng, [
      { ev: '6の目', faces: [6] },
      { ev: '1の目', faces: [1] },
      { ev: '5以上の目', faces: [5, 6] },
      { ev: '2以下の目', faces: [1, 2] },
      { ev: '3の倍数の目', faces: [3, 6] },
      { ev: '4以上の目', faces: [4, 5, 6] },
    ]);
    return {
      trial: `1個のさいころを${n}回続けて投げる`,
      ev: `${f.ev}が出る`,
      neg: `${f.ev}が出ない`,
      cnt: '回',
      at: `少なくとも1回は${f.ev}が出る`,
      a: f.faces.length,
      b: 6,
      n,
      cond: 'さいころのどの目が出ることも同様に確からしいとする',
      why: `6通りの目のうち${f.ev}は${f.faces.join(', ')}の${f.faces.length}通り`,
    };
  }
  if (kind === 2) {
    const n = int(rng, 2, 3);
    const k = int(rng, 3, 5);
    return {
      trial: `${k}つの選択肢から1つを選ぶクイズ${n}問に、すべてあてずっぽうで答える`,
      ev: '正解する',
      neg: '不正解になる',
      cnt: '問',
      at: '少なくとも1問は正解する',
      a: 1,
      b: k,
      n,
      cond: `どの問題でも、${k}つの選択肢のどれを選ぶことも同様に確からしく、正解はそれぞれ1つとする`,
      why: `${k}つの選択肢のうち正解は1つ`,
    };
  }
  if (kind === 3) {
    const n = int(rng, 2, 3);
    const r = int(rng, 1, 3);
    const w = int(rng, 1, 4);
    if (r === w) throw new Reject();
    return {
      trial: `赤玉${r}個と白玉${w}個が入った袋から玉を1個取り出し、色を見てからもとに戻すことを${n}回くり返す`,
      ev: '赤玉が出る',
      neg: '赤玉が出ない',
      cnt: '回',
      at: '少なくとも1回は赤玉が出る',
      a: r,
      b: r + w,
      n,
      cond: 'どの玉を取り出すことも同様に確からしいとする',
      why: `${r + w}個の玉のうち赤玉は${r}個`,
    };
  }
  const n = int(rng, 2, 3);
  const N = int(rng, 5, 10);
  const h = int(rng, 1, 3);
  return {
    trial: `${N}本のうち当たりが${h}本入ったくじがある。1本引いて結果を見たらもとに戻し、よくかき混ぜることを${n}回くり返す`,
    ev: '当たりを引く',
    neg: '当たりを引かない',
    cnt: '回',
    at: '少なくとも1回は当たりを引く',
    a: h,
    b: N,
    n,
    cond: 'どのくじを引くことも同様に確からしいとする',
    why: `${N}本のうち当たりは${h}本`,
  };
}

export const generators: QuestionGenerator[] = [
  {
    id: 'prob-basic-multiple',
    unitId: 'prob-basic',
    skill: '同様に確からしい場合の確率（1回の試行）',
    grade: 4,
    difficulty: 1,
    replaces: ['prob-basic-q01'],
    build(rng) {
      const c = pick(rng, BALL_CONTEXTS);
      const n = int(rng, 12, 40);
      const m = int(rng, 3, 7);
      if (n % m === 0) throw new Reject();
      const k = Math.floor(n / m);
      // 倍数が1個だけだと「m自身を数えない」誤りが0個（確率0）になって不自然なので作り直す
      if (k < 2) throw new Reject();
      const list = Array.from({ length: k }, (_, i) => (i + 1) * m);
      const not = rng() < 0.5;
      const head = `${c.intro(n)}とき、${c.obj}が${m}の倍数${not ? 'でない' : 'である'}確率として正しいものを一つ選べ。ただし、${c.each}も同様に確からしいとする。`;
      const count = `1から${n}までの${m}の倍数は ${list.join(', ')} の${k}個（$${n}\\div ${m}=${k}$ あまり ${n % m}）。`;
      if (!not) {
        return {
          stem: head,
          ...choicesFrom(
            fc(k, n, `正しい。1から${n}までに${m}の倍数は${k}個あるので、$\\dfrac{${k}}{${n}}$。`),
            [
              fc(1, m, `「${m}つに1つは${m}の倍数」と考えた値。${n}は${m}で割り切れないので、実際に数えると${k}個で、$\\dfrac{1}{${m}}$ にはならない。`),
              fc(n - k, n, `${m}の倍数で**ない**数の個数${n - k}を数えた値（余事象の確率）。`),
              fc(k, n - k, `${m}の倍数の個数${k}を、全体の${n}ではなく${m}の倍数でない数の個数${n - k}で割った値。分母は起こりうるすべての場合の数である。`),
              fc(k - 1, n, `${m}自身を${m}の倍数に入れずに、${k - 1}個と数えた値。${m}も${m}の倍数である。`),
            ],
            { rng },
          ),
          explanation: `答えは$${frac(k, n)}$。起こりうる場合は全部で${n}通りで、どれも同様に確からしい。\n${count}\n$$${reduceTex(k, n)}$$`,
        };
      }
      return {
        stem: head,
        ...choicesFrom(
          fc(n - k, n, `正しい。${m}の倍数は${k}個なので、${m}の倍数でない数は$${n}-${k}=${n - k}$個で、$\\dfrac{${n - k}}{${n}}$。`),
          [
            fc(k, n, `${m}の倍数である確率を答えたもの。問われているのは${m}の倍数で**ない**確率である。`),
            fc(m - 1, m, `「${m}つのうち${m - 1}つは${m}の倍数でない」と考えた値。${n}は${m}で割り切れないので、実際に数えると${n - k}個で、$\\dfrac{${m - 1}}{${m}}$ にはならない。`),
            fc(n - k + 1, n, `${m}自身を${m}の倍数に入れずに、${m}の倍数でない数を${n - k + 1}個と数えた値。${m}も${m}の倍数である。`),
            fc(k, n - k, `${m}の倍数の個数${k}を${m}の倍数でない数の個数${n - k}で割った値。求めるのは${m}の倍数でない場合の数を、全体の${n}通りで割った値である。`),
          ],
          { rng },
        ),
        explanation: `答えは$${frac(n - k, n)}$。起こりうる場合は全部で${n}通りで、どれも同様に確からしい。\n${count}\nしたがって${m}の倍数でない数は $${n}-${k}=${n - k}$ 個。\n$$${reduceTex(n - k, n)}$$`,
      };
    },
  },
  {
    id: 'prob-basic-two-dice',
    unitId: 'prob-basic',
    skill: '2個のさいころの目の和の確率（表で数え上げる）',
    grade: 4,
    difficulty: 2,
    replaces: [],
    build(rng) {
      const ev = diceEvent(rng);
      const who = pick(rng, DICE_WHO);
      const ordered: [number, number][] = [];
      const unordered: [number, number][] = [];
      for (let a = 1; a <= 6; a++)
        for (let b = 1; b <= 6; b++) {
          if (!ev.test(a + b)) continue;
          ordered.push([a, b]);
          if (a <= b) unordered.push([a, b]);
        }
      const c = ordered.length;
      const u = unordered.length;
      const sums = Array.from({ length: 11 }, (_, i) => i + 2).filter(ev.test).length;
      if (c === 0 || u === c) throw new Reject();
      // 入れかえの例には、この事柄に当てはまる「目が違う組」を使う
      const ex = unordered.find(([a, b]) => a !== b)!;
      return {
        stem: `${who.text}とき、${ev.text}確率として正しいものを一つ選べ。ただし、さいころのどの目が出ることも同様に確からしいとする。`,
        ...choicesFrom(
          fc(c, 36, `正しい。${who.two}の出方36通りのうち、${ev.desc}になるのは${c}通り。`),
          [
            fc(u, 36, `（${ex[0]}, ${ex[1]}）と（${ex[1]}, ${ex[0]}）のように、${who.two}の入れかえを1通りとして数えた値（${u}通り）。${who.distinct}。`),
            fc(u, 21, '目の組を、入れかえを区別せずに全部で21通りとし、それらが同様に確からしいとみなした値。実際は（1, 1）は1通り、（1, 2）は（2, 1）と合わせて2通りで、起こりやすさが違う。'),
            fc(sums, 11, '目の和（2〜12）の11通りが同様に確からしいとみなした値。和が7になる出方は6通り、2になる出方は1通りのように、和によって起こりやすさが違う。'),
            fc(36 - c, 36, `${ev.desc}に**ならない**確率（余事象の確率）を答えたもの。`),
          ],
          { rng },
        ),
        explanation: `答えは$${frac(c, 36)}$。2個の目の出方は全部で$6\\times 6=36$通りで、どれも同様に確からしい。\n（1個目の目, 2個目の目）と表すと、${ev.desc}になるのは ${ordered.map(([a, b]) => `（${a}, ${b}）`).join('')} の${c}通り。\n$$${reduceTex(c, 36)}$$`,
      };
    },
  },
  {
    id: 'prob-basic-at-least-one',
    unitId: 'prob-basic',
    skill: '「少なくとも1回」の確率（余事象）',
    grade: 4,
    difficulty: 2,
    replaces: ['prob-basic-q03'],
    build(rng) {
      const r = makeRepeat(rng);
      const { a, b, n } = r;
      const den = b ** n;
      const none = (b - a) ** n;
      const all = a ** n;
      const one = n * a * (b - a) ** (n - 1);
      const wrongs: Candidate[] = [
        fc(none, den, `${n}${r.cnt}とも${r.neg}確率（余事象の確率）。答えは1からこれを引いたものである。`),
        fc(one, den, `「ちょうど1${r.cnt}だけ${r.ev}」確率。「少なくとも1${r.cnt}」には、2${r.cnt}以上${r.ev}場合も含まれる。`),
        fc(all, den, `${n}${r.cnt}とも${r.ev}確率。「少なくとも1${r.cnt}」は、1${r.cnt}でも${r.ev}場合をすべて含む。`),
        fc(a, b, `1${r.cnt}だけを見たときの確率のまま。${n}${r.cnt}あるので、少なくとも1${r.cnt}${r.ev}確率はこれより大きい。`),
      ];
      if (n * a < b) wrongs.push(fc(n * a, b, `1${r.cnt}あたりの確率 $${frac(a, b)}$ を${n}${r.cnt}分足した値。2${r.cnt}以上${r.ev}場合を重ねて数えてしまっている。`));
      const pa = frac(a, b);
      const pq = frac(b - a, b);
      return {
        stem: `${r.trial}。このとき、${r.at}確率として正しいものを一つ選べ。ただし、${r.cond}。`,
        ...choicesFrom(
          fc(den - none, den, `正しい。余事象「${n}${r.cnt}とも${r.neg}」の確率 $${frac(none, den)}$ を1から引く。`),
          wrongs,
          { rng },
        ),
        explanation: `答えは$${frac(den - none, den)}$。「${r.at}」の余事象は「${n}${r.cnt}とも${r.neg}」である。\n1${r.cnt}で${r.ev}確率は、${r.why}なので$${pa}$。${r.neg}確率は$1-${pa}=${pq}$。\n${n}${r.cnt}とも${r.neg}確率は$${Array(n).fill(pq).join('\\times ')}=${frac(none, den)}$。\n$$1-${frac(none, den)}=${frac(den - none, den)}$$`,
      };
    },
  },
];
