// 逐字追踪 App 入口。全局状态全部走 utils/storage，globalData 暂不使用。
import { playBgm } from './utils/audio';

App({
  onShow() {
    // 每次回到小程序都尝试恢复背景音乐（未开启音乐时为空操作）
    playBgm();
  }
});
