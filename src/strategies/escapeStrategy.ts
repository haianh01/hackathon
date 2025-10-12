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
import { Pathfinding } from "../utils/pathfinding";
import {
  getPositionInDirection,
  canMoveTo,
  getDirectionToTarget,
} from "../utils";
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
    const bestSafePosition = this.findBestSafePosition(gameState);

    if (bestSafePosition) {
      const direction = getDirectionToTarget(currentPos, bestSafePosition);
      return this.createDecision(
        BotAction.MOVE,
        this.priority,
        `Escape - moving to best safe position (${bestSafePosition.x}, ${bestSafePosition.y})`,
        direction,
        bestSafePosition
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
   * @returns The next position to move to, or null if none are found.
   */
  private findBestSafePosition(gameState: GameState): Position | null {
    console.log(`🔍 EscapeStrategy: Finding best safe position...`);
    const currentPos = gameState.currentBot.position;

    // First, try adjacent safe positions (faster)
    const safePositions = getSafeAdjacentPositions(currentPos, gameState);

    if (safePositions.length > 0) {
      console.log(`✅ Found ${safePositions.length} adjacent safe positions`);

      if (safePositions.length === 1) {
        return safePositions[0] ?? null;
      }

      // Score each safe position and return the best one.
      const scoredPositions = safePositions.map((pos) => ({
        position: pos,
        score: this.scorePosition(pos, gameState),
      }));

      scoredPositions.sort((a, b) => b.score - a.score);
      return scoredPositions[0]?.position ?? null;
    }

    // No adjacent safe positions, use pathfinding for long-distance escape
    console.log(
      `⚠️ No adjacent safe positions, searching distant safe zones...`
    );
    return this.findDistantSafePosition(gameState);
  }

  /**
   * Uses A* pathfinding to find path to distant safe positions.
   * @param gameState The current game state.
   * @returns The next position to move toward distant safe zone, or null if none found.
   */
  private findDistantSafePosition(gameState: GameState): Position | null {
    const currentPos = gameState.currentBot.position;
    const SEARCH_RADIUS = 200; // pixels - reasonable search area
    const CELL_SIZE = 40; // Convert to cells for pathfinding

    console.log(
      `🔍 Searching for distant safe zones within ${SEARCH_RADIUS}px radius...`
    );

    // Find all safe positions within search radius
    const safeCandidates: Position[] = [];

    for (
      let x = Math.max(0, currentPos.x - SEARCH_RADIUS);
      x < Math.min(gameState.map.width, currentPos.x + SEARCH_RADIUS);
      x += CELL_SIZE
    ) {
      for (
        let y = Math.max(0, currentPos.y - SEARCH_RADIUS);
        y < Math.min(gameState.map.height, currentPos.y + SEARCH_RADIUS);
        y += CELL_SIZE
      ) {
        const candidate = { x, y };

        // Check if position is safe and reachable
        if (
          !isPositionInDangerZone(candidate, gameState) &&
          canMoveTo(candidate, gameState)
        ) {
          safeCandidates.push(candidate);
        }
      }
    }

    console.log(`🎯 Found ${safeCandidates.length} distant safe candidates`);

    if (safeCandidates.length === 0) {
      return null;
    }

    // Find the closest safe position using pathfinding
    let bestPath: Position[] | null = null;
    let bestTarget: Position | null = null;

    for (const candidate of safeCandidates) {
      try {
        const path = Pathfinding.findPath(currentPos, candidate, gameState);

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

    if (bestPath && bestPath.length > 1) {
      const nextStep = bestPath[1]; // First step in path (index 0 is current position)
      if (nextStep) {
        console.log(
          `🛤️ Found path to safe zone (${bestTarget?.x}, ${bestTarget?.y}), next step: (${nextStep.x}, ${nextStep.y})`
        );
        return nextStep;
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
  public handleEmergency(gameState: GameState): BotDecision | null {
    console.log(`🚨 === EMERGENCY ESCAPE EVALUATION ===`);
    const { currentBot } = gameState;
    const currentPos = currentBot.position;

    console.log(`📍 Current position: (${currentPos.x}, ${currentPos.y})`);
    console.log(
      `🗺️ Map bounds: ${gameState.map.width}x${gameState.map.height} pixels`
    );

    // Check if we're stuck in the same position (emergency loop detection)
    if (
      this.lastEmergencyPosition &&
      this.lastEmergencyPosition.x === currentPos.x &&
      this.lastEmergencyPosition.y === currentPos.y
    ) {
      this.emergencyAttempts++;
      console.log(
        `⚠️ EMERGENCY LOOP DETECTED! Attempt ${this.emergencyAttempts}/${this.MAX_EMERGENCY_ATTEMPTS} at same position`
      );

      if (this.emergencyAttempts >= this.MAX_EMERGENCY_ATTEMPTS) {
        console.log(
          `🛑 MAX EMERGENCY ATTEMPTS REACHED - Forcing complete stop to break loop`
        );
        this.resetEmergencyState();
        return this.createDecision(
          BotAction.STOP,
          this.priority,
          "Emergency loop detected - forcing stop to break cycle",
          Direction.STOP
        );
      }
    } else {
      // Reset attempts if position changed
      this.emergencyAttempts = 0;
      this.lastEmergencyPosition = { x: currentPos.x, y: currentPos.y };
    }

    // First, check if we're completely surrounded by enemy players
    const allDirectionsBlockedByPlayers =
      this.areAllDirectionsBlockedByPlayers(gameState);
    if (allDirectionsBlockedByPlayers) {
      console.log(
        `⚠️ ALL DIRECTIONS BLOCKED BY PLAYERS - Trying alternative strategies...`
      );
      return this.handleCompletePlayerBlockage(gameState);
    }

    const directions = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];
    const possibleMoves: {
      direction: Direction;
      score: number;
      newPos: Position;
    }[] = [];

    // Use smaller movement step for emergency escape (similar to bot movement)
    const EMERGENCY_STEP = 3; // Small step like bot movement
    const LOOKAHEAD_STEPS = 10; // Check 10 steps ahead (30px total)

    for (const direction of directions) {
      const newPos = getPositionInDirection(
        currentPos,
        direction,
        EMERGENCY_STEP
      );

      console.log(
        `🔍 Testing direction ${direction}: (${currentPos.x}, ${currentPos.y}) -> (${newPos.x}, ${newPos.y})`
      );

      // ENHANCED bounds check with safety margin
      const SAFETY_MARGIN = 20; // Keep bot at least 20px from edges
      if (
        newPos.x < SAFETY_MARGIN ||
        newPos.x >= gameState.map.width - SAFETY_MARGIN ||
        newPos.y < SAFETY_MARGIN ||
        newPos.y >= gameState.map.height - SAFETY_MARGIN
      ) {
        console.log(
          `❌ Direction ${direction}: Too close to bounds (safety margin)!`
        );
        continue;
      }

      // Enhanced collision check - look ahead multiple steps
      let canMoveInDirection = true;
      let finalSafePos = newPos;

      // Check immediate position
      if (!canMoveTo(newPos, gameState)) {
        console.log(`❌ Direction ${direction}: Immediate position blocked`);
        canMoveInDirection = false;
      } else {
        // Check trajectory for next few steps to avoid getting stuck
        for (let step = 2; step <= LOOKAHEAD_STEPS; step++) {
          const futurePos = getPositionInDirection(
            currentPos,
            direction,
            EMERGENCY_STEP * step
          );

          // ENHANCED bounds check with safety margin
          const SAFETY_MARGIN = 20;
          if (
            futurePos.x < SAFETY_MARGIN ||
            futurePos.x >= gameState.map.width - SAFETY_MARGIN ||
            futurePos.y < SAFETY_MARGIN ||
            futurePos.y >= gameState.map.height - SAFETY_MARGIN
          ) {
            console.log(
              `⚠️ Direction ${direction}: Too close to bounds at step ${step} (${futurePos.x}, ${futurePos.y})`
            );
            break;
          }

          if (!canMoveTo(futurePos, gameState)) {
            console.log(
              `⚠️ Direction ${direction}: Blocked at step ${step} (${futurePos.x}, ${futurePos.y})`
            );
            // Can still move a bit but will hit obstacle soon
            break;
          } else {
            finalSafePos = futurePos; // Update to furthest safe position
          }
        }
      }

      if (canMoveInDirection) {
        // Enhanced scoring system for emergency moves
        let score = this.calculateEmergencyScore(finalSafePos, gameState);

        console.log(
          `📊 Direction ${direction}: Score ${score} - can move to (${finalSafePos.x}, ${finalSafePos.y})`
        );
        possibleMoves.push({ direction, score, newPos: finalSafePos });
      } else {
        console.log(
          `❌ Direction ${direction}: Cannot move to position (blocked immediately)`
        );
      }
    }

    console.log(`📊 Found ${possibleMoves.length} possible emergency moves`);

    if (possibleMoves.length > 0) {
      possibleMoves.sort((a, b) => b.score - a.score);
      const bestMove = possibleMoves[0];
      if (bestMove) {
        console.log(
          `🏃 EMERGENCY CHOICE: ${bestMove.direction} to (${bestMove.newPos.x}, ${bestMove.newPos.y}) with score ${bestMove.score}`
        );
        console.log(`🚨 === EMERGENCY ESCAPE EVALUATION END ===`);

        return this.createDecision(
          BotAction.MOVE,
          this.priority,
          "Escape (Emergency) - moving to less dangerous area",
          bestMove.direction
        );
      }
    }

    console.log(`❌ No emergency moves available!`);
    console.log(`🚨 === EMERGENCY ESCAPE EVALUATION END ===`);
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

      // Enhanced bounds check with safety margin
      const SAFETY_MARGIN = 20;
      if (
        newPos.x < SAFETY_MARGIN ||
        newPos.x >= gameState.map.width - SAFETY_MARGIN ||
        newPos.y < SAFETY_MARGIN ||
        newPos.y >= gameState.map.height - SAFETY_MARGIN
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
        distantEscape
      );
      console.log(`🛤️ Strategy 3: Using distant pathfinding to bypass players`);
      return this.createDecision(
        BotAction.MOVE,
        this.priority,
        "Emergency escape via distant pathfinding",
        direction
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
   * Resets emergency escape state tracking.
   */
  private resetEmergencyState(): void {
    this.lastEmergencyPosition = null;
    this.emergencyAttempts = 0;
    console.log(`🔄 Emergency state reset`);
  }
}
