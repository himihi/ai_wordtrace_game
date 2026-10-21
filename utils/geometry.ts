/**
 * 坐标与连线计算
 * 节点坐标为相对游戏区的百分比，连线渲染需要换算为像素
 */
import { LevelNode, Line } from '../typings/types';

export interface Point {
  x: number;
  y: number;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 由两个节点的百分比坐标生成一条连线线段（像素值）
 * inset：两端各缩进的像素（节点圆半径），使线段接到圆的边缘而不是圆心
 */
export function calcLine(
  from: LevelNode | Point,
  to: LevelNode | Point,
  areaWidth: number,
  areaHeight: number,
  inset = 0
): Line {
  const cx1 = (from.x / 100) * areaWidth;
  const cy1 = (from.y / 100) * areaHeight;
  const cx2 = (to.x / 100) * areaWidth;
  const cy2 = (to.y / 100) * areaHeight;
  const dx = cx2 - cx1;
  const dy = cy2 - cy1;
  const distValue = Math.hypot(dx, dy);
  if (distValue <= 0 || distValue <= inset * 2) {
    return { left: cx1, top: cy1, length: 0, angle: 0 };
  }
  const ux = dx / distValue;
  const uy = dy / distValue;
  const x1 = cx1 + ux * inset;
  const y1 = cy1 + uy * inset;
  const x2 = cx2 - ux * inset;
  const y2 = cy2 - uy * inset;
  return {
    left: x1,
    top: y1,
    length: Math.hypot(x2 - x1, y2 - y1),
    angle: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  };
}
