/**
 * 本地进度读写封装（wx.Storage）
 * Key：wt_progress / wt_hints / wt_settings / wt_state
 */
import { LevelState, Progress } from '../typings/types';

const KEY_PROGRESS = 'wt_progress';
const KEY_HINTS = 'wt_hints';
const KEY_SETTINGS = 'wt_settings';
const KEY_STATE = 'wt_state';

export function getProgress(): Progress {
  const p = wx.getStorageSync(KEY_PROGRESS);
  if (p && Array.isArray(p.passed) && typeof p.maxLevel === 'number') {
    return { maxLevel: p.maxLevel, passed: p.passed };
  }
  return { maxLevel: 1, passed: [] };
}

export function markPassed(levelId: number, totalLevels: number): Progress {
  const p = getProgress();
  if (!p.passed.includes(levelId)) {
    p.passed.push(levelId);
  }
  // 全部通关后 maxLevel 封顶在最后一关
  p.maxLevel = Math.max(p.maxLevel, Math.min(levelId + 1, totalLevels));
  wx.setStorageSync(KEY_PROGRESS, p);
  return p;
}

/** 清档（调试用） */
export function clearAll(): void {
  wx.removeStorageSync(KEY_PROGRESS);
  wx.removeStorageSync(KEY_HINTS);
  wx.removeStorageSync(KEY_STATE);
}

/* ========== 每关提示次数（每关 1 次，用掉不随解锁恢复） ========== */

export function getHints(levelId: number): number {
  const all = wx.getStorageSync(KEY_HINTS) || {};
  const n = all[levelId];
  return typeof n === 'number' ? n : 1;
}

export function setHints(levelId: number, n: number): void {
  const all = wx.getStorageSync(KEY_HINTS) || {};
  all[levelId] = n;
  wx.setStorageSync(KEY_HINTS, all);
}

/* ========== 音乐开关 ========== */

export function getMusicOn(): boolean {
  const s = wx.getStorageSync(KEY_SETTINGS);
  return !s || s.music !== false;
}

export function setMusicOn(on: boolean): void {
  const s = wx.getStorageSync(KEY_SETTINGS) || {};
  s.music = on;
  wx.setStorageSync(KEY_SETTINGS, s);
}

/* ========== 关卡内对局存档（继续游戏） ========== */

function allStates(): Record<string, LevelState> {
  return wx.getStorageSync(KEY_STATE) || {};
}

export function getLevelState(levelId: number): LevelState | null {
  const s = allStates()[String(levelId)];
  return s && typeof s.step === 'number' ? s : null;
}

/** 最近一次的未完成对局（step 在 1–3 之间才有恢复意义） */
export function getLatestState(): LevelState | null {
  let latest: LevelState | null = null;
  const all = allStates();
  for (const k of Object.keys(all)) {
    const s = all[k];
    if (s && s.step > 0 && s.step < 4 && (!latest || s.savedAt > latest.savedAt)) {
      latest = s;
    }
  }
  return latest;
}

export function saveLevelState(state: LevelState): void {
  const all = allStates();
  all[String(state.levelId)] = state;
  wx.setStorageSync(KEY_STATE, all);
}

export function clearLevelState(levelId: number): void {
  const all = allStates();
  if (all[String(levelId)]) {
    delete all[String(levelId)];
    wx.setStorageSync(KEY_STATE, all);
  }
}
