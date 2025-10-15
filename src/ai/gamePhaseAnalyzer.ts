import { GameState } from "../types";

/**
 * Game phases based on time and resources
 */
export enum GamePhase {
  EARLY_GAME = "EARLY_GAME", // 0-60s: Focus on resources
  MID_GAME = "MID_GAME", // 60-180s: Mixed strategy
  LATE_GAME = "LATE_GAME", // 180s+: Focus on combat
  ENDGAME = "ENDGAME", // Few players left
}

/**
 * Strategic priorities for decision making
 */
export interface StrategicPriorities {
  wallBreaking: number; // Priority for breaking walls (0-100)
  itemCollection: number; // Priority for collecting items (0-100)
  exploration: number; // Priority for exploring (0-100)
  combat: number; // Priority for attacking enemies (0-100)
  safety: number; // Priority for playing safe (0-100)
}

/**
 * Analyzes game state to determine current phase and strategic priorities
 */
export class GamePhaseAnalyzer {
  /**
   * Determine current game phase based on game state
   */
  public static analyzePhase(gameState: GameState): GamePhase {
    const aliveEnemies = gameState.enemies.filter((e) => e.isAlive).length;
    const totalPlayers = aliveEnemies + 1; // Including current bot

    // ENDGAME: Very few players left (1v1 or 2v2)
    if (totalPlayers <= 2) {
      return GamePhase.ENDGAME;
    }

    // Count resources on map
    const chestsLeft = gameState.map.chests?.length || 0;
    const itemsLeft = gameState.map.items?.length || 0;
    const totalResources = chestsLeft + itemsLeft;

    // EARLY_GAME: Lots of resources available
    if (totalResources > 20) {
      return GamePhase.EARLY_GAME;
    }

    // LATE_GAME: Few resources left, focus on combat
    if (totalResources < 5) {
      return GamePhase.LATE_GAME;
    }

    // MID_GAME: Default phase
    return GamePhase.MID_GAME;
  }

  /**
   * Check if bot is stuck (surrounded by walls with limited movement)
   */
  private static isStuckByWalls(gameState: GameState): boolean {
    const bot = gameState.currentBot;

    // Count accessible cells within 3 cell radius
    let accessibleCells = 0;
    const CELL_SIZE = 40;
    const CHECK_RADIUS = 3;

    for (let dx = -CHECK_RADIUS; dx <= CHECK_RADIUS; dx++) {
      for (let dy = -CHECK_RADIUS; dy <= CHECK_RADIUS; dy++) {
        const checkPos = {
          x: bot.position.x + dx * CELL_SIZE,
          y: bot.position.y + dy * CELL_SIZE,
        };

        // Check if position is blocked by wall or chest
        const isBlocked =
          gameState.map.walls?.some(
            (w) =>
              Math.abs(w.position.x - checkPos.x) < 20 &&
              Math.abs(w.position.y - checkPos.y) < 20
          ) ||
          gameState.map.chests?.some(
            (c) =>
              Math.abs(c.position.x - checkPos.x) < 20 &&
              Math.abs(c.position.y - checkPos.y) < 20
          );

        if (!isBlocked) {
          accessibleCells++;
        }
      }
    }

    const totalCells = (CHECK_RADIUS * 2 + 1) ** 2;
    const accessibleRatio = accessibleCells / totalCells;

    // If less than 30% of nearby cells are accessible, bot is stuck
    return accessibleRatio < 0.3;
  }

