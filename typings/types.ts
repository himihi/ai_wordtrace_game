/** 共享类型定义 */

/** 游戏区中的一个视觉节点（只显示 Emoji，不显示汉字） */
export interface LevelNode {
  id: string;
  /** 视觉资源。MVP 用 Emoji，后续可替换为图标字体/图片路径 */
  emoji: string;
  /** Emoji 是否占多个字形（如 💨🐑），节点内用较小字号渲染 */
  wide: boolean;
  /** 对应汉字，仅用于判定与填格，不渲染在节点上 */
  char: string;
  /** 是否属于目标成语 */
  isCorrect: boolean;
  /** 百分比坐标 0–100，相对游戏区容器 */
  x: number;
  y: number;
}

export interface Level {
  id: number;
  idiom: string;
  chars: [string, string, string, string];
  explanation: string;
  /** 前 4 个为正确节点（顺序与 chars 一致），其后为干扰项 */
  nodes: LevelNode[];
  hints: number;
}

/** 连线渲染数据（像素值） */
export interface Line {
  left: number;
  top: number;
  length: number;
  angle: number;
}

/** 本地进度 */
export interface Progress {
  /** 已解锁到的最大关卡号 */
  maxLevel: number;
  /** 已通关关卡 id 列表 */
  passed: number[];
}

/** 关卡内未完成的对局存档（用于「继续游戏」） */
export interface LevelState {
  levelId: number;
  /** 当前应选第几个字（1–3 才有恢复意义） */
  step: number;
  /** 四格已填内容 */
  slots: string[];
  /** 已选节点 id 序列（顺序即连线顺序） */
  selectedNodes: string[];
  hintLeft: number;
  /** 保存时间戳，用于取最近一次 */
  savedAt: number;
}
