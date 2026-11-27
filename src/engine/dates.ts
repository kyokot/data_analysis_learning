/** 日付は端末のローカル時刻での YYYY-MM-DD 文字列で扱う（「翌日以降」の判定を単純にするため）。 */
export type DateStr = string;

export function toDateStr(d: Date): DateStr {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parse(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function addDays(s: DateStr, days: number): DateStr {
  const d = parse(s);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** b - a を日数で返す */
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export function isValidDateStr(s: unknown): s is DateStr {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime());
}

export function formatJa(s: DateStr): string {
  const d = parse(s);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
