import {
  GameState,
  BotDecision,
  BotAction,
  Direction,
  Position,
} from "../types";
import {
  BotStrategy,
  EscapeStrategy,
  AttackStrategy,
  CollectStrategy,
  ExploreStrategy,
  DefensiveStrategy,
  WallBreakerStrategy,
  SmartNavigationStrategy,
  BombStrategy,
} from "../strategies";
import { CELL_SIZE } from "../utils";
import { GamePhaseAnalyzer } from "./gamePhaseAnalyzer";

/**
 * The main AI engine for controlling the bot.
 */
export class BombermanAI {
  private strategies: BotStrategy[];
  private justPlacedBomb: boolean = false;
  private bombPlacementTime: number = 0;
  private bombPlacementPosition: Position | null = null;

  constructor() {
    // Initialize all strategies in order of priority
    this.strategies = this.getDefaultStrategies();
  }

  /**
   * Mark that we just placed a bomb (for immediate escape trigger)
   */
  public markBombPlaced(position: Position): void {
    this.justPlacedBomb = true;
    this.bombPlacementTime = Date.now();
    this.bombPlacementPosition = position;
    console.log(`💣 AI: Marked bomb placed at (${position.x}, ${position.y})`);
  }

  /**
   * Check if we need immediate escape due to recent bomb placement
   */
  private needsImmediateEscape(gameState: GameState): boolean {
    if (!this.justPlacedBomb || !this.bombPlacementPosition) {
      return false;
    }

    const elapsedTime = Date.now() - this.bombPlacementTime;

    // TIMEOUT: Max 3 seconds emergency mode
    if (elapsedTime > 3000) {
      this.justPlacedBomb = false;
      this.bombPlacementPosition = null;
      console.log(`✅ Emergency escape timeout (${elapsedTime}ms elapsed)`);
      return false;
    }

    // Check if bomb still exists on map
    const bombStillExists = gameState.map.bombs.some(
      (b) =>
        Math.abs(b.position.x - this.bombPlacementPosition!.x) < 20 &&
        Math.abs(b.position.y - this.bombPlacementPosition!.y) < 20
    );

    if (!bombStillExists && elapsedTime > 500) {
      // Bomb already exploded, safe now
      this.justPlacedBomb = false;
      this.bombPlacementPosition = null;
      console.log(
        `✅ Bomb already exploded after ${elapsedTime}ms, ending emergency mode`
      );
      return false;
    }

    // Check if we're still close to the bomb placement position
    const currentPos = gameState.currentBot.position;
    const distance =
      Math.abs(currentPos.x - this.bombPlacementPosition.x) +
      Math.abs(currentPos.y - this.bombPlacementPosition.y);

    const flameRange = gameState.currentBot.flameRange || 2;
    const dangerRadius = (flameRange + 1.5) * CELL_SIZE; // Add 1.5 cell safety margin

    const isStillInDanger = distance < dangerRadius;

    // EARLY EXIT: If escaped far enough (after at least 500ms to avoid flicker)
    if (!isStillInDanger && elapsedTime > 500) {
      this.justPlacedBomb = false;
      this.bombPlacementPosition = null;
      console.log(
        `✅ Escaped to safety! Distance: ${distance}px (safe at ${dangerRadius}px), ending emergency mode after ${elapsedTime}ms`
      );
      return false;
    }

    // Still in danger
    if (isStillInDanger) {
      console.log(
        `⚠️ Still in danger: distance ${distance}px < ${dangerRadius}px (elapsed: ${elapsedTime}ms)`
      );
    }

    return isStillInDanger;
  }

