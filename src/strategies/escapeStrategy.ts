import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Direction,
  Position,
} from "../types";
import {
  getSafeAdjacentPositions,
  isPositionInDangerZone,
} from "../utils/gameLogic";
import { findEscapePath, Pathfinding } from "../utils/pathfinding";
import {
  getPositionInDirection,
  getDirectionToTarget,
  EDGE_SAFETY_MARGIN,
} from "../utils";
import {
  // Use UNIFIED collision system from constants
  canMoveTo,
} from "../utils/constants";
/**
 * Escape strategy for when the bot is in a danger zone.
 */
export class EscapeStrategy extends BaseStrategy {
  name = "Escape";
  priority = 100; // Highest priority

  // Add tracking for emergency escape state
  private lastEmergencyPosition: Position | null = null;
  private emergencyAttempts: number = 0;
  private readonly MAX_EMERGENCY_ATTEMPTS = 3;

  evaluate(gameState: GameState): BotDecision | null {
    const { currentBot } = gameState;
    const currentPos = currentBot.position;

    if (!isPositionInDangerZone(currentPos, gameState)) {
      return null;
    }

    // Find the best safe position to move to.
    const bestSafeResult = this.findBestSafePosition(gameState);

    if (bestSafeResult) {
      const direction = getDirectionToTarget(
        currentPos,
        bestSafeResult.position
      );

      // If we have a full path (from distant pathfinding), use it
      if (bestSafeResult.path && bestSafeResult.target) {
        return this.createDecision(
          BotAction.MOVE,
          this.priority,
          `Escape - following path to safe zone (${bestSafeResult.target.x}, ${bestSafeResult.target.y})`,
          direction,
          bestSafeResult.target,
          bestSafeResult.path
        );
      }

      // Otherwise, just move to adjacent safe position
      return this.createDecision(
        BotAction.MOVE,
        this.priority,
        `Escape - moving to adjacent safe position (${bestSafeResult.position.x}, ${bestSafeResult.position.y})`,
        direction,
        bestSafeResult.position
      );
    }

    // Emergency: No immediate safe positions, try to move away from danger.
    const emergencyDecision = this.handleEmergency(gameState);
    if (emergencyDecision) {
      return emergencyDecision;
    }

    // If completely stuck, stop and log the situation.
    return this.createDecision(
      BotAction.STOP,
      this.priority,
      "Escape - Completely stuck, accepting risk!",
      Direction.STOP
    );
  }

  /**
   * Finds the best safe position using pathfinding for long-distance escape.
   * First tries adjacent positions, then uses A* pathfinding for distant safe zones.
   * @param gameState The current game state.
   * @returns Object with position and optional path, or null if none found.
   */
  private findBestSafePosition(gameState: GameState): {
    position: Position;
    path?: Position[];
    target?: Position;
  } | null {
    console.log(`🔍 EscapeStrategy: Finding best safe position...`);
    const currentPos = gameState.currentBot.position;

    // First, try adjacent safe positions (faster)
    const safePositions = getSafeAdjacentPositions(currentPos, gameState);

    if (safePositions.length > 0) {
      console.log(`✅ Found ${safePositions.length} adjacent safe positions`);

      if (safePositions.length === 1) {
        return safePositions[0] ? { position: safePositions[0] } : null;
      }

      // Score each safe position and return the best one.
      const scoredPositions = safePositions.map((pos) => ({
        position: pos,
        score: this.scorePosition(pos, gameState),
      }));

      scoredPositions.sort((a, b) => b.score - a.score);
      return scoredPositions[0]?.position
        ? { position: scoredPositions[0].position }
        : null;
    }

    // No adjacent safe positions, use pathfinding for long-distance escape
    console.log(
      `⚠️ No adjacent safe positions, searching distant safe zones...`
    );
    const distantResult = this.findDistantSafePosition(gameState);
    if (distantResult) {
      return {
        position: distantResult.nextStep,
        path: distantResult.fullPath,
        target: distantResult.target,
      };
    }
    return null;
  }

