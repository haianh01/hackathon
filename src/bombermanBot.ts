import { BombermanAI } from "./ai";
import { GameEngine } from "./game";
import {
  BotDecision,
  BotAction,
  UserResponse,
  Position,
  Direction,
} from "./types";
import { SocketConnection } from "./connection/socketConnection";
import { getDirectionToTarget } from "./utils/position";

/**
 * Main Bot class - the primary entry point for the application.
 */
export class BomberManBot {
  private ai: BombermanAI;
  private gameEngine: GameEngine;
  private socketConnection: SocketConnection;
  private isRunning: boolean = false;
  private botLogicInterval: NodeJS.Timeout | undefined;

  // Path following state
  private currentPath: Position[] | null = null;
  private currentPathIndex: number = 0;
  private pathTarget: Position | null = null;

  // Execution guard to prevent overlapping ticks
  private isExecuting: boolean = false;

  // State tracking for danger detection
  private lastBombCount: number = 0;

  constructor(serverAddress?: string, botToken?: string) {
    this.ai = new BombermanAI();
    this.gameEngine = new GameEngine();

    // Use values from parameters or environment variables
    const address = serverAddress || "https://zarena-dev4.zinza.com.vn";
    const token = botToken || process.env.BOT_TOKEN || "";

    this.socketConnection = new SocketConnection(address, token);
  }

  /**
   * Initializes the bot and starts the game.
   */
  public async initialize(): Promise<void> {
    console.log("🚀 Initializing Bomberman Bot...");

    try {
      await this.connectToServer();
      console.log("✅ Bot đã sẵn sàng!");

      this.setupBotLogic();

      this.isRunning = true;
    } catch (error) {
      console.error("❌ Error during bot initialization:", error);
      throw error;
    }
  }

  /**
   * Connects to the game server via Socket.IO.
   */
  private async connectToServer(): Promise<void> {
    console.log("🔌 Connecting to server...");

    // Set up event listeners
    this.socketConnection.onGameData((data: UserResponse) =>
      this.processGameData(data)
    );
    this.socketConnection.onGameStart(() => {
      console.log("🎮 Game started!");
      this.isRunning = true;
    });
    this.socketConnection.onGameEnd(() => {
      console.log("🏁 Game ended!");
      if (!this.socketConnection.isDevelopment()) {
        this.isRunning = false;
      }
    });
    this.socketConnection.onPositionUpdate((x: number, y: number) => {
      console.log(`📍 Position updated from server: (${x}, ${y})`);
      this.gameEngine.updateBotPosition(x, y);
    });

    // Set up real-time event callbacks
    this.setupRealtimeEventCallbacks();

    // Establish connection
    await this.socketConnection.connect();
    console.log("🔌 Connected to server.");
  }

  /**
   * Sets up callbacks for real-time game events.
   */
  private setupRealtimeEventCallbacks(): void {
    this.socketConnection.onNewBomb((data: any) => {
      console.log(`⚡ Realtime: New bomb at (${data.x}, ${data.y})`);

      // SOLUTION 1: Immediate danger detection and interruption
      // IMPORTANT: Don't trigger for our own bombs (AI already handles immediate escape)
      const myBomber = this.socketConnection.getMyBomberInfo();
      if (myBomber && data.ownerId === myBomber.uid) {
        console.log(`ℹ️ This is our own bomb, skipping immediate threat handler (AI handles escape)`);
        return;
      }

      this.handleImmediateBombThreat(data);
    });

    this.socketConnection.onBombExplode((data: any) => {
      console.log(`⚡ Realtime: Bomb exploded at (${data.x}, ${data.y})`);
      // TODO: Remove bomb from danger list
      // this.gameEngine.removeBombRealtime(data.id);
    });

    this.socketConnection.onChestDestroyed((data: any) => {
      console.log(`⚡ Realtime: Chest destroyed at (${data.x}, ${data.y})`);
      // TODO: An item might appear, needs re-evaluation
    });

    this.socketConnection.onItemCollected((data: any) => {
      console.log(`⚡ Realtime: Item collected at (${data.x}, ${data.y})`);
      // TODO: Remove item from target list if present
    });

    this.socketConnection.onUserDie((data: any) => {
      const myBomber = this.socketConnection.getMyBomberInfo();
      if (!myBomber) return;

      if (data.killed.uid === myBomber.uid) {
        console.log("💀 Bot has been eliminated!");
        this.isRunning = false;
      } else if (data.killer.uid === myBomber.uid) {
        console.log(
          `🎉 Bot eliminated ${data.killed.name}! +${data.score} score`
        );
      }
    });
  }

