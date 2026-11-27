/** 変動係数による散らばりの比較・z得点・偏差値の類題 */
import { choicesFrom, fixed, int, pick, shuffledChoices } from '../kit.ts';
import { Reject, type QuestionGenerator } from '../types.ts';

const CV_TABLES = [
  { title: '果物1個あたりの重さ', lead: 'ある農園で収穫した4種類の果物について、1個あたりの重さの平均と標準偏差をまとめたものである。', head: '果物', names: ['りんご', 'なし', 'もも', 'かき', 'みかん', 'キウイ'], unit: 'g', means: [80, 100, 120, 160, 200, 240, 280, 300, 320] },
  { title: '1日の来客数', lead: '同じチェーンの4つの店舗について、1日の来客数の平均と標準偏差を1年分のデータから求めたものである。', head: '店舗', names: ['P店', 'Q店', 'R店', 'S店'], unit: '人', means: [60, 80, 100, 120, 150, 180, 200, 240, 250] },
  { title: '部品の長さ', lead: 'ある工場で作る4種類の部品について、長さの平均と標準偏差をまとめたものである。', head: '部品', names: ['部品A', '部品B', '部品C', '部品D'], unit: 'mm', means: [20, 40, 50, 60, 80, 100, 120, 150] },
  { title: '1か月の電気代', lead: '4つの地区について、世帯ごとの1か月の電気代の平均と標準偏差をまとめたものである。', head: '地区', names: ['北地区', '南地区', '東地区', '西地区'], unit: '円', means: [6000, 7000, 8000, 9000, 10000, 12000] },
];

const SCORE_CONTEXTS = [
  { lead: (m: number, s: number) => `あるクラスの漢字テストの得点は、平均${m}点、標準偏差${s}点であった。`, who: 'Aさんの得点', unit: '点', lo: 45, hi: 70 },
  { lead: (m: number, s: number) => `ある学年の反復横とびの回数は、平均${m}回、標準偏差${s}回であった。`, who: 'Aさんの回数', unit: '回', lo: 40, hi: 55 },
  { lead: (m: number, s: number) => `ある模擬試験の英語の得点は、平均${m}点、標準偏差${s}点であった。`, who: 'Aさんの得点', unit: '点', lo: 45, hi: 65 },
  { lead: (m: number, s: number) => `ある工場の1日あたりの製品の出荷数は、平均${m}箱、標準偏差${s}箱であった。`, who: 'ある日の出荷数', unit: '箱', lo: 80, hi: 160 },
  { lead: (m: number, s: number) => `ある中学校の男子の握力は、平均${m}kg、標準偏差${s}kgであった。`, who: 'Aさんの握力', unit: 'kg', lo: 28, hi: 38 },
];

const comma = (n: number) => n.toLocaleString('en-US');