  /**
   * Uses A* pathfinding to find path to distant safe positions.
   * @param gameState The current game state.
   * @param allowOwnBombPosition Optional position of bot's own bomb to allow passing through
   * @returns Object with next step and full path, or null if none found.
   */
  private findDistantSafePosition(
    gameState: GameState,
    allowOwnBombPosition?: Position
  ): {
    nextStep: Position;
    fullPath: Position[];
    target: Position;
  } | null {
    const currentPos = gameState.currentBot.position;
    const CELL_SIZE = 40;

    // FIXED: Calculate search radius based on flame range to ensure enough safe area
    const flameRange = gameState.currentBot.flameRange || 2;
    const dangerRadius = (flameRange + 1) * CELL_SIZE; // Danger zone size
    const SEARCH_RADIUS = Math.max(280, dangerRadius + 120); // At least 7 cells or danger + 3 cells buffer

    console.log(
      `🔍 Searching for distant safe zones within ${SEARCH_RADIUS}px radius (flameRange: ${flameRange})...`
    );

    // Find all safe positions within search radius
    const safeCandidates: Position[] = [];
    let totalChecked = 0;
    let rejectedByDanger = 0;
    let rejectedByMove = 0;

    // FIXED: Start from grid-aligned position and iterate by CELL_SIZE
    const startX = Math.max(
      EDGE_SAFETY_MARGIN,
      Math.floor((currentPos.x - SEARCH_RADIUS) / CELL_SIZE) * CELL_SIZE
    );
    const endX = Math.min(
      gameState.map.width - EDGE_SAFETY_MARGIN,
      Math.ceil((currentPos.x + SEARCH_RADIUS) / CELL_SIZE) * CELL_SIZE
    );
    const startY = Math.max(
      EDGE_SAFETY_MARGIN,
      Math.floor((currentPos.y - SEARCH_RADIUS) / CELL_SIZE) * CELL_SIZE
    );
    const endY = Math.min(
      gameState.map.height - EDGE_SAFETY_MARGIN,
      Math.ceil((currentPos.y + SEARCH_RADIUS) / CELL_SIZE) * CELL_SIZE
    );

    for (let x = startX; x <= endX; x += CELL_SIZE) {
      for (let y = startY; y <= endY; y += CELL_SIZE) {
        const candidate = { x, y };
        totalChecked++;

        // Check if position is safe and reachable
        const inDanger = isPositionInDangerZone(candidate, gameState);

        const canMove = canMoveTo(candidate, gameState);

        if (inDanger) {
          rejectedByDanger++;
        }
        if (!canMove) {
          rejectedByMove++;
        }

        if (!inDanger && canMove) {
          safeCandidates.push(candidate);
        }
      }
    }

    console.log(`📊 Search statistics:`);
    console.log(`   Total cells checked: ${totalChecked}`);
    console.log(`   Rejected by danger zone: ${rejectedByDanger}`);
    console.log(`   Rejected by canMoveTo: ${rejectedByMove}`);
    console.log(`   ✅ Valid safe candidates: ${safeCandidates.length}`);

    if (safeCandidates.length === 0) {
      console.log(`❌ No safe candidates found in search area!`);
      console.log(
        `   Search bounds: (${startX},${startY}) to (${endX},${endY})`
      );
      console.log(
        `   Map size: ${gameState.map.width}x${gameState.map.height}`
      );
      return null;
    }

    // Find the closest safe position using pathfinding
    let bestPath: Position[] | null = null;
    let bestTarget: Position | null = null;

    for (const candidate of safeCandidates) {
      try {
        // Pass allowOwnBomb option if provided
        const pathfindingOptions = allowOwnBombPosition
          ? { allowOwnBomb: allowOwnBombPosition }
          : undefined;

        const path = Pathfinding.findPath(
          currentPos,
          candidate,
          gameState,
          pathfindingOptions
        );

        if (path && path.length > 1) {
          // Prefer shorter paths to safe zones
          if (!bestPath || path.length < bestPath.length) {
            bestPath = path;
            bestTarget = candidate;
          }
        }
      } catch (error) {
        // Skip if pathfinding fails for this candidate
        continue;
      }
    }

    if (bestPath && bestPath.length > 1 && bestTarget) {
      const nextStep = bestPath[1]; // First step in path (index 0 is current position)
      if (nextStep) {
        // Validate that nextStep and target are within safe bounds
        const isNextStepValid =
          nextStep.x >= EDGE_SAFETY_MARGIN &&
          nextStep.x < gameState.map.width - EDGE_SAFETY_MARGIN &&
          nextStep.y >= EDGE_SAFETY_MARGIN &&
          nextStep.y < gameState.map.height - EDGE_SAFETY_MARGIN;

        const isTargetValid =
          bestTarget.x >= EDGE_SAFETY_MARGIN &&
          bestTarget.x < gameState.map.width - EDGE_SAFETY_MARGIN &&
          bestTarget.y >= EDGE_SAFETY_MARGIN &&
          bestTarget.y < gameState.map.height - EDGE_SAFETY_MARGIN;

        if (!isNextStepValid || !isTargetValid) {
          console.log(
            `❌ Path validation failed: nextStep=(${nextStep.x}, ${nextStep.y}) valid=${isNextStepValid}, target=(${bestTarget.x}, ${bestTarget.y}) valid=${isTargetValid}`
          );
          console.log(
            `   Map bounds: width=${gameState.map.width}, height=${gameState.map.height}, margin=${EDGE_SAFETY_MARGIN}`
          );
          return null;
        }

        console.log(
          `🛤️ Found path to safe zone (${bestTarget.x}, ${bestTarget.y}), next step: (${nextStep.x}, ${nextStep.y}), path length: ${bestPath.length}`
        );
        return {
          nextStep,
          fullPath: bestPath,
          target: bestTarget,
        };
      }
    }

    console.log(`❌ No pathfinding route to safe zones found`);
    return null;
  }

