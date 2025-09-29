/**
 * Định nghĩa các type cơ bản cho game Bomberman
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export enum Direction {
  UP = "UP",
  DOWN = "DOWN",
  LEFT = "LEFT",
  RIGHT = "RIGHT",
  STOP = "STOP",
}

export enum ItemType {
  SPEED = "SPEED", // Giày speed - tăng tốc độ
  FLAME = "FLAME", // Liệt hỏa - tăng phạm vi nổ
  BOMB = "BOMB", // Đa bom - tăng số lượng bom tối đa
}

export enum BotAction {
  MOVE = "MOVE",
  BOMB = "BOMB",
  STOP = "STOP",
}

export interface Bot {
  id: string;
  position: Position;
  speed: number; // Tốc độ di chuyển (1/2/3)
  bombCount: number; // Số lượng bom có thể đặt đồng thời
  flameRange: number; // Phạm vi nổ của bom
  isAlive: boolean;
  score: number;
}

export interface Bomb {
  id: string;
  position: Position;
  ownerId: string;
  timeRemaining: number; // Thời gian còn lại đến khi nổ (ms)
  flameRange: number;
}

export interface Item {
  id: string;
  position: Position;
  type: ItemType;
}

export interface Wall {
  position: Position;
  isDestructible: boolean;
}

export interface GameMap {
  width: number; // 640
  height: number; // 640
  walls: Wall[];
  items: Item[];
  bombs: Bomb[];
  bots: Bot[];
}

export interface GameState {
  map: GameMap;
  currentBot: Bot;
  enemies: Bot[];
  timeRemaining: number; // Thời gian còn lại của hiệp đấu (ms)
  round: number;
}

export interface BotDecision {
  action: BotAction;
  direction?: Direction;
  target?: Position;
  priority: number; // Độ ưu tiên của quyết định (cao hơn = ưu tiên hơn)
  reason: string; // Lý do ra quyết định này
}
