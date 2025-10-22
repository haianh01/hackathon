import { Position } from "../types";
import {
  botTopLeftToCenter,
  cellToPixelCenter,
  COORDINATE_CONFIG,
  pixelToCellIndex,
} from "./coordinates";

/**
 * Validate that bot position makes sense
 */
export function validateBotPosition(
  botTopLeft: Position,
  mapWidth: number,
  mapHeight: number
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check bounds
  if (botTopLeft.x < 0 || botTopLeft.y < 0) {
    issues.push("Bot position is negative");
  }

  const botRight = botTopLeft.x + COORDINATE_CONFIG.PLAYER_SIZE;
  const botBottom = botTopLeft.y + COORDINATE_CONFIG.PLAYER_SIZE;

  if (botRight > mapWidth || botBottom > mapHeight) {
    issues.push("Bot extends beyond map boundaries");
  }

  // Check alignment
  const botCenter = botTopLeftToCenter(botTopLeft);
  const cellIndex = pixelToCellIndex(botTopLeft);
  const cellCenter = cellToPixelCenter(cellIndex);

  const offsetX = Math.abs(botCenter.x - cellCenter.x);
  const offsetY = Math.abs(botCenter.y - cellCenter.y);

  if (offsetX > 10 || offsetY > 10) {
    issues.push(
      `Bot is misaligned from cell center by (${offsetX.toFixed(
        1
      )}, ${offsetY.toFixed(1)})px`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