  /**
   * Scores a position based on its long-term safety.
   * @param position The position to score.
   * @param gameState The current game state.
   * @returns A numerical score.
   */
  private scorePosition(position: Position, gameState: GameState): number {
    // Higher score is better.
    let score = 0;

    // Criterion 1: Safety Depth (number of subsequent escape routes)
    const subsequentSafePositions = getSafeAdjacentPositions(
      position,
      gameState
    );
    score += subsequentSafePositions.length * 10;

    // Criterion 2: Distance from danger
    // Find the closest bomb to the bot's current position
    const closestBomb =
      gameState.map.bombs.length > 0
        ? gameState.map.bombs.reduce((closest, bomb) => {
            const dist = Pathfinding.heuristic(
              gameState.currentBot.position,
              bomb.position
            );
            const closestDist = closest
              ? Pathfinding.heuristic(
                  gameState.currentBot.position,
                  closest.position
                )
              : Infinity;
            return dist < closestDist ? bomb : closest;
          }, null as (typeof gameState.map.bombs)[0] | null)
        : null;

    if (closestBomb) {
      const distanceFromBomb = Pathfinding.heuristic(
        position,
        closestBomb.position
      );
      score += distanceFromBomb; // Further is better
    }

    return score;
  }

  /**
   * Handles the emergency case where no adjacent safe positions are available.
   * Enhanced to handle enemy player collisions and prevent infinite loops.
   * @param gameState The current game state.
   * @returns A move decision, or null if no move is possible.
   */

  // Giả định các hằng số và kiểu dữ liệu
  // const MAX_EMERGENCY_ATTEMPTS = 5;
  // enum BotAction { MOVE, STOP }
  // enum Direction { UP, DOWN, LEFT, RIGHT }
  // type BotDecision = { /* ... */ };
  // type EscapePathResult = { nextStep: Position; target: Position; fullSteps: number; };

