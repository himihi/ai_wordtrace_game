/**
 * 关卡选择页：L1/L2/L3 三段分组网格
 * 状态：passed 已通关 / current 可挑战 / locked 未解锁
 */
import levels, { TOTAL_LEVELS } from '../../data/levels';
import { getProgress } from '../../utils/storage';
import { playBgm } from '../../utils/audio';

type CellState = 'locked' | 'current' | 'passed';

interface LevelCell {
  id: number;
  state: CellState;
}

interface Section {
  key: string;
  title: string;
  tag: string;
  cells: LevelCell[];
}

const SECTION_DEFS = [
  { key: 'L1', title: '初出茅庐', tag: '认识规则', range: [1, 10] },
  { key: 'L2', title: '渐入佳境', tag: '混入干扰', range: [11, 20] },
  { key: 'L3', title: '炉火纯青', tag: '真假难辨', range: [21, 30] }
];

Page({
  data: {
    sections: [] as Section[],
    passedCount: 0,
    total: TOTAL_LEVELS
  },

  onShow(): void {
    this.refresh();
    playBgm();
  },

  refresh(): void {
    const p = getProgress();
    const sections: Section[] = SECTION_DEFS.map((s) => ({
      key: s.key,
      title: s.title,
      tag: s.tag,
      cells: levels
        .filter((l) => l.id >= s.range[0] && l.id <= s.range[1])
        .map((l) => {
          let state: CellState;
          if (p.passed.includes(l.id)) {
            state = 'passed';
          } else if (l.id <= p.maxLevel) {
            state = 'current';
          } else {
            state = 'locked';
          }
          return { id: l.id, state };
        })
    }));
    this.setData({ sections, passedCount: p.passed.length });
  },

  onTapLevel(e: WechatMiniprogram.TouchEvent): void {
    const id = e.currentTarget.dataset.id as number;
    const state = e.currentTarget.dataset.state as CellState;
    if (state === 'locked') {
      wx.vibrateShort({ type: 'heavy' });
      wx.showToast({ title: '先通关前面的关卡吧', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/game/game?id=${id}` });
  }
});
