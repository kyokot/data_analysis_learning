import { useSyncExternalStore } from 'react';
import type { Progress } from '../engine/model.ts';
import { loadProgress, sanitizeProgress, saveProgress, STORAGE_KEY } from './storage.ts';

let state: Progress = loadProgress();
let persisted = true;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getProgress(): Progress {
  return state;
}

/** 進み具合を更新して保存する。fn は純粋関数（engine/progress.ts）を渡す。 */
export function update(fn: (p: Progress) => Progress): void {
  const next = fn(state);
  if (next === state) return;
  state = next;
  persisted = saveProgress(state);
  emit();
}

export function replaceProgress(next: Progress): void {
  state = next;
  persisted = saveProgress(state);
  emit();
}

/** 直近の保存が成功したか（false のとき、この端末には進み具合が残らない） */
export function isPersisted(): boolean {
  return persisted;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// 別のタブで進み具合が変わったら追従する
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const p = sanitizeProgress(JSON.parse(e.newValue));
      if (p) {
        state = p;
        emit();
      }
    } catch {
      // 無視
    }
  });
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress, getProgress);
}