  public handleEmergency(gameState: GameState): BotDecision | null {
    console.log(`🚨 === EMERGENCY ESCAPE EVALUATION ===`);
    const { currentBot } = gameState;
    const currentPos = currentBot.position;

    this.lastEmergencyPosition = this.lastEmergencyPosition || { x: -1, y: -1 };

    // 1. PHÂN TÍCH VÙNG NGUY HIỂM VÀ LỘC BOM

    // Tìm quả bom gần nhất và nguy hiểm nhất (hoặc bom bot vừa đặt)
    let ownBombPosition: Position | undefined = undefined;

    // Tìm mối đe dọa lớn nhất (ví dụ: bom sắp nổ nhất hoặc gần nhất)
    console.log(
      "🔍 Analyzing danger zones and bombs... ",
      JSON.stringify(gameState.map.bombs)
    );
    const dangerousBombs = gameState.map.bombs
      .filter((b) => isPositionInDangerZone(currentPos, gameState)) // Giả định hàm này kiểm tra nguy hiểm từ 1 bomb
      .sort((a, b) => a.timeRemaining - b.timeRemaining); // Ưu tiên bom sắp nổ

    const dangerousBomb = dangerousBombs[0];
    if (!dangerousBomb) {
      // Nếu bot không ở trong vùng nguy hiểm ngay lập tức, đây không phải là trường hợp khẩn cấp
      console.log(`✅ Position is safe, returning control.`);
      this.resetEmergencyState();
      return null;
    }

    // Kiểm tra xem đó có phải bom của bot không (dùng lại logic kiểm tra 20px)
    const distance = Math.hypot(
      currentPos.x - dangerousBomb.position.x,
      currentPos.y - dangerousBomb.position.y
    );
    if (distance < 20) {
      ownBombPosition = dangerousBomb.position;
      console.log(
        `💣 Detected immediate danger from own bomb at (${dangerousBomb.position.x}, ${dangerousBomb.position.y})`
      );
    } else {
      console.log(
        `💣 Detected immediate danger from bomb at (${dangerousBomb.position.x}, ${dangerousBomb.position.y})`
      );
    }

    // 2. PHÁT HIỆN VÒNG LẶP KHẨN CẤP
    if (
      this.lastEmergencyPosition.x === currentPos.x &&
      this.lastEmergencyPosition.y === currentPos.y
    ) {
      this.emergencyAttempts++;
      // ... (Logic kiểm tra giới hạn MAX_EMERGENCY_ATTEMPTS giữ nguyên)
      if (this.emergencyAttempts >= this.MAX_EMERGENCY_ATTEMPTS) {
        this.resetEmergencyState();
        return null;
      }
    } else {
      this.emergencyAttempts = 0;
      this.lastEmergencyPosition = { x: currentPos.x, y: currentPos.y };
    }

    // 3. CHIẾN LƯỢC THOÁT HIỂM TỐI ƯU (BFS Pathfinding)

    let escapeResult = null;

    // *** Sửa đổi chính ở đây: Gọi BFS với thông tin bom và gameState ***
    // Giả định hàm findEscapePath mới được sửa đổi để nhận Bomb làm tham số
    // Note: Cần đảm bảo hàm findEscapePath hỗ trợ tùy chọn 'allowOwnBomb'
    escapeResult = findEscapePath(currentPos, dangerousBomb, gameState);
    console.log(
      "%c🤪 ~ file: c:UserslehaihackathonsrcstrategiesescapeStrategy.ts:433 [] -> escapeResult : ",
      "color: #6dba40",
      escapeResult
    );

    if (escapeResult) {
      // ... (Logic lấy DirectionToTarget giữ nguyên)
      const { nextStep, target, direction, path } = escapeResult;
      console.log(`🏃 EMERGENCY ESCAPE:`);
      console.log(
        `  Bot at: (${currentBot.position.x}, ${currentBot.position.y})`
      );
      console.log(
        `  Next step: (${escapeResult.nextStep.x}, ${escapeResult.nextStep.y})`
      );
      console.log(`  Direction: ${escapeResult.direction}`);
      console.log(
        `  Target: (${escapeResult.target.x}, ${escapeResult.target.y})`
      );
      console.log(`  Path length: ${escapeResult.path.length}`);
      console.log(
        `🛤️ EMERGENCY PATHFOUND: Found path to safe zone at cell )`,
        JSON.stringify(escapeResult)
      );
      console.log(
        `   Next step (Pixel): (${nextStep.x}, ${nextStep.y}), direction: ${direction}, path length: ${path.length}`
      );

      return this.createDecision(
        BotAction.MOVE,
        this.priority,
        `Escape (BFS) - pathfinding to nearest safe zone`,
        direction, // Hướng đi cho bước đầu tiên
        target, // Đích cuối cùng của toàn bộ đường đi
        path, // Truyền toàn bộ lộ trình cho bot thực thi
        escapeResult // ✅ Thêm escapeResult
      );
    }

    // 4. KIỂM TRA TẮC NGHẼN BỞI NGƯỜI CHƠI (Giữ nguyên)

    const allDirectionsBlockedByPlayers =
      this.areAllDirectionsBlockedByPlayers(gameState);
    if (allDirectionsBlockedByPlayers) {
      // ... (Logic handleCompletePlayerBlockage giữ nguyên)
      return this.handleCompletePlayerBlockage(gameState);
    }

    // 5. CÁC CHIẾN LƯỢC DỰ PHÒNG (Nếu BFS thất bại)

    // Loại bỏ phần kiểm tra 4 hướng chéo và logic 'RELAXED' phức tạp
    // vì BFS đã là cơ chế tìm kiếm toàn diện nhất (bao gồm cả các bước đi dài)

    // Nếu BFS thất bại, có nghĩa là:
    // a) Bot không thể thoát khỏi vùng lửa trước khi bom nổ.
    // b) Bot bị chặn hoàn toàn (bao gồm cả các con đường dài).

    console.log(
      `❌ NO ESCAPE PATH FOUND (BFS failed or too slow). Trying last resort fallback...`
    );

    // DỰ PHÒNG CUỐI: Di chuyển đến ô ÍT NGUY HIỂM NHẤT (Nếu bị kẹt trên bom)
    // const leastDangerousMove = this.findLeastDangerousNeighbor(
    //   gameState,
    //   currentPos
    // );
    // if (leastDangerousMove) {
    //   console.log(
    //     `⚠️ LAST RESORT: Moving to least dangerous neighbor: ${leastDangerousMove.direction}`
    //   );
    //   return this.createDecision(
    //     BotAction.MOVE,
    //     this.priority,
    //     "Escape (Last Resort) - least dangerous move",
    //     leastDangerousMove.direction,
    //     leastDangerousMove.newPos
    //   );
    // }

    console.log(`🛑 FATAL: Exhausted all escape options!`);
    this.resetEmergencyState();
    return null;
  }

