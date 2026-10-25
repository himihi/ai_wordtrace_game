/**
 * 音频管理：背景音乐循环 + 短音效
 * 音乐开关持久化在 wt_settings（见 utils/storage），关闭音乐时音效一并静音
 */
import { getMusicOn, setMusicOn } from './storage';

export type SfxName = 'correct' | 'wrong' | 'win';

let bgm: WechatMiniprogram.InnerAudioContext | null = null;
const sfx: Partial<Record<SfxName, WechatMiniprogram.InnerAudioContext>> = {};
let audioOptionSet = false;

/** iOS 静音开关下仍播放游戏声音（益智游戏惯例，全局设置一次） */
function ensureAudioOption(): void {
  if (audioOptionSet) return;
  audioOptionSet = true;
  wx.setInnerAudioOption({ obeyMuteSwitch: false });
}

function ensureBgm(): WechatMiniprogram.InnerAudioContext {
  ensureAudioOption();
  if (!bgm) {
    bgm = wx.createInnerAudioContext();
    bgm.src = '/assets/audio/bgm.mp3';
    bgm.loop = true;
    bgm.volume = 0.45;
  }
  return bgm;
}

/** 开始（或恢复）背景音乐；已在播放时重复调用无副作用 */
export function playBgm(): void {
  if (!getMusicOn()) return;
  ensureBgm().play();
}

export function pauseBgm(): void {
  if (bgm) bgm.pause();
}

/** 切换音乐开关，返回切换后的状态 */
export function toggleMusic(): boolean {
  const on = !getMusicOn();
  setMusicOn(on);
  if (on) playBgm();
  else pauseBgm();
  return on;
}

/** 播放短音效（正确 / 错误 / 过关） */
export function playSfx(name: SfxName): void {
  if (!getMusicOn()) return;
  ensureAudioOption();
  let ctx = sfx[name];
  if (!ctx) {
    ctx = wx.createInnerAudioContext();
    ctx.src = `/assets/audio/${name}.wav`;
    ctx.volume = name === 'win' ? 0.8 : 0.6;
    sfx[name] = ctx;
  }
  ctx.stop();
  ctx.play();
}