  /**
   * Calculate strategic priorities based on current game state
   *
   * Formula considers:
   * 1. Game phase (early/mid/late)
   * 2. Bot's current power level
   * 3. Available resources on map
   * 4. Enemy threat level
   * 5. Bot's current position safety
   * 6. Stuck situation (surrounded by walls)
   */
  public static calculatePriorities(
    gameState: GameState
  ): StrategicPriorities {
    const phase = this.analyzePhase(gameState);
    const bot = gameState.currentBot;

    // CRITICAL: Check if bot is stuck by walls
    const isStuck = this.isStuckByWalls(gameState);

    if (isStuck) {
      console.log(`🚧 BOT IS STUCK! Prioritizing wall breaking to escape`);
      // Emergency mode: Break walls to create space
      return {
        wallBreaking: 100, // Maximum priority
        itemCollection: 30, // Low - focus on escape first
        exploration: 10, // Very low - can't explore when stuck
        combat: 0, // No combat when stuck
        safety: 80, // High - only break walls that are safe
      };
    }

    // Analyze bot's power level (0-100)
    const powerLevel = this.analyzeBotPower(gameState);

    // Analyze resource availability (0-100)
    const resourceAvailability = this.analyzeResourceAvailability(gameState);

    // Analyze enemy threat (0-100)
    const enemyThreat = this.analyzeEnemyThreat(gameState);

    // Base priorities by phase
    let priorities: StrategicPriorities;

    switch (phase) {
      case GamePhase.EARLY_GAME:
        // Early game: Focus on resources and power-ups
        priorities = {
          wallBreaking: 70, // High - get power-ups from chests
          itemCollection: 80, // Very high - grab items quickly
          exploration: 60, // Medium-high - find resources
          combat: 20, // Low - avoid fights
          safety: 50, // Medium - take calculated risks
        };
        break;

      case GamePhase.MID_GAME:
        // Mid game: Balanced approach
        priorities = {
          wallBreaking: 50, // Medium - still useful
          itemCollection: 60, // Medium-high - grab what's left
          exploration: 40, // Medium-low - most map explored
          combat: 40, // Medium - engage if favorable
          safety: 60, // Medium-high - don't die stupidly
        };
        break;

      case GamePhase.LATE_GAME:
        // Late game: Combat focus
        priorities = {
          wallBreaking: 30, // Low - few chests left
          itemCollection: 40, // Medium-low - grab stragglers
          exploration: 20, // Low - map is known
          combat: 70, // High - actively hunt enemies
          safety: 70, // High - deaths are costly
        };
        break;

      case GamePhase.ENDGAME:
        // Endgame: Pure combat
        priorities = {
          wallBreaking: 10, // Very low
          itemCollection: 30, // Low - only if safe
          exploration: 10, // Very low
          combat: 90, // Very high - must fight
          safety: 80, // Very high - one death = loss
        };
        break;
    }

    // ADJUSTMENT 1: Power level modifiers
    if (powerLevel < 30) {
      // Weak bot: Prioritize resources over combat
      priorities.wallBreaking += 20;
      priorities.itemCollection += 20;
      priorities.combat -= 30;
      priorities.safety += 15;
    } else if (powerLevel > 70) {
      // Strong bot: More aggressive
      priorities.combat += 20;
      priorities.safety -= 10;
      priorities.wallBreaking -= 10;
    }

    // ADJUSTMENT 2: Resource scarcity
    if (resourceAvailability < 20) {
      // Few resources: Stop looking, start fighting
      priorities.wallBreaking -= 20;
      priorities.itemCollection -= 20;
      priorities.exploration -= 20;
      priorities.combat += 20;
    } else if (resourceAvailability > 70) {
      // Many resources: Grab them!
      priorities.wallBreaking += 15;
      priorities.itemCollection += 15;
    }

    // ADJUSTMENT 3: Enemy threat
    if (enemyThreat > 70) {
      // High threat: Play safer, avoid combat
      priorities.safety += 20;
      priorities.combat -= 20;
      priorities.exploration -= 15;
    } else if (enemyThreat < 30) {
      // Low threat: Be more aggressive
      priorities.combat += 15;
      priorities.safety -= 10;
    }

    // ADJUSTMENT 4: Bomb count
    if (bot.bombCount === 0) {
      // No bombs: Can't fight or break walls
      priorities.combat = 0;
      priorities.wallBreaking = 0;
      priorities.itemCollection += 30; // Look for bomb items
      priorities.safety += 20;
    }

    // Normalize to 0-100 range
    const clamp = (value: number) => Math.max(0, Math.min(100, value));

    return {
      wallBreaking: clamp(priorities.wallBreaking),
      itemCollection: clamp(priorities.itemCollection),
      exploration: clamp(priorities.exploration),
      combat: clamp(priorities.combat),
      safety: clamp(priorities.safety),
    };
  }

