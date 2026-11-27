import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentBundle, Issue } from '../../src/content/validate.ts';

export const contentRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');

function readJson(path: string, issues: Issue[]): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    issues.push({ level: 'error', where: path, message: `JSON として読めません: ${(e as Error).message}` });
    return null;
  }
}

/** content/ 以下を読み込む。JSON として壊れているファイルは issues に積む。 */
export function loadBundle(issues: Issue[] = []): ContentBundle {
  const units: Record<string, unknown> = {};
  const dir = join(contentRoot, 'units');
  for (const f of existsSync(dir) ? readdirSync(dir).sort() : []) {
    if (!f.endsWith('.json')) continue;
    const data = readJson(join(dir, f), issues);
    if (data !== null) units[f.replace(/\.json$/, '')] = data;
  }
  const resourcesPath = join(contentRoot, 'resources.json');
  return {
    curriculum: readJson(join(contentRoot, 'curriculum.json'), issues),
    resources: existsSync(resourcesPath) ? readJson(resourcesPath, issues) : { providers: [], links: [] },
    units,
  };
}