export const generators: QuestionGenerator[] = [
  {
    id: 'cv-standardize-cv-compare',
    unitId: 'cv-standardize',
    skill: '変動係数による散らばりの比較（表）',
    grade: 3,
    difficulty: 2,
    replaces: ['cv-standardize-q03'],
    build(rng) {
      const t = pick(rng, CV_TABLES);
      // 4つの名前と平均を選び、変動係数（整数%）から標準偏差を逆算する
      const names = [...t.names];
      for (let i = names.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [names[i], names[j]] = [names[j]!, names[i]!];
      }
      const used = names.slice(0, 4);
      const meansPool = [...t.means];
      const means: number[] = [];
      while (means.length < 4) {
        const m = pick(rng, meansPool);
        if (!means.includes(m)) means.push(m);
      }
      const pcts: number[] = [];
      while (pcts.length < 4) {
        const p = int(rng, 4, 25);
        if (pcts.every((q) => Math.abs(q - p) >= 2)) pcts.push(p);
      }
      const sds = means.map((m, i) => (m * pcts[i]!) / 100);
      if (sds.some((s) => !Number.isInteger(s * 10))) throw new Reject();
      const best = pcts.indexOf(Math.max(...pcts));
      const maxSd = sds.indexOf(Math.max(...sds));
      const minCv = pcts.indexOf(Math.min(...pcts));
      // 標準偏差だけで比べると別の答えになるデータだけ使う
      if (maxSd === best) throw new Reject();
      const cv = (i: number) => fixed(pcts[i]! / 100, 2);
      const calc = (i: number) => `$${sds[i]}\\div ${means[i]}=${cv(i)}$`;
      const note = (i: number) => {
        const pre = i === maxSd ? '標準偏差だけで比べると最も大きいが、平均も大きい。' : i === minCv ? '平均を標準偏差で割ると最も大きくなる（分子と分母が逆）が、' : '';
        return `${pre}変動係数は${calc(i)}で、${used[best]}の${cv(best)}より小さい。`;
      };
      const others = [0, 1, 2, 3].filter((i) => i !== best);
      return {
        stem: `次の表は、${t.lead}変動係数で比べたとき、平均に対する散らばりが相対的に最も大きい${t.head}を一つ選べ。`,
        figure: {
          type: 'table',
          title: t.title,
          columns: [t.head, `平均（${t.unit}）`, `標準偏差（${t.unit}）`],
          rows: used.map((nm, i) => [nm, comma(means[i]!), comma(sds[i]!)]),
          headerColumn: true,
        },
        ...shuffledChoices(
          rng,
          { label: used[best]!, note: `正しい。変動係数は${calc(best)}で、4つの中で最も大きい。` },
          others.map((i) => ({ label: used[i]!, note: note(i) })),
        ),
        explanation: `${used[best]}である。変動係数は「標準偏差÷平均」で、平均に対する散らばりの大きさを表す。\n${used.map((nm, i) => `${nm}: ${calc(i)}`).join('\n')}\n最も大きいのは${used[best]}の${cv(best)}。標準偏差が最も大きいのは${used[maxSd]}だが、平均も大きいので相対的な散らばりは大きくない。`,
      };
    },
  },
  {
    id: 'cv-standardize-z',
    unitId: 'cv-standardize',
    skill: 'z得点の計算',
    grade: 3,
    difficulty: 1,
    replaces: ['cv-standardize-q02'],
    build(rng) {
      const c = pick(rng, SCORE_CONTEXTS);
      const m = int(rng, c.lo, c.hi);
      const s = pick(rng, [4, 5, 6, 8, 10, 12, 15, 16, 20]);
      const z = pick(rng, [-2, -1.75, -1.5, -1.25, -0.75, -0.5, 0.5, 0.75, 1.25, 1.5, 1.75, 2, 2.25, 2.5]);
      const x = m + z * s;
      if (!Number.isInteger(x) || x <= 0) throw new Reject();
      if (c.unit === '点' && x > 100) throw new Reject();
      const diff = x - m;
      const label = (v: number) => `$${fixed(v, 2)}$`;
      const above = diff > 0;
      return {
        stem: `${c.lead(m, s)}${c.who}は${x}${c.unit}であった。この値を標準化した値（z得点）として正しいものを一つ選べ。ただし、割り切れない値は小数第3位を四捨五入してある。`,
        ...choicesFrom(
          { value: z, label: label(z), note: `正しい。平均との差$${diff}$を標準偏差${s}で割ると$${fixed(z, 2)}$になる。` },
          [
            { value: -z, label: label(-z), note: `「平均−値」と引く順を逆にして$(${m}-${x})\\div ${s}$を計算した値。平均より${above ? '大きい' : '小さい'}値のz得点は${above ? '正' : '負'}になる。` },
            { value: s / diff, label: label(s / diff), note: `標準偏差${s}を平均との差$${diff}$で割った値。割る数と割られる数が逆になっている。` },
            { value: x / m, label: label(x / m), note: `値${x}を平均${m}で割った値。標準化では平均を引いてから標準偏差で割る。` },
            { value: diff, label: label(diff), note: `平均との差$${x}-${m}=${diff}$を求めただけで、標準偏差で割っていない値。` },
            { value: diff / (s * s), label: label(diff / (s * s)), note: `平均との差を、標準偏差${s}ではなく分散$${s}^2=${s * s}$で割った値。` },
          ],
          { rng },
        ),
        explanation: `z得点は${fixed(z, 2)}である。標準化は、値から平均を引いて標準偏差で割る。\n$$z=\\dfrac{${x}-${m}}{${s}}=\\dfrac{${diff}}{${s}}=${z}$$\n平均より標準偏差の${Math.abs(z)}倍だけ${above ? '上' : '下'}にいる。`,
      };
    },
  },
  {
    id: 'cv-standardize-deviation-score',
    unitId: 'cv-standardize',
    skill: '得点から偏差値を求める',
    grade: 3,
    difficulty: 2,
    replaces: ['cv-standardize-q05'],
    build(rng) {
      const subject = pick(rng, ['数学', '英語', '国語', '理科', '社会'] as const);
      const exam = pick(rng, ['模擬試験', '学力テスト', '実力試験'] as const);
      const m = int(rng, 42, 68);
      const s = pick(rng, [5, 8, 10, 12, 15, 16, 20, 25]);
      const z = int(rng, -18, 25) / 10;
      if (z === 0 || Math.abs(z) < 0.3) throw new Reject();
      const x = Math.round((m + z * s) * 1e6) / 1e6;
      if (!Number.isInteger(x) || x < 0 || x > 100) throw new Reject();
      const diff = x - m;
      const T = 50 + 10 * z;
      const label = (v: number) => `$${fixed(v, 1)}$`;
      const zs = String(Math.round(z * 10) / 10);
      const zp = z < 0 ? `(${zs})` : zs;
      const tenZ = Math.round(10 * z * 10) / 10;
      return {
        stem: `ある${exam}の${subject}の得点は、平均${m}点、標準偏差${s}点であった。${x}点だったAさんの偏差値として正しいものを一つ選べ。ただし、偏差値は$50+10z$（$z$は得点を標準化した値）で求める。`,
        ...choicesFrom(
          { value: T, label: label(T), note: `正しい。$z=${zs}$なので$50+10\\times ${zp}=${fixed(T, 1)}$。` },
          [
            { value: tenZ, label: label(tenZ), note: `$10z=${tenZ}$を求めただけで、50を足し忘れた値。` },
            { value: 50 + z, label: label(50 + z), note: `z得点を10倍せずに、$50+${zp}$とした値。` },
            { value: m + tenZ, label: label(m + tenZ), note: `50ではなく平均の${m}に$10z$を足した値。偏差値の基準は、平均が何点でも50である。` },
            { value: 50 + diff, label: label(50 + diff), note: `平均との差$${diff}$点を標準偏差で割らず、そのまま50に足した値。` },
            { value: 50 - tenZ, label: label(50 - tenZ), note: `「平均−得点」と引く順を逆にしてz得点の符号を取り違えた値。` },
          ],
          { rng },
        ),
        explanation: `偏差値は${fixed(T, 1)}である。まず得点を標準化する。\n$$z=\\dfrac{${x}-${m}}{${s}}=\\dfrac{${diff}}{${s}}=${zs}$$\n次に偏差値の式に入れる。\n$$50+10\\times ${zp}=${fixed(T, 1)}$$`,
      };
    },
  },
];
