/**
 * 首页：品牌区 + 继续游戏/开始游戏 + 关卡选择 + 音乐开关
 * 存在未完成对局时，主按钮变为「继续游戏」并恢复该关进度
 */
import { getLatestState, getMusicOn, getProgress } from '../../utils/storage';
import { TOTAL_LEVELS } from '../../data/levels';
import { playBgm, toggleMusic } from '../../utils/audio';

Page({
  data: {
    maxLevel: 1,
    passedCount: 0,
    total: TOTAL_LEVELS,
    musicOn: true,
    /** 未完成对局（继续游戏入口），无则为 null */
    savedLevel: 0,
    savedStep: 0
  },

  onShow(): void {
    const p = getProgress();
    const saved = getLatestState();
    this.setData({
      maxLevel: p.maxLevel,
      passedCount: p.passed.length,
      savedLevel: saved ? saved.levelId : 0,
      savedStep: saved ? saved.step : 0
    });
    playBgm();
  },

  onLoad(): void {
    this.setData({ musicOn: getMusicOn() });
  },

  startGame(): void {
    const { savedLevel, maxLevel } = this.data;
    if (savedLevel > 0) {
      wx.navigateTo({ url: `/pages/game/game?id=${savedLevel}&resume=1` });
    } else {
      wx.navigateTo({ url: `/pages/game/game?id=${maxLevel}` });
    }
  },

  openSelect(): void {
    wx.navigateTo({ url: '/pages/level-select/level-select' });
  },

  onToggleMusic(): void {
    this.setData({ musicOn: toggleMusic() });
  }
});
