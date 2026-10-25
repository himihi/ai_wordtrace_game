// 逐字追踪 App 入口。全局状态全部走 utils/storage，globalData 暂不使用。
import { pauseBgm, playBgm } from './utils/audio';

App({
  onLaunch() {
    // 音频被系统打断（来电、闹钟、语音消息等）时暂停，打断结束后恢复
    wx.onAudioInterruptionBegin(() => pauseBgm());
    wx.onAudioInterruptionEnd(() => playBgm());
  },

  onShow() {
    // 每次回到小程序都尝试恢复背景音乐（未开启音乐时为空操作）
    playBgm();
  },

  onHide() {
    // 切后台立即暂停 BGM（InnerAudioContext 默认会继续播放）
    pauseBgm();
  },

  /** 启动路径不存在（如体验版二维码带错路径）时自动回首页，避免卡死在报错页 */
  onPageNotFound() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