  /**
   * Calculates emergency score for a position based on danger and distance from bombs.
   * @param position The position to score.
   * @param gameState The current game state.
   * @returns A numerical score (higher is better).
   */
  private calculateEmergencyScore(
    position: Position,
    gameState: GameState
  ): number {
    let score = 0;

    // Priority 1: Completely safe zones get highest score
    if (!isPositionInDangerZone(position, gameState)) {
      score = 1000; // Very high score for safe zones
      console.log(`✅ SAFE zone detected (base score: ${score})`);
    } else {
      score = 100; // Base score for positions still in danger
      console.log(`⚠️ Still in danger zone (base score: ${score})`);
    }

    // Priority 2: Distance from nearest bomb center (encourage moving away from bombs)
    const nearestBomb = this.findNearestBomb(position, gameState);
    if (nearestBomb) {
      const distanceFromBomb = Pathfinding.heuristic(
        position,
        nearestBomb.position
      );
      const distanceScore = Math.floor(distanceFromBomb / 10); // 1 point per 10 pixels
      score += distanceScore;

      console.log(
        `💣 Distance from nearest bomb: ${distanceFromBomb}px (+${distanceScore} score)`
      );
    }

    // Priority 3: Bonus for positions that lead toward map center (safer positions)
    const edgeBonus = this.calculateEdgeBonus(position, gameState);
    score += edgeBonus;
    if (edgeBonus > 0) {
      console.log(`🏃 Center bonus: +${edgeBonus} score (safer position)`);
    } else if (edgeBonus < 0) {
      console.log(`⚠️ Edge penalty: ${edgeBonus} score (too close to edge)`);
    }

    return score;
  }

  /**
   * Finds the nearest bomb to a given position.
   * @param position The position to check from.
   * @param gameState The current game state.
   * @returns The nearest bomb or null if no bombs exist.
   */
  private findNearestBomb(
    position: Position,
    gameState: GameState
  ): any | null {
    if (gameState.map.bombs.length === 0) {
      return null;
    }

    return gameState.map.bombs.reduce((nearest, bomb) => {
      const currentDistance = Pathfinding.heuristic(position, bomb.position);
      const nearestDistance = nearest
        ? Pathfinding.heuristic(position, nearest.position)
        : Infinity;

      return currentDistance < nearestDistance ? bomb : nearest;
    }, null as any);
  }

  /**
   * Calculates bonus score for positions near map edges (more escape routes).
   * @param position The position to evaluate.
   * @param gameState The current game state.
   * @returns Bonus score.
   */
  private calculateEdgeBonus(position: Position, gameState: GameState): number {
    const { width, height } = gameState.map;
    const SAFE_DISTANCE_FROM_EDGE = 80; // Minimum safe distance from edges

    const distanceToNearestEdge = Math.min(
      position.x, // Distance to left edge
      width - position.x, // Distance to right edge
      position.y, // Distance to top edge
      height - position.y // Distance to bottom edge
    );

    // FIXED: Give bonus for staying AWAY from edges (safer positions)
    // The further from edge, the higher the bonus
    if (distanceToNearestEdge >= SAFE_DISTANCE_FROM_EDGE) {
      return Math.floor(distanceToNearestEdge / 20); // Bonus for center positions
    }

    // Penalty for being too close to edges
    return -Math.floor((SAFE_DISTANCE_FROM_EDGE - distanceToNearestEdge) / 10);
  }

