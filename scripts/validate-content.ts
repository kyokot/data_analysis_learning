/**
 * コンテンツ検証 CLI。
 *
 *   npm run validate:content                 すべて検証（未作成の単元はエラー）
 *   npm run validate:content -- --unit central   1 単元だけ検証
 *   npm run validate:content -- --allow-missing  未作成の単元・リンクを警告にとどめる
 */
import { loadBundle } from './lib/load-content.ts';
import { validateAll, type Issue } from '../src/content/validate.ts';

function main() {
  const args = process.argv.slice(2);
  const only: string[] = [];
  let allowMissing = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--unit' && args[i + 1]) only.push(args[++i]!);
    else if (args[i] === '--allow-missing') allowMissing = true;
  }
  const issues: Issue[] = [];
  const bundle = loadBundle(issues);
  for (const id of only) {
    if (!(id in bundle.units)) issues.push({ level: 'error', where: `units/${id}.json`, message: 'ファイルがありません' });
  }
  issues.push(...validateAll(bundle, { allowMissing, only: only.length ? only : undefined }));

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  for (const i of warnings) console.log(`warn  ${i.where}: ${i.message}`);
  for (const i of errors) console.log(`ERROR ${i.where}: ${i.message}`);
  const scope = only.length ? only.join(', ') : `${Object.keys(bundle.units).length} 単元`;
  console.log(`\n${scope}: エラー ${errors.length} 件 / 警告 ${warnings.length} 件`);
  process.exit(errors.length ? 1 : 0);
}

main();
