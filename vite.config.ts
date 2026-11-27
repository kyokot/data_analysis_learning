import { readdirSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * KaTeX の CSS は 1 フォントにつき woff2 / woff / ttf の 3 形式を参照する。
 * 現行ブラウザはすべて woff2 に対応しているので、他の形式を落として配布物を小さくする。
 */
function katexWoff2Only(): Plugin {
  return {
    name: 'katex-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('katex') || !id.split('?')[0]!.endsWith('.css')) return null;
      return code.replace(/,\s*url\([^)]*\.(?:woff|ttf)\)\s*format\(["'](?:woff|truetype)["']\)/g, '');
    },
  };
}

/**
 * オフライン用のサービスワーカー（sw.js）をビルド時に作る。
 * 出力したすべてのファイルを最初に保存し、以後は保存したものを使う（ページ本体だけはネットワークを優先）。
 * キャッシュ名にファイル一覧のハッシュを入れるので、新しいビルドを公開すると古いキャッシュは消える。
 */
function serviceWorker(): Plugin {
  return {
    name: 'offline-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publicFiles = readdirSync('public').filter((f) => !f.startsWith('.'));
      const files = ['./', ...publicFiles.map((f) => `./${f}`), ...Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html').map((f) => `./${f}`)];
      let h = 0;
      for (const ch of files.sort().join('|')) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
      const version = (h >>> 0).toString(36);
      const source = `// 自動生成（vite.config.ts の serviceWorker）。編集しない。
const CACHE = 'michishirube-${version}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('michishirube-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // ページ本体: ネットワークを優先し、つながらなければ保存したものを使う
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreSearch: true })),
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // GitHub Pages のサブパスでも、ファイルを直接開いても動くよう相対パスにする
  base: './',
  plugins: [katexWoff2Only(), react(), serviceWorker()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