  /**
   * Analyze bot's power level (0-100)
   * Based on: bomb count, flame range, speed
   */
  private static analyzeBotPower(gameState: GameState): number {
    const bot = gameState.currentBot;

    let power = 0;

    // Bomb count contribution (max 40 points)
    power += Math.min(bot.bombCount * 10, 40);

    // Flame range contribution (max 30 points)
    power += Math.min((bot.flameRange - 1) * 10, 30);

    // Speed contribution (max 30 points)
    power += Math.min((bot.speed - 1) * 15, 30);

    return Math.min(power, 100);
  }

  /**
   * Analyze resource availability (0-100)
   * More resources = higher value
   */
  private static analyzeResourceAvailability(gameState: GameState): number {
    const chestsCount = gameState.map.chests?.length || 0;
    const itemsCount = gameState.map.items?.length || 0;

    const totalResources = chestsCount + itemsCount;

    // Assume max ~50 resources at start
    const resourceScore = Math.min((totalResources / 50) * 100, 100);

    return resourceScore;
  }

  /**
   * Analyze enemy threat level (0-100)
   * Higher = more dangerous enemies nearby
   */
  private static analyzeEnemyThreat(gameState: GameState): number {
    const bot = gameState.currentBot;
    const enemies = gameState.enemies.filter((e) => e.isAlive);

    if (enemies.length === 0) return 0;

    let threatScore = 0;

    // Count enemies within danger radius
    const DANGER_RADIUS = 200; // 5 cells

    for (const enemy of enemies) {
      const distance =
        Math.abs(bot.position.x - enemy.position.x) +
        Math.abs(bot.position.y - enemy.position.y);

      if (distance < DANGER_RADIUS) {
        // Close enemies are more dangerous
        const proximityThreat = ((DANGER_RADIUS - distance) / DANGER_RADIUS) * 50;

        // Adjust for relative power
        const enemyPower =
          (enemy.bombCount || 1) * 10 +
          (enemy.flameRange || 2) * 10 +
          (enemy.speed || 1) * 10;
        const ourPower =
          bot.bombCount * 10 + bot.flameRange * 10 + bot.speed * 10;

        const powerRatio = enemyPower / Math.max(ourPower, 1);
        const powerThreat = powerRatio * 30;

        threatScore += proximityThreat + powerThreat;
      }
    }

    return Math.min(threatScore, 100);
  }

  /**
   * Get recommended strategy adjustment
   */
  public static getStrategyAdjustment(gameState: GameState): {
    phase: GamePhase;
    priorities: StrategicPriorities;
    recommendations: string[];
  } {
    const phase = this.analyzePhase(gameState);
    const priorities = this.calculatePriorities(gameState);

    const recommendations: string[] = [];

    // Generate human-readable recommendations
    if (priorities.wallBreaking > 60) {
      recommendations.push("🔨 Focus on breaking walls for power-ups");
    }
    if (priorities.itemCollection > 70) {
      recommendations.push("💎 Prioritize collecting items");
    }
    if (priorities.combat > 60) {
      recommendations.push("⚔️ Engage enemies aggressively");
    }
    if (priorities.safety > 70) {
      recommendations.push("🛡️ Play defensively, survival is key");
    }
    if (priorities.exploration > 60) {
      recommendations.push("🗺️ Explore uncovered areas");
    }

    return { phase, priorities, recommendations };
  }
}
