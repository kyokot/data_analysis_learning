import katex from 'katex';
import { Fragment, memo, type ReactNode } from 'react';
import { parseRichText, type InlineToken } from '../content/richtext.ts';

const cache = new Map<string, string>();

function renderMath(tex: string, display: boolean): string {
  const key = `${display ? 'D' : 'I'}${tex}`;
  let html = cache.get(key);
  if (html === undefined) {
    // 検証（validate-content）を通った数式だけが来る前提だが、万一のときも画面を落とさない
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' });
    cache.set(key, html);
  }
  return html;
}

function renderTokens(tokens: InlineToken[]): ReactNode {
  return tokens.map((t, i) => {
    if (t.kind === 'text') return <Fragment key={i}>{t.value}</Fragment>;
    if (t.kind === 'bold') return <strong key={i}>{renderTokens(t.children)}</strong>;
    return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(t.value, t.display) }} />;
  });
}

function safeParse(text: string): InlineToken[][] {
  try {
    return parseRichText(text);
  } catch {
    return [[{ kind: 'text', value: text }]];
  }
}

/** 段落つきのテキスト（問題文・解説など） */
export const Rich = memo(function Rich({ text, className }: { text: string; className?: string }) {
  const blocks = safeParse(text);
  return (
    <div className={`rich${className ? ` ${className}` : ''}`}>
      {blocks.map((tokens, i) => (
        <p key={i}>{renderTokens(tokens)}</p>
      ))}
    </div>
  );
});

/** 1 行に収めるテキスト（選択肢・見出し・表のセルなど）。改行は空白として扱う */
export const Inline = memo(function Inline({ text }: { text: string }) {
  const blocks = safeParse(text);
  return (
    <>
      {blocks.map((tokens, i) => (
        <Fragment key={i}>
          {i > 0 ? ' ' : null}
          {renderTokens(tokens)}
        </Fragment>
      ))}
    </>
  );
});

/** 公式（ディスプレイ数式）。tex は $ なしで渡す */
export function Formula({ tex }: { tex: string }) {
  return <div className="rich" dangerouslySetInnerHTML={{ __html: renderMath(tex, true) }} />;
}
