import { useEffect, useState } from 'react';
import { toDateStr, type DateStr } from '../engine/dates.ts';

/** 今日の日付。画面に戻ってきたとき・1 分ごとに確かめ、日付が変わったら更新する */
export function useToday(): DateStr {
  const [today, setToday] = useState(() => toDateStr(new Date()));
  useEffect(() => {
    const tick = () => setToday(toDateStr(new Date()));
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return today;
}

/** 現在時刻（ミリ秒）。模試のタイマー用 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