  /**
   * Sets up the bot's logic loop to run at a fixed interval.
   */
  private setupBotLogic(): void {
    this.botLogicInterval = setInterval(() => this.executeBotLogic(), 200);
  }

  /**
   * Executes the main bot logic.
   */
  private executeBotLogic(): void {
    // Prevent overlapping execution if previous tick is still running
    if (this.isExecuting) {
      console.warn("⚠️ Previous tick still running, skipping this tick...");
      return;
    }

    if (!this.socketConnection.isGameRunning() || !this.isRunning) {
      return;
    }

    // Start timing and set execution guard
    const startTime = Date.now();
    this.isExecuting = true;

    try {
      const gameState = this.gameEngine.getGameState();

      // SOLUTION 4: Detect state changes and abort path if needed
      const currentBombCount = gameState.map.bombs.length;
      if (currentBombCount > this.lastBombCount) {
        console.warn(
          `⚠️ New bombs detected! (${this.lastBombCount} -> ${currentBombCount}) Clearing current path for re-evaluation.`
        );
        this.clearPath(); // Force re-evaluation with new danger state
        this.socketConnection.stopContinuousMove();
      }
      this.lastBombCount = currentBombCount;

      const decisionStartTime = Date.now();
      const decision = this.ai.makeDecision(gameState);
      const decisionTime = Date.now() - decisionStartTime;

      console.log(
        `🤖 AI Decision: ${decision.action} -> ${
          decision.direction || "N/A"
        } with priority ${decision.priority} (took ${decisionTime}ms)`
      );

      const actionStartTime = Date.now();
      this.executeAction(decision);
      const actionTime = Date.now() - actionStartTime;

      // Calculate total execution time
      const totalTime = Date.now() - startTime;

      // Log performance metrics
      console.log(
        `⏱️ Tick performance: Decision=${decisionTime}ms, Action=${actionTime}ms, Total=${totalTime}ms`
      );

      // Warn if execution is taking too long (>150ms for 200ms interval)
      if (totalTime > 150) {
        console.warn(
          `⚠️ Slow tick detected! Execution took ${totalTime}ms (target: <150ms for 200ms interval)`
        );
      }
    } catch (error) {
      console.error("❌ Error in bot logic:", error);
    } finally {
      // Always release the execution guard
      this.isExecuting = false;
    }
  }

  /**
   * Executes an action based on the AI's decision.
   */
  private executeAction(decision: BotDecision): void {
    switch (decision.action) {
      case BotAction.MOVE:
        // Check if decision has a path (multi-step navigation)
        if (decision.path && decision.path.length > 1) {
          this.followPath(decision);
        } else if (decision.direction) {
          // Simple single-direction movement
          this.clearPath();
          this.socketConnection.startContinuousMove(decision.direction);
        }
        break;
      case BotAction.BOMB:
        this.clearPath();
        this.socketConnection.stopContinuousMove();
        this.socketConnection.placeBomb();
        // Mark bomb placement for immediate escape
        const currentBot = this.gameEngine.getCurrentBot();
        if (currentBot) {
          this.ai.markBombPlaced(currentBot.position);
        }
        break;
      case BotAction.STOP:
      default:
        this.clearPath();
        this.socketConnection.stopContinuousMove();
        break;
    }
  }

