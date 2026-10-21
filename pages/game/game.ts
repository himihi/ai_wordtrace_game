/**
 * 游戏主页面
 * 核心循环：按成语字序点击正确节点 → 填格/连线 → 四格填满过关
 */
import { Level, LevelState, Line } from '../../typings/types';
import { TOTAL_LEVELS, getLevel } from '../../data/levels';
import * as storage from '../../utils/storage';
import { calcLine } from '../../utils/geometry';
import { playBgm, playSfx, toggleMusic } from '../../utils/audio';

Page({
  data: {
    level: null as Level | null,
    levelId: 1,
    /** 当前应选第几个字（0–4） */
    step: 0,
    slots: ['', '', '', ''],
    /** 已选节点 id 序列 */
    selectedNodes: [] as string[],
    /** 已选节点快速查找表（供 WXML 使用） */
    selectedMap: {} as Record<string, boolean>,
    /** 连线渲染数据 */
    lines: [] as Line[],
    hintLeft: 3,
    hintTargetId: '',
    showResult: false,
    shakeNodeId: '',
    isLastLevel: false,
    musicOn: true
  },

  /** 游戏区实际像素尺寸（不进 data，避免频繁 setData） */
  areaW: 0,
  areaH: 0,
  /** 节点圆半径（px），连线端点缩进量；游戏区宽对应 686rpx（750 - 32×2 边距） */
  nodeRadius: 66,
  shakeTimer: null as ReturnType<typeof setTimeout> | null,
  /** 本次进入是否请求恢复未完成的对局（仅消费一次） */
  resumeRequested: false,

  onLoad(query: Record<string, string | undefined>) {
    const parsed = parseInt(query && query.id ? query.id : '1', 10);
    this.resumeRequested = query && query.resume === '1';
    this.setData({ musicOn: storage.getMusicOn() });
    this.resetLevel(Number.isNaN(parsed) ? 1 : parsed);
  },

  onShow(): void {
    playBgm();
  },

  onReady() {
    this.measureArea();
  },

  /** 通过 SelectorQuery 测量游戏区实际像素尺寸，供连线计算使用 */
  measureArea(): void {
    wx.createSelectorQuery()
      .select('.game-area')
      .boundingClientRect((rect) => {
        if (rect && rect.width > 0) {
          this.areaW = rect.width;
          this.areaH = rect.height;
          // 节点直径 144rpx → 半径 72rpx，换算为像素
          this.nodeRadius = 72 * (rect.width / 686);
        }
      })
      .exec();
  },

  /** 初始化/切换关卡：复用当前页面，不新建页面 */
  resetLevel(id: number): void {
    const level = getLevel(Math.min(Math.max(id, 1), TOTAL_LEVELS));
    if (!level) return;
    wx.setNavigationBarTitle({ title: `第 ${level.id} 关` });
    this.setData({
      level,
      levelId: level.id,
      step: 0,
      slots: ['', '', '', ''],
      selectedNodes: [],
      selectedMap: {},
      lines: [],
      hintLeft: storage.getHints(level.id),
      hintTargetId: '',
      showResult: false,
      shakeNodeId: '',
      isLastLevel: level.id >= TOTAL_LEVELS
    });

    // 未完成对局：首页「继续游戏」进入 → 静默恢复；
    // 其他入口 → 弹窗让用户选择「继续游戏 / 重新开始」
    const saved = storage.getLevelState(level.id);
    const resume = this.resumeRequested;
    this.resumeRequested = false;
    if (saved && saved.step > 0 && saved.step < 4) {
      if (resume) {
        this.restoreState(saved);
      } else {
        wx.showModal({
          title: '发现未完成的对局',
          content: `第 ${level.id} 关已选 ${saved.step} / 4，要继续上次进度吗？`,
          confirmText: '继续游戏',
          cancelText: '重新开始',
          success: (res) => {
            if (res.confirm) {
              this.restoreState(saved);
            } else {
              storage.clearLevelState(level.id);
            }
          }
        });
      }
    } else {
      storage.clearLevelState(level.id);
    }
  },

  /** 恢复对局：进度/填格/提示数即时回填，连线等游戏区测完尺寸后重建 */
  restoreState(saved: LevelState): void {
    const selectedMap: Record<string, boolean> = {};
    saved.selectedNodes.forEach((nid) => {
      selectedMap[nid] = true;
    });
    storage.setHints(saved.levelId, saved.hintLeft);
    this.setData({
      step: saved.step,
      slots: saved.slots,
      selectedNodes: saved.selectedNodes,
      selectedMap,
      hintLeft: saved.hintLeft
    });
    setTimeout(() => {
      this.measureArea();
      this.rebuildLines(saved.selectedNodes);
    }, 80);
  },

  /** 按已选节点顺序重建连线（用于恢复对局） */
  rebuildLines(selectedNodes: string[]): void {
    const level = this.data.level as Level;
    const lines: Line[] = [];
    for (let i = 1; i < selectedNodes.length; i++) {
      const from = level.nodes.find((n) => n.id === selectedNodes[i - 1]);
      const to = level.nodes.find((n) => n.id === selectedNodes[i]);
      if (from && to) {
        lines.push(
          calcLine(from, to, this.areaW || 300, this.areaH || 300, this.nodeRadius)
        );
      }
    }
    this.setData({ lines });
  },

  /** 把当前对局进度写入存档 */
  saveState(): void {
    const { levelId, step, slots, selectedNodes, hintLeft } = this.data;
    if (step <= 0 || step >= 4) return;
    storage.saveLevelState({
      levelId,
      step,
      slots: [...slots],
      selectedNodes: [...selectedNodes],
      hintLeft,
      savedAt: Date.now()
    });
  },

  onNodeTap(e: WechatMiniprogram.TouchEvent): void {
    if (this.data.showResult) return;
    const level = this.data.level as Level;
    const nodeId = e.currentTarget.dataset.id as string;
    const { step, selectedNodes } = this.data;
    const node = level.nodes.find((n) => n.id === nodeId);
    if (!node || selectedNodes.includes(nodeId)) return;

    if (node.char === level.chars[step]) {
      // ===== 点对 =====
      const slots = [...this.data.slots];
      slots[step] = node.char;
      const newSelected = [...selectedNodes, nodeId];
      const lines = [...this.data.lines];
      if (selectedNodes.length > 0) {
        const prev = level.nodes.find((n) => n.id === selectedNodes[selectedNodes.length - 1]);
        if (prev) {
          lines.push(
            calcLine(prev, node, this.areaW || 300, this.areaH || 300, this.nodeRadius)
          );
        }
      }
      const selectedMap = { ...this.data.selectedMap, [nodeId]: true };
      wx.vibrateShort({ type: 'light' });
      playSfx('correct');
      this.setData(
        { slots, selectedNodes: newSelected, selectedMap, lines, step: step + 1 },
        () => {
          this.saveState();
          if (step + 1 === 4) this.onPass();
        }
      );
    } else {
      // ===== 点错：抖动变红，不改变进度 =====
      wx.vibrateShort({ type: 'medium' });
      playSfx('wrong');
      this.setData({ shakeNodeId: nodeId });
      if (this.shakeTimer) clearTimeout(this.shakeTimer);
      this.shakeTimer = setTimeout(() => this.setData({ shakeNodeId: '' }), 400);
    }
  },

  onHint(): void {
    const level = this.data.level as Level;
    const { hintLeft, step } = this.data;
    if (this.data.showResult) return;
    if (hintLeft <= 0) {
      wx.showToast({ title: '提示已用完', icon: 'none' });
      return;
    }
    const target = level.nodes.find(
      (n) => n.isCorrect && n.char === level.chars[step]
    );
    if (!target) return;
    this.setData({ hintLeft: hintLeft - 1, hintTargetId: target.id });
    storage.setHints(level.id, hintLeft - 1);
    this.saveState();
    setTimeout(() => this.setData({ hintTargetId: '' }), 1500);
  },

  onRestart(): void {
    storage.clearLevelState(this.data.levelId);
    this.resetLevel(this.data.levelId);
  },

  onToggleMusic(): void {
    this.setData({ musicOn: toggleMusic() });
  },

  /** 手动存档：对局本就实时自动存档，此按钮供用户显式保存安心 */
  onSave(): void {
    if (this.data.showResult) return;
    const { step } = this.data;
    if (step <= 0 || step >= 4) {
      wx.showToast({ title: '还没有可保存的进度', icon: 'none' });
      return;
    }
    this.saveState();
    wx.showToast({ title: '💾 进度已保存', icon: 'none' });
  },

  onPass(): void {
    storage.markPassed(this.data.levelId, TOTAL_LEVELS);
    storage.clearLevelState(this.data.levelId);
    wx.vibrateShort({ type: 'heavy' });
    playSfx('win');
    // 稍作停顿，让第 4 个节点的弹跳动画播完再出结算
    setTimeout(() => this.setData({ showResult: true }), 450);
  },

  nextLevel(): void {
    if (this.data.isLastLevel) {
      this.goSelect();
      return;
    }
    this.resetLevel(this.data.levelId + 1);
  },

  replay(): void {
    this.resetLevel(this.data.levelId);
  },

  goSelect(): void {
    wx.navigateBack({
      fail: () => {
        wx.redirectTo({ url: '/pages/level-select/level-select' });
      }
    });
  }
});
