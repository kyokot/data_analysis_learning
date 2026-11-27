/**
 * RichText（簡易マークアップ）の構文解析。描画（React）と検証（CLI）の両方から使う。
 *
 *   $...$     インライン数式
 *   $$...$$   ディスプレイ数式
 *   **...**   強調（中に数式を含められる）
 *   改行      段落区切り
 */

export type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display: boolean }
  | { kind: 'bold'; children: InlineToken[] };

export class RichTextError extends Error {}

function tokenizeInline(src: string, allowBold: boolean): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buf = '';
  let i = 0;
  const flush = () => {
    if (buf) tokens.push({ kind: 'text', value: buf });
    buf = '';
  };
  while (i < src.length) {
    if (src.startsWith('$$', i)) {
      const end = src.indexOf('$$', i + 2);
      if (end < 0) throw new RichTextError(`"$$" が閉じられていません: ${src}`);
      flush();
      tokens.push({ kind: 'math', value: src.slice(i + 2, end).trim(), display: true });
      i = end + 2;
    } else if (src[i] === '$') {
      const end = src.indexOf('$', i + 1);
      if (end < 0) throw new RichTextError(`"$" が閉じられていません: ${src}`);
      const body = src.slice(i + 1, end);
      if (!body.trim()) throw new RichTextError(`空の数式があります: ${src}`);
      flush();
      tokens.push({ kind: 'math', value: body.trim(), display: false });
      i = end + 1;
    } else if (src.startsWith('**', i)) {
      if (!allowBold) throw new RichTextError(`"**" を入れ子にはできません: ${src}`);
      const end = findBoldEnd(src, i + 2);
      if (end < 0) throw new RichTextError(`"**" が閉じられていません: ${src}`);
      flush();
      tokens.push({ kind: 'bold', children: tokenizeInline(src.slice(i + 2, end), false) });
      i = end + 2;
    } else {
      buf += src[i];
      i += 1;
    }
  }
  flush();
  return tokens;
}

/** 数式の中の `**`（べき乗など）を強調の終端と誤認しないよう、$ の外側だけを探す */
function findBoldEnd(src: string, from: number): number {
  let inMath = false;
  for (let i = from; i < src.length; i++) {
    if (src[i] === '$') inMath = !inMath;
    else if (!inMath && src.startsWith('**', i)) return i;
  }
  return -1;
}

/** 段落（行）ごとのトークン列に分解する。構文エラーは RichTextError を投げる。 */
export function parseRichText(text: string): InlineToken[][] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => tokenizeInline(line, true));
}

/** テキスト中の数式（TeX ソース）をすべて取り出す */
export function extractMath(text: string): { tex: string; display: boolean }[] {
  const out: { tex: string; display: boolean }[] = [];
  const walk = (tokens: InlineToken[]) => {
    for (const t of tokens) {
      if (t.kind === 'math') out.push({ tex: t.value, display: t.display });
      else if (t.kind === 'bold') walk(t.children);
    }
  };
  parseRichText(text).forEach(walk);
  return out;
}

/** マークアップを取り除いたプレーンテキスト（aria-label や検索用） */
export function plainText(text: string): string {
  const walk = (tokens: InlineToken[]): string =>
    tokens.map((t) => (t.kind === 'text' ? t.value : t.kind === 'math' ? t.value : walk(t.children))).join('');
  try {
    return parseRichText(text).map(walk).join(' ');
  } catch {
    return text;
  }
}
