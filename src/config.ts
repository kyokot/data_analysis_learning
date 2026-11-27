/** サイト全体の設定 */
export const APP_NAME = '統計みちしるべ';
export const APP_TAGLINE = '統計検定4級・3級をめざす人の、非公式の独学ナビ';
/** 誤りの報告先（GitHub の Issue） */
export const REPO_URL = 'https://github.com/kyokot/data_analysis_learning';

export function reportUrl(kind: '問題' | 'リンク' | 'その他', id: string): string {
  const title = encodeURIComponent(`[${kind}の誤り] ${id}`);
  const body = encodeURIComponent(`対象: ${id}\n\n気づいた点:\n\n正しいと思う内容・根拠:\n`);
  return `${REPO_URL}/issues/new?title=${title}&body=${body}`;
}
