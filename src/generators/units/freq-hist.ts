/** 度数分布表（相対度数・累積度数・累積相対度数）の類題 */
import { choicesFrom, fixed, int, pick, sum, type Candidate } from '../kit.ts';
import type { Rng } from '../../engine/rng.ts';
import type { Figure } from '../../content/types.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

const CONTEXTS = [
  { scene: 'ある中学校の生徒', count: '人', what: '通学時間', unit: '分', start: 0, width: 10 },
  { scene: 'ある市の体力測定に参加した中学生', count: '人', what: 'ハンドボール投げの記録', unit: 'm', start: 5, width: 5 },
  { scene: 'ある病院の外来の患者', count: '人', what: '待ち時間', unit: '分', start: 0, width: 5 },
  { scene: 'ある果樹園で収穫したりんご', count: '個', what: '重さ', unit: 'g', start: 240, width: 20 },
  { scene: 'ある高校の生徒', count: '人', what: '1日の家庭学習の時間', unit: '分', start: 0, width: 20 },
];

/** 合計 N の度数を k 個の階級に山形に配る（どの階級も 1 以上） */
function makeCounts(rng: Rng, N: number, k: number): number[] {
  const peak = int(rng, 1, k - 2);
  const w = Array.from({ length: k }, (_, i) => Math.max(1, 6 - 2 * Math.abs(i - peak)) + int(rng, 0, 3));
  const tw = sum(w);
  const c = w.map((x) => Math.floor((x * N) / tw));
  let rest = N - sum(c);
  // 余りは山の近くから順に配る
  const order = c.map((_, i) => i).sort((a, b) => Math.abs(a - peak) - Math.abs(b - peak));
  for (let j = 0; rest > 0; j = (j + 1) % k, rest--) c[order[j]!]! += 1;
  if (c.some((x) => x < 1)) throw new Reject();
  return c;
}

function setup(rng: Rng) {
  const ctx = pick(rng, CONTEXTS);
  const N = pick(rng, [20, 25, 40, 50]);
  const k = int(rng, 5, 6);
  const counts = makeCounts(rng, N, k);
  const cls = counts.map((_, i) => `${ctx.start + ctx.width * i}以上${ctx.start + ctx.width * (i + 1)}未満`);
  const figure: Figure = {
    type: 'table',
    title: `${ctx.what}の度数分布表`,
    columns: [`階級（${ctx.unit}）`, `度数（${ctx.count}）`],
    rows: [...cls.map((c, i) => [c, counts[i]!]), ['合計', N]],
    headerColumn: true,
  };
  // 問う階級は、最初と最後以外
  const t = int(rng, 1, k - 2);
  const cum = sum(counts.slice(0, t + 1));
  return { ctx, N, k, counts, cls, figure, t, cum, f: counts[t]!, next: counts[t + 1]! };
}

export const generators: QuestionGenerator[] = [
  {
    id: 'freq-hist-relative',
    unitId: 'freq-hist',
    skill: '相対度数の計算',
    grade: 4,
    difficulty: 1,
    replaces: [],
    build(rng) {
      const { ctx, N, counts, cls, figure, t, cum, f } = setup(rng);
      // 小数第2位で割り切れる合計だけ使う
      if ((f * 100) % N !== 0) throw new Reject();
      const lab = (v: number) => fixed(v, 2);
      const prev = cum - f;
      const wrongs: Candidate[] = [
        { value: f / 100, label: lab(f / 100), note: `$${f}\\div 100$と、度数の合計を100とした値。割る数は度数の合計${N}である。` },
        { value: cum / N, label: lab(cum / N), note: `最初の階級からこの階級までの度数を足した$${cum}\\div ${N}$で、累積相対度数になっている。` },
        { value: (N - f) / N, label: lab((N - f) / N), note: `この階級以外の度数$${N - f}$を合計で割った値。相対度数はその階級の度数を合計で割る。` },
        { value: prev / N, label: lab(prev / N), note: `1つ前の階級までの累積度数$${prev}$を合計で割った値。この階級の度数${f}を使う。` },
      ];
      return {
        stem: `次の表は、${ctx.scene}${N}${ctx.count}の${ctx.what}をまとめた度数分布表である。「${cls[t]}」の階級の相対度数として正しいものを一つ選べ。`,
        figure,
        ...choicesFrom({ value: f / N, label: lab(f / N), note: `正しい。$${f}\\div ${N}=${lab(f / N)}$。` }, wrongs, { rng }),
        explanation: `正答は${lab(f / N)}。相対度数は「その階級の度数 ÷ 度数の合計」。\n「${cls[t]}」の度数は${f}、合計は${N}なので、$${f}\\div ${N}=${lab(f / N)}$。\n（表の度数は ${counts.join(', ')} で、合計は${N}${ctx.count}。）`,
      };
    },
  },
  {
    id: 'freq-hist-cumulative',
    unitId: 'freq-hist',
    skill: '累積度数と累積相対度数の計算',
    grade: 4,
    difficulty: 2,
    replaces: ['freq-hist-q04'],
    build(rng) {
      const { ctx, N, counts, cls, figure, t, cum, f, next } = setup(rng);
      const vals = [cum, f, cum - f, cum + next];
      if (vals.some((v) => (v * 100) % N !== 0)) throw new Reject();
      const u = ctx.count;
      const lab = (c: number, r: number) => `累積度数${c}${u}、累積相対度数${fixed(r, 2)}`;
      const cand = (c: number, r: number, note: string): Candidate => ({ value: c * 10 + r, label: lab(c, r), note });
      const upto = counts.slice(0, t + 1).join('+');
      const wrongs: Candidate[] = [
        cand(f, f / N, `その階級だけの度数${f}${u}と相対度数$${f}\\div ${N}$を答えた組合せ。累積では、それより前の階級の度数も足す。`),
        cand(cum - f, (cum - f) / N, `1つ前の階級までを足した${cum - f}${u}と$${cum - f}\\div ${N}$の組合せ。問われた階級自身の${f}${u}を足し忘れている。`),
        cand(cum + next, (cum + next) / N, `次の階級まで足した${cum + next}${u}と$${cum + next}\\div ${N}$の組合せ。足し上げるのは問われた階級までである。`),
        cand(cum, cum / 100, `累積度数は正しいが、${cum}を度数の合計${N}ではなく100で割った組合せ。`),
        cand(cum, f / N, `累積度数は正しいが、累積相対度数のところにその階級だけの相対度数$${f}\\div ${N}$を入れた組合せ。`),
      ];
      return {
        stem: `次の表は、${ctx.scene}${N}${u}の${ctx.what}をまとめた度数分布表である。「${cls[t]}」の階級の累積度数と累積相対度数の組合せとして正しいものを一つ選べ。`,
        figure,
        ...choicesFrom(cand(cum, cum / N, `正しい。$${upto}=${cum}$、$${cum}\\div ${N}=${fixed(cum / N, 2)}$。`), wrongs, { rng }),
        explanation: `正答は累積度数${cum}${u}、累積相対度数${fixed(cum / N, 2)}。\n累積度数は、最初の階級からその階級までの度数を足し上げた値で、$${upto}=${cum}$（${u}）。\n累積相対度数は累積度数を度数の合計で割った値で、$${cum}\\div ${N}=${fixed(cum / N, 2)}$。これは「${ctx.what}が${ctx.start + ctx.width * (t + 1)}${ctx.unit}未満の${u === '人' ? '人' : 'もの'}が${cum}${u}で、全体の${num100(cum / N)}%」という意味になる。`,
      };
    },
  },
];

function num100(r: number): string {
  return String(Math.round(r * 100));
}
