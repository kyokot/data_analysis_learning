/**
 * ハッシュ（#home, #unit-central など）だけで画面を切り替える小さなルーター。
 * サブパスに置いても、ファイルを直接開いても動くようにするため、パスは使わない。
 */
import { useSyncExternalStore, type AnchorHTMLAttributes, type ReactNode } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'route' }
  | { name: 'unit'; id: string }
  | { name: 'check'; id: string }
  | { name: 'review' }
  | { name: 'drill'; id?: string }
  | { name: 'mock' }
  | { name: 'mockrun' }
  | { name: 'result'; id: string }
  | { name: 'progress' }
  | { name: 'library' }
  | { name: 'guide' }
  | { name: 'data' }
  | { name: 'about' }
  | { name: 'figures' };

const SIMPLE = ['home', 'route', 'review', 'drill', 'mock', 'mockrun', 'progress', 'library', 'guide', 'data', 'about', 'figures'] as const;

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if ((SIMPLE as readonly string[]).includes(h)) return { name: h } as Route;
  const m = /^(unit|check|drill|result)-([a-z0-9-]+)$/.exec(h);
  if (m) return { name: m[1], id: m[2] } as Route;
  return { name: 'home' };
}

export function toHash(r: Route): string {
  return 'id' in r && r.id ? `#${r.name}-${r.id}` : `#${r.name}`;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const getHash = () => window.location.hash;

export function useRoute(): Route {
  return parseHash(useSyncExternalStore(subscribe, getHash, getHash));
}

export function navigate(r: Route, opts: { replace?: boolean } = {}): void {
  const hash = toHash(r);
  if (opts.replace) {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

export function Link({ to, children, ...rest }: { to: Route; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a href={toHash(to)} {...rest}>
      {children}
    </a>
  );
}

/** 外部サイトへのリンク（必ず別タブ・参照元を渡さない） */
export function Ext({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