  /**
   * Follows a multi-step path from pathfinding.
   * Handles complex routes like "up, up, right" automatically.
   */
  private followPath(decision: BotDecision): void {
    const currentBot = this.gameEngine.getCurrentBot();
    if (!currentBot || !decision.path || decision.path.length <= 1) {
      return;
    }

    // Check if this is a new path or continuation of existing path
    const isNewPath =
      !this.currentPath ||
      !this.pathTarget ||
      !decision.target ||
      this.pathTarget.x !== decision.target.x ||
      this.pathTarget.y !== decision.target.y;

    if (isNewPath) {
      // Start following new path
      console.log(
        `🛤️ Starting new path: ${decision.path.length} steps to (${decision.target?.x}, ${decision.target?.y})`
      );
      this.currentPath = decision.path;
      this.currentPathIndex = 0;
      this.pathTarget = decision.target || null;
    }

    // Find current position in path
    const currentPos = currentBot.position;
    let closestIndex = this.currentPathIndex;
    let minDist = Infinity;

    // Safety check
    if (!this.currentPath) {
      return;
    }

    // OPTIMIZATION: Only search next few waypoints instead of entire remaining path
    // This bounds execution time to O(k) where k=5, instead of O(n) where n=path.length
    const LOOK_AHEAD_COUNT = 5;
    const searchEndIndex = Math.min(
      this.currentPathIndex + LOOK_AHEAD_COUNT,
      this.currentPath.length
    );

    // Find closest point in limited lookahead window
    for (let i = this.currentPathIndex; i < searchEndIndex; i++) {
      const pathPos = this.currentPath[i];
      if (!pathPos) continue;

      const dist = Math.hypot(
        currentPos.x - pathPos.x,
        currentPos.y - pathPos.y
      );

      if (dist < minDist) {
        minDist = dist;
        closestIndex = i;
      }
    }

    // Update to closest index
    this.currentPathIndex = closestIndex;

    // Check if we reached the target
    const REACHED_THRESHOLD = 20; // pixels - consider reached if within this distance
    if (
      this.pathTarget &&
      Math.hypot(
        currentPos.x - this.pathTarget.x,
        currentPos.y - this.pathTarget.y
      ) < REACHED_THRESHOLD
    ) {
      console.log(
        `✅ Reached path target at (${this.pathTarget.x}, ${this.pathTarget.y})`
      );
      this.clearPath();
      this.socketConnection.stopContinuousMove();
      return;
    }

    // Get next waypoint in path
    const nextIndex = Math.min(
      this.currentPathIndex + 1,
      this.currentPath.length - 1
    );
    const nextWaypoint = this.currentPath[nextIndex];

    if (!nextWaypoint) {
      console.log(`⚠️ No next waypoint found, clearing path`);
      this.clearPath();
      return;
    }

    // Calculate direction to next waypoint
    const direction = getDirectionToTarget(currentPos, nextWaypoint);

    console.log(
      `🎯 Following path: Step ${this.currentPathIndex + 1}/${
        this.currentPath.length
      } -> ${direction} to (${nextWaypoint.x}, ${nextWaypoint.y})`
    );

    // Move towards next waypoint
    this.socketConnection.startContinuousMove(direction);
  }

  /**
   * Clears the current path tracking state.
   */
  private clearPath(): void {
    this.currentPath = null;
    this.currentPathIndex = 0;
    this.pathTarget = null;
  }