  /**
   * Makes a decision for the bot based on the current game state.
   * @param gameState The current state of the game.
   * @returns The decision for the bot to execute.
   */
  public makeDecision(gameState: GameState): BotDecision {
    // if (this.needsImmediateEscape(gameState)) {
    //   console.log(`🚨 IMMEDIATE ESCAPE NEEDED after bomb placement!`);

    //   const escapeStrategy = this.strategies.find(
    //     (s) => s.name === "Escape"
    //   ) as EscapeStrategy;
    //   if (escapeStrategy) {
    //     const emergencyDecision = escapeStrategy.handleEmergency(gameState);
    //     if (emergencyDecision) {
    //       console.log(`🏃 EMERGENCY ESCAPE: ${emergencyDecision.reason}`);
    //       return emergencyDecision;
    //     }
    //   }
    // }

    // DYNAMIC PRIORITY ADJUSTMENT based on game phase
    // const analysis = GamePhaseAnalyzer.getStrategyAdjustment(gameState);
    // console.log(`\n🎮 === GAME PHASE ANALYSIS ===`);
    // console.log(`📍 Phase: ${analysis.phase}`);
    // console.log(`🎯 Priorities:`);
    // console.log(`   Wall Breaking: ${analysis.priorities.wallBreaking}/100`);
    // console.log(
    //   `   Item Collection: ${analysis.priorities.itemCollection}/100`
    // );
    // console.log(`   Exploration: ${analysis.priorities.exploration}/100`);
    // console.log(`   Combat: ${analysis.priorities.combat}/100`);
    // console.log(`   Safety: ${analysis.priorities.safety}/100`);
    // if (analysis.recommendations.length > 0) {
    //   console.log(`💡 Recommendations:`);
    //   analysis.recommendations.forEach((rec) => console.log(`   ${rec}`));
    // }
    // console.log(`🎮 === GAME PHASE ANALYSIS END ===\n`);

    const decisions: BotDecision[] = this.strategies
      .map((strategy) => {
        try {
          const decision = strategy.evaluate(gameState);
          if (!decision) return null;

          // // Apply dynamic priority modifiers
          // let adjustedPriority = decision.priority;

          // // Adjust based on strategy type
          // if (strategy.name === "WallBreaker") {
          //   const modifier = (analysis.priorities.wallBreaking / 100) * 1.5;
          //   adjustedPriority = decision.priority * modifier;
          // } else if (strategy.name === "Collect") {
          //   const modifier = (analysis.priorities.itemCollection / 100) * 1.5;
          //   adjustedPriority = decision.priority * modifier;
          // } else if (strategy.name === "Explore") {
          //   const modifier = (analysis.priorities.exploration / 100) * 1.5;
          //   adjustedPriority = decision.priority * modifier;
          // } else if (strategy.name === "Attack") {
          //   const modifier = (analysis.priorities.combat / 100) * 1.5;
          //   adjustedPriority = decision.priority * modifier;
          // }

          return {
            ...decision,
            // priority: adjustedPriority,
          };
        } catch (error) {
          console.error(`Error in strategy ${strategy.name}:`, error);
          return null;
        }
      })
      .filter((decision): decision is BotDecision => decision !== null);

    if (decisions.length === 0) {
      return {
        action: BotAction.STOP,
        direction: Direction.STOP,
        priority: 0,
        reason: "No suitable strategy found - standing still",
      };
    }

    // Sort by priority (highest first)
    decisions.sort((a, b) => b.priority - a.priority);

    console.log(`\n🧠 === AI DECISION MAKING ===`);
    console.log(`📊 Available decisions: ${decisions.length}`);
    decisions.forEach((decision, index) => {
      console.log(
        `  ${index + 1}. ${
          decision.reason
        } (Priority: ${decision.priority.toFixed(1)})`
      );
    });

    const bestDecision = decisions[0]!;
    console.log(
      `🏆 SELECTED: ${
        bestDecision.reason
      } (Priority: ${bestDecision.priority.toFixed(1)})`
    );
    console.log(`🧠 === AI DECISION MAKING END ===\n`);

    console.log(
      `🤖 Bot decided: ${bestDecision.reason} (Priority: ${JSON.stringify(
        bestDecision
      )})`
    );

    return bestDecision;
  }

