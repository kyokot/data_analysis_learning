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

export default defineConfig({
  // GitHub Pages のサブパスでも、ファイルを直接開いても動くよう相対パスにする
  base: './',
  plugins: [katexWoff2Only(), react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
