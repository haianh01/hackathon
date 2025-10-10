import { GameState, BotDecision, BotAction, Direction } from "../types";
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
  AlignAndBombStrategy,
  ChestSeekerStrategy,
} from "../strategies";

/**
 * The main AI engine for controlling the bot.
 */
export class BombermanAI {
  private strategies: BotStrategy[];

  constructor() {
    // Initialize all strategies in order of priority
    this.strategies = this.getDefaultStrategies();
  }

  /**
   * Makes a decision for the bot based on the current game state.
   * @param gameState The current state of the game.
   * @returns The decision for the bot to execute.
   */
  public makeDecision(gameState: GameState): BotDecision {
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

    // Sort by priority (highest first)
    decisions.sort((a, b) => b.priority - a.priority);

    const bestDecision = decisions[0]!;

    console.log(
      `🤖 Bot decided: ${bestDecision.reason} (Priority: ${bestDecision.priority})`
    );

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
      new AlignAndBombStrategy(), // 85-100 - Align to grid and bomb chests
      new BombStrategy(), // 80 - Place bombs strategically
      new AttackStrategy(), // 80 - Attack enemies
      new DefensiveStrategy(), // 70 - Play defensively
      new CollectStrategy(), // 60 - Collect items
      new ChestSeekerStrategy(), // 55 - Seek nearby chests
      new WallBreakerStrategy(), // 50 - Break walls
      new ExploreStrategy(), // 40 - Explore the map
      new SmartNavigationStrategy(), // 30 - Navigate intelligently
    ].sort((a, b) => b.priority - a.priority);
  }
}
