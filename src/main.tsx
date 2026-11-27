import 'katex/dist/katex.min.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// オフライン対応: 公開した本番ビルドでだけサービスワーカーを登録する（使えない環境では何もしない）
if (import.meta.env.PROD && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 埋め込み表示など、登録できない環境ではオンラインのまま動く
    });
  });
}