  /**
   * Makes a decision when the bot is in a "waiting" state (e.g., after placing its last bomb).
   * It prioritizes staying safe and observing.
   * @param gameState The current state of the game.
   * @returns A defensive or exploratory decision.
   */
  public makeDefensiveDecision(gameState: GameState): BotDecision {
    // 1. Try to find a safe defensive position to observe.
    const defensiveStrategy = this.strategies.find(
      (s) => s.name === "Defensive"
    ) as DefensiveStrategy;
    if (defensiveStrategy) {
      const decision = defensiveStrategy.evaluate(gameState);
      if (decision) {
        return decision;
      }
    }

    // 2. If no defensive position, just explore nearby safely.
    const exploreStrategy = this.strategies.find(
      (s) => s.name === "Explore"
    ) as ExploreStrategy;
    if (exploreStrategy) {
      const decision = exploreStrategy.evaluate(gameState);
      if (decision) return decision;
    }

    // 3. If all else fails, just stop.
    return {
      action: BotAction.STOP,
      direction: Direction.STOP,
      priority: 1, // Low priority, just a fallback.
      reason: "Waiting for bomb, no defensive move found, stopping.",
    };
  }

  public makeDecisionEscape(gameState: GameState): BotDecision {
    const escapeStrategy = this.strategies.find(
      (s) => s.name === "Escape"
    ) as EscapeStrategy;
    if (escapeStrategy) {
      const emergencyDecision = escapeStrategy.handleEmergency(gameState);
      if (emergencyDecision) {
        console.log(`🏃 EMERGENCY ESCAPE: ${emergencyDecision.reason}`);
        return emergencyDecision;
      }
    }

    const decisions: BotDecision[] = this.strategies
      .map((strategy) => {
        try {
          return strategy.evaluate(gameState);
        } catch (error) {
          console.error(`Error in strategy ${strategy.name}:`, error);
          return null;
        }
      })
      .filter((decision): decision is BotDecision => decision !== null);

    if (decisions.length === 0) {
      return {
        action: BotAction.STOP,
        direction: Direction.STOP,
        priority: 0,
        reason: "No suitable strategy found - standing still",
      };
    }

    decisions.sort((a, b) => b.priority - a.priority);

    const bestDecision = decisions[0]!;

    return bestDecision;
  }

  /**
   * Adds a custom strategy to the AI.
   * @param strategy The strategy to add.
   */
  public addStrategy(strategy: BotStrategy): void {
    this.strategies.push(strategy);
    this.sortStrategies();
  }

  /**
   * Removes a strategy by its name.
   * @param name The name of the strategy to remove.
   */
  public removeStrategy(name: string): void {
    this.strategies = this.strategies.filter((s) => s.name !== name);
  }

  /**
   * Gets information about all current strategies.
   * @returns An array of objects with strategy names and priorities.
   */
  public getStrategiesInfo(): Array<{ name: string; priority: number }> {
    return this.strategies.map((s) => ({
      name: s.name,
      priority: s.priority,
    }));
  }

  /**
   * Updates the priority of a strategy.
   * @param name The name of the strategy to update.
   * @param newPriority The new priority value.
   * @returns True if the update was successful, false otherwise.
   */
  public updateStrategyPriority(name: string, newPriority: number): boolean {
    const strategy = this.strategies.find((s) => s.name === name);
    if (strategy) {
      strategy.priority = newPriority;
      this.sortStrategies();
      return true;
    }
    return false;
  }

  /**
   * Resets all strategies to their default set and order.
   */
  public resetStrategies(): void {
    this.strategies = this.getDefaultStrategies();
  }

  /**
   * Sorts strategies by priority in descending order.
   */
  private sortStrategies(): void {
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Gets the default set of strategies.
   * @returns An array of default bot strategies.
   */
  private getDefaultStrategies(): BotStrategy[] {
    return [
      new EscapeStrategy(), // 100 - Highest priority - escape danger
      // new BombStrategy(), // 80 - Place bombs strategically
      // new AttackStrategy(), // 80 - Attack enemies
      new DefensiveStrategy(), // 70 - Play defensively
      // new CollectStrategy(), // 60 - Collect items
      new WallBreakerStrategy(), // 50 - Break walls
      // new ExploreStrategy(), // 40 - Explore the map
      // new SmartNavigationStrategy(), // 30 - Navigate intelligently
    ].sort((a, b) => b.priority - a.priority);
  }
}
