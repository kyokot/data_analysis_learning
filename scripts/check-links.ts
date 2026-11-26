/**
 * 外部教材リンクの生存確認。content/resources.json と content/exam-guide.json の URL を取得し、
 * HTTP ステータスとページの <title> を一覧にする。
 *
 *   npm run check:links            すべて確認（失敗があれば終了コード 1）
 *   npm run check:links -- --json  結果を JSON で出力
 *
 * リンク切れは必ず起こるので、CI で定期的に実行して早く気づけるようにする。
 * ステータスだけでなく title も出すのは、URL が生きていても中身が入れ替わることがあるため。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentRoot } from './lib/load-content.ts';

interface Target {
  id: string;
  title: string;
  url: string;
}
interface Result extends Target {
  ok: boolean;
  status: number | string;
  pageTitle: string;
  finalUrl: string;
}

const UA = 'Mozilla/5.0 (compatible; link-check; +https://github.com/)';

function targets(): Target[] {
  const res = JSON.parse(readFileSync(join(contentRoot, 'resources.json'), 'utf8')) as {
    providers: { id: string; name: string; url: string }[];
    links: { id: string; title: string; url: string }[];
  };
  const guide = JSON.parse(readFileSync(join(contentRoot, 'exam-guide.json'), 'utf8')) as { links: { title: string; url: string }[] };
  const all: Target[] = [
    ...res.providers.map((p) => ({ id: `provider:${p.id}`, title: p.name, url: p.url })),
    ...res.links.map((l) => ({ id: l.id, title: l.title, url: l.url })),
    ...guide.links.map((l, i) => ({ id: `guide:${i + 1}`, title: l.title, url: l.url })),
  ];
  const seen = new Set<string>();
  return all.filter((t) => {
    const key = t.url.split('#')[0]!;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function check(t: Target): Promise<Result> {
  const base = { ...t, pageTitle: '', finalUrl: t.url };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(t.url.split('#')[0]!, {
        redirect: 'follow',
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8', 'accept-language': 'ja,en;q=0.8' },
        signal: AbortSignal.timeout(25_000),
      });
      let pageTitle = '';
      if ((r.headers.get('content-type') ?? '').includes('html')) {
        const html = (await r.text()).slice(0, 200_000);
        pageTitle = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
      }
      // 403 / 429 は、自動アクセスを断っているだけでページは存在することが多い。失敗ではなく要目視とする
      const ok = r.ok || r.status === 403 || r.status === 429;
      if (ok || attempt === 1) return { ...base, ok, status: r.status, pageTitle, finalUrl: r.url };
    } catch (e) {
      if (attempt === 1) return { ...base, ok: false, status: (e as Error).name || 'error' };
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  return { ...base, ok: false, status: 'error' };
}

async function main() {
  const list = targets();
  const results: Result[] = [];
  const queue = [...list];
  // 同じサイトに集中しないよう、同時接続は 4 本まで
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let t = queue.shift(); t; t = queue.shift()) results.push(await check(t));
    }),
  );
  results.sort((a, b) => a.id.localeCompare(b.id));
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(results, null, 1));
  } else {
    for (const r of results) {
      console.log(`${r.ok ? (r.status === 200 ? 'ok  ' : 'warn') : 'FAIL'} ${String(r.status).padEnd(5)} ${r.id.padEnd(24)} ${r.url}`);
      console.log(`       登録名: ${r.title}`);
      console.log(`       title : ${r.pageTitle || '（取得できず）'}${r.finalUrl !== r.url.split('#')[0] ? `  → ${r.finalUrl}` : ''}`);
    }
  }
  const failed = results.filter((r) => !r.ok);
  console.error(`\n${results.length} 件中 失敗 ${failed.length} 件 / 要目視 ${results.filter((r) => r.ok && r.status !== 200).length} 件`);
  process.exit(failed.length ? 1 : 0);
}

main();