  /**
   * SOLUTION 1: Handles immediate bomb threats with real-time interruption.
   * This bypasses the 200ms tick delay for critical danger scenarios.
   */
  private handleImmediateBombThreat(bombData: any): void {
    const currentBot = this.gameEngine.getCurrentBot();
    if (!currentBot) return;

    const bombPos = { x: bombData.x, y: bombData.y };
    const bombRange = bombData.range || 2;

    // Calculate distance from bot to bomb
    const distance = Math.hypot(
      currentBot.position.x - bombPos.x,
      currentBot.position.y - bombPos.y
    );

    // Calculate danger radius (in pixels)
    // Formula: (range * cellSize) + safety margin
    const CELL_SIZE = 40;
    const SAFETY_MARGIN = 80; // 2 cells margin
    const dangerRadius = bombRange * CELL_SIZE + SAFETY_MARGIN;

    console.log(
      `🔍 Bomb threat analysis: distance=${distance.toFixed(
        0
      )}px, dangerRadius=${dangerRadius}px`
    );

    // Check if bot is in immediate danger
    if (distance < dangerRadius) {
      console.warn(
        `🚨 IMMEDIATE THREAT! Bomb ${distance.toFixed(
          0
        )}px away (danger threshold: ${dangerRadius}px)`
      );

      // INTERRUPT current action immediately
      this.socketConnection.stopContinuousMove();
      this.clearPath();

      // Get escape decision from AI (uses EscapeStrategy)
      const gameState = this.gameEngine.getGameState();
      const escapeDirection = this.ai.makeDecisionEscape(gameState);

      console.log(
        `🏃 EMERGENCY ESCAPE: Running ${escapeDirection} from bomb at (${bombPos.x}, ${bombPos.y})`
      );

      // Execute emergency escape immediately
      this.executeAction(escapeDirection);
    } else {
      console.log(
        `✅ Bomb is safe distance away (${distance.toFixed(
          0
        )}px > ${dangerRadius}px)`
      );
    }
  }

  /**
   * Processes data from the server and updates the game state.
   */
  private processGameData(gameData: UserResponse): void {
    try {
      const myBotInfo = this.socketConnection.getMyBomberInfo();
      const socketId = myBotInfo?.uid;
      if (!socketId) {
        console.warn("⚠️ Bot info not available yet.");
        return;
      }
      this.gameEngine.updateGameState(gameData, socketId);

      const currentBot = this.gameEngine.getCurrentBot();
      console.log(
        "%c🤪 ~ file: bombermanBot.ts:182 [] -> currentBot : ",
        "color: #6ac955",
        currentBot
      );
    } catch (error) {
      console.error("❌ Error processing game data:", error);
    }
  }

  /**
   * Shuts down the bot and disconnects.
   */
  public shutdown(): void {
    console.log("🛑 Shutting down bot...");
    this.isRunning = false;

    if (this.botLogicInterval) {
      clearInterval(this.botLogicInterval);
      this.botLogicInterval = undefined;
    }

    this.socketConnection.disconnect();
    console.log("✅ Bot has been shut down completely.");
  }

  /**
   * Temporarily stops the bot while maintaining the connection.
   */
  public stop(): void {
    this.isRunning = false;
    console.log("⏸️ Bot has been paused.");
  }

  /**
   * Checks if the bot is currently active.
   */
  public isActive(): boolean {
    return this.isRunning && this.socketConnection.isConnected();
  }

  /**
   * Checks if the socket is connected.
   */
  public isConnected(): boolean {
    return this.socketConnection.isConnected();
  }

  /**
   * Checks if the game is currently running.
   */
  public isGameRunning(): boolean {
    return this.socketConnection.isGameRunning();
  }

  /**
   * Gets the current bot's information.
   */
  public getBotInfo() {
    return this.socketConnection.getMyBomberInfo();
  }

  /**
   * Gets information about the AI strategies.
   */
  public getAIInfo(): Array<{ name: string; priority: number }> {
    return this.ai.getStrategiesInfo();
  }

  /**
   * Updates the priority of a specific strategy.
   */
  public updateStrategyPriority(
    strategyName: string,
    priority: number
  ): boolean {
    const success = this.ai.updateStrategyPriority(strategyName, priority);
    if (success) {
      console.log(
        `🔄 Strategy '${strategyName}' priority updated to ${priority}.`
      );
    } else {
      console.warn(`⚠️ Strategy '${strategyName}' not found.`);
    }
    return success;
  }

  /**
   * Resets AI strategies to their default priorities.
   */
  public resetAI(): void {
    this.ai.resetStrategies();
    console.log("🔄 AI strategies have been reset to default.");
  }

  /**
   * Gets the current game statistics.
   */
  public getGameStats() {
    return this.gameEngine.getGameStats();
  }

  /**
   * Gets the current game state for debugging purposes.
   */
  public getGameState() {
    return this.gameEngine.getGameState();
  }
}
