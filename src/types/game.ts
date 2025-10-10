/**
 * Định nghĩa các type cơ bản cho game Bomberman theo protocol hackathon
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
  SPEED = "S", // Item tăng tốc độ di chuyển
  EXPLOSION_RANGE = "R", // Item tăng phạm vi nổ của bom
  BOMB_COUNT = "B", // Item thêm số lượng bom
}

export enum MapCellType {
  WALL = "W", // Các bức tường
  CHEST = "C", // Các hòm đồ, có thể bị phá bởi bom
  BOMB_ITEM = "B", // Item thêm số lượng bom
  RANGE_ITEM = "R", // Item tăng thêm phạm vi nổ của bom
  SPEED_ITEM = "S", // Item tăng tốc độ di chuyển
}

// Map cell có thể là MapCellType hoặc null (empty)
export type MapCell = MapCellType | null;

export enum BotAction {
  MOVE = "MOVE",
  BOMB = "BOMB",
  STOP = "STOP",
}

// Bomber data structure from server
export interface Bomber {
  x: number;
  y: number;
  speed: number;
  type: number;
  uid: string;
  orient: Direction;
  isAlive: boolean;
  size: number;
  name: string;
  movable: boolean;
  score: number;
  color: number;
  explosionRange: number;
  bombCount: number;
  speedCount: number;
}

// Bomb data structure from server
export interface ServerBomb {
  x: number;
  y: number;
  uid: string; // UID của BOT đã đặt bom
  lifeTime?: number; // Thời gian bom nổ
  createdAt?: number; // Thời gian đặt bom
  isExploded?: boolean; // Trạng thái bom đã nổ/chưa
  bomberPassedThrough?: boolean; // Trạng thái bomber đã rời khỏi bom/chưa
  id: number; // ID của bom
  orient?: Direction;
  speed?: number;
  type?: number;
  size?: number;
}

// Item data structure from server
export interface ServerItem {
  x: number;
  y: number;
  type: ItemType; // SPEED (S), EXPLOSION_RANGE (R), BOMB_COUNT (B)
  size?: number;
  isCollected?: boolean;
}

// Chest data structure from server
export interface ServerChest {
  x: number;
  y: number;
  size?: number;
  type?: string;
  isDestroyed?: boolean;
}

// Server response for user event
export interface UserResponse {
  map: (string | null)[][];
  bombers: Bomber[];
  bombs: any[]; // Should be typed as Bomb[], but need to confirm server response
  items: any[]; // Should be typed as Item[], but need to confirm server response
  chests: any[]; // Should be typed as Wall[], but need to confirm server response
  timeRemaining?: number;
  round?: number;
}

/**
 * Thông tin về một bomber (bot hoặc người chơi)
 */

export interface Bot {
  id: string;
  position: Position;
  speed: number;
  bombCount: number;
  flameRange: number;
  isAlive: boolean;
  score: number;
  name?: string;
}

export interface Bomb {
  id: string;
  position: Position;
  ownerId: string;
  timeRemaining: number;
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
  width: number;
  height: number;
  walls: Wall[]; // solid walls
  chests: Wall[]; // destructible chests
  items: Item[];
  bombs: Bomb[];
  bots: Bot[];
}

export interface GameState {
  map: GameMap;
  currentBot: Bot;
  enemies: Bot[];
  timeRemaining: number;
  round: number;
}

export interface BotDecision {
  action: BotAction;
  direction?: Direction;
  target?: Position;
  priority: number;
  reason: string;
}