  /**
   * Checks if all directions are blocked by enemy players.
   * @param gameState The current game state.
   * @returns True if all 4 directions are blocked by players.
   */
  private areAllDirectionsBlockedByPlayers(gameState: GameState): boolean {
    const currentPos = gameState.currentBot.position;
    const EMERGENCY_STEP = 3;
    const directions = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];

    let blockedByPlayerCount = 0;

    for (const direction of directions) {
      const newPos = getPositionInDirection(
        currentPos,
        direction,
        EMERGENCY_STEP
      );

      // Enhanced bounds check with unified safety margin
      if (
        newPos.x < EDGE_SAFETY_MARGIN ||
        newPos.x >= gameState.map.width - EDGE_SAFETY_MARGIN ||
        newPos.y < EDGE_SAFETY_MARGIN ||
        newPos.y >= gameState.map.height - EDGE_SAFETY_MARGIN
      ) {
        continue; // Too close to bounds, not blocked by player
      }

      // Check if blocked specifically by enemy player
      if (this.isPositionBlockedByPlayer(newPos, gameState)) {
        blockedByPlayerCount++;
      }
    }

    return blockedByPlayerCount >= 4;
  }

  /**
   * Checks if a position is blocked specifically by an enemy player.
   * @param position The position to check.
   * @param gameState The current game state.
   * @returns True if blocked by enemy player.
   */
  private isPositionBlockedByPlayer(
    position: Position,
    gameState: GameState
  ): boolean {
    // Check enemy players
    for (const enemy of gameState.enemies) {
      if (enemy.isAlive) {
        const distance = Pathfinding.heuristic(position, enemy.position);
        const PLAYER_COLLISION_THRESHOLD = 25; // pixels

        if (distance < PLAYER_COLLISION_THRESHOLD) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Handles the case where all directions are blocked by enemy players.
   * Implements alternative strategies to break out of player blockage.
   * @param gameState The current game state.
   * @returns A move decision or null if stuck.
   */
  private handleCompletePlayerBlockage(
    gameState: GameState
  ): BotDecision | null {
    console.log(`🤝 === PLAYER BLOCKAGE RESOLUTION ===`);

    // Strategy 1: Wait and see if players move (return null to pause)
    console.log(`🛑 Strategy 1: Waiting for players to move...`);

    // Strategy 2: Try to find a gap by checking smaller movements
    const microMovement = this.findMicroMovementGap(gameState);
    if (microMovement) {
      console.log(`🕳️ Strategy 2: Found micro-movement gap!`);
      return microMovement;
    }

    // Strategy 3: Try distant pathfinding to bypass player blockage
    const distantEscape = this.findDistantSafePosition(gameState);
    if (distantEscape) {
      const direction = getDirectionToTarget(
        gameState.currentBot.position,
        distantEscape.nextStep
      );
      console.log(`🛤️ Strategy 3: Using distant pathfinding to bypass players`);
      return this.createDecision(
        BotAction.MOVE,
        this.priority,
        "Emergency escape via distant pathfinding",
        direction,
        distantEscape.target,
        distantEscape.fullPath
      );
    }

    // Strategy 4: Last resort - accept risk and stay put
    console.log(
      `⚠️ Strategy 4: No alternatives found, staying put (accepting risk)`
    );
    console.log(`🤝 === PLAYER BLOCKAGE RESOLUTION END ===`);

    return this.createDecision(
      BotAction.STOP,
      this.priority,
      "Emergency - blocked by players, accepting risk",
      Direction.STOP
    );
  }

  /**
   * Tries to find very small movements that might slip through player gaps.
   * @param gameState The current game state.
   * @returns A move decision if a micro-gap is found.
   */
  private findMicroMovementGap(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;
    const MICRO_STEP = 1; // Very small step
    const directions = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];

    for (const direction of directions) {
      const newPos = getPositionInDirection(currentPos, direction, MICRO_STEP);

      // Check bounds
      if (
        newPos.x < 0 ||
        newPos.x >= gameState.map.width ||
        newPos.y < 0 ||
        newPos.y >= gameState.map.height
      ) {
        continue;
      }

      // Check if this micro-movement is possible
      if (canMoveTo(newPos, gameState)) {
        console.log(
          `🕳️ Found micro-gap in direction ${direction} at (${newPos.x}, ${newPos.y})`
        );
        return this.createDecision(
          BotAction.MOVE,
          this.priority,
          `Emergency micro-movement gap - ${direction}`,
          direction
        );
      }
    }

    return null;
  }

  /**
   * Finds emergency moves with RELAXED threshold for tight spaces.
   * Accepts ANY direction that provides some escape room, even if blocked soon.
   */
  private findEmergencyMovesRelaxed(
    gameState: GameState,
    currentPos: Position,
    directionsToCheck: Array<{
      primary: Direction;
      offset: { dx: number; dy: number };
    }>
  ): Array<{
    direction: Direction;
    score: number;
    newPos: Position;
    path: Position[];
  }> {
    const relaxedMoves: Array<{
      direction: Direction;
      score: number;
      newPos: Position;
      path: Position[];
    }> = [];

    const EMERGENCY_STEP = 3;
    const LOOKAHEAD_STEPS = 30;

    for (const dirInfo of directionsToCheck) {
      const newPos = {
        x: currentPos.x + dirInfo.offset.dx * EMERGENCY_STEP,
        y: currentPos.y + dirInfo.offset.dy * EMERGENCY_STEP,
      };

      // Bounds check
      if (
        newPos.x < EDGE_SAFETY_MARGIN ||
        newPos.x >= gameState.map.width - EDGE_SAFETY_MARGIN ||
        newPos.y < EDGE_SAFETY_MARGIN ||
        newPos.y >= gameState.map.height - EDGE_SAFETY_MARGIN
      ) {
        continue;
      }

      // Check immediate position ONLY - accept even if blocked soon
      if (!canMoveTo(newPos, gameState)) {
        continue;
      }

      // Calculate how many steps before blocked (same as before)
      let stepsBeforeBlocked = 1;
      let finalSafePos = newPos;

      for (let step = 2; step <= LOOKAHEAD_STEPS; step++) {
        const futurePos = {
          x: currentPos.x + dirInfo.offset.dx * EMERGENCY_STEP * step,
          y: currentPos.y + dirInfo.offset.dy * EMERGENCY_STEP * step,
        };

        if (
          futurePos.x < EDGE_SAFETY_MARGIN ||
          futurePos.x >= gameState.map.width - EDGE_SAFETY_MARGIN ||
          futurePos.y < EDGE_SAFETY_MARGIN ||
          futurePos.y >= gameState.map.height - EDGE_SAFETY_MARGIN
        ) {
          break;
        }

        if (!canMoveTo(futurePos, gameState)) {
          break;
        }

        stepsBeforeBlocked = step;
        finalSafePos = futurePos;
      }

      // RELAXED: Accept ANY valid direction, even if blocked in 1-9 steps
      const baseScore = this.calculateEmergencyScore(finalSafePos, gameState);
      const spaceBonus = Math.min(stepsBeforeBlocked * 5, 150);
      const finalScore = baseScore + spaceBonus;

      // Build escape path
      const escapePath: Position[] = [currentPos];
      for (let step = 1; step <= stepsBeforeBlocked; step++) {
        const stepPos = {
          x: currentPos.x + dirInfo.offset.dx * EMERGENCY_STEP * step,
          y: currentPos.y + dirInfo.offset.dy * EMERGENCY_STEP * step,
        };
        escapePath.push(stepPos);
      }

      console.log(
        `📊 RELAXED Direction ${dirInfo.primary}: Score ${finalScore} (base: ${baseScore} + space: ${spaceBonus}), steps: ${stepsBeforeBlocked}`
      );

      relaxedMoves.push({
        direction: dirInfo.primary,
        score: finalScore,
        newPos: finalSafePos,
        path: escapePath,
      });
    }

    return relaxedMoves;
  }

  /**
   * Resets emergency escape state tracking.
   */
  private resetEmergencyState(): void {
    this.lastEmergencyPosition = null;
    this.emergencyAttempts = 0;
    console.log(`🔄 Emergency state reset`);
  }
}
