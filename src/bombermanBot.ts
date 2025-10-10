import { BombermanAI } from "./ai";
import { GameEngine } from "./game";
import { BotDecision, BotAction, UserResponse } from "./types";
import { SocketConnection } from "./connection/socketConnection";

/**
 * Main Bot class - the primary entry point for the application.
 */
export class BomberManBot {
  private ai: BombermanAI;
  private gameEngine: GameEngine;
  private socketConnection: SocketConnection;
  private isRunning: boolean = false;
  private botLogicInterval: NodeJS.Timeout | undefined;

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
      // Connect to the game server
      await this.connectToServer();

      // Set up the bot's logic loop
      this.setupBotLogic();

      this.isRunning = true;
      console.log("✅ Bot is ready!");
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
      console.log(`📍 Position updated: (${x}, ${y})`);
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
      // TODO: Immediately update game state to avoid bomb
      // this.gameEngine.addBombRealtime(data);
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
    this.botLogicInterval = setInterval(() => this.executeBotLogic(), 500);
  }

  /**
   * Executes the main bot logic.
   */
  private executeBotLogic(): void {
    if (!this.socketConnection.isGameRunning() || !this.isRunning) {
      return;
    }

    try {
      const gameState = this.gameEngine.getGameState();
      const decision = this.ai.makeDecision(gameState);
      console.log(
        `🤖 AI Decision: ${decision.action} -> ${
          decision.direction || "N/A"
        } with priority ${decision.priority}`
      );
      this.executeAction(decision);
    } catch (error) {
      console.error("❌ Error in bot logic:", error);
    }
  }

  /**
   * Executes an action based on the AI's decision.
   */
  private executeAction(decision: BotDecision): void {
    switch (decision.action) {
      case BotAction.MOVE:
        if (decision.direction) {
          this.socketConnection.startContinuousMove(decision.direction);
        }
        break;
      case BotAction.BOMB:
        this.socketConnection.stopContinuousMove();
        this.socketConnection.placeBomb();
        break;
      case BotAction.STOP:
      default:
        this.socketConnection.stopContinuousMove();
        break;
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
        console.warn("⚠️ Bot info not yet available, skipping update.");
        return;
      }

      this.gameEngine.updateGameState(gameData, socketId);

      const currentBot = this.gameEngine.getCurrentBot();
      if (!currentBot.isAlive) {
        if (this.isRunning) {
          console.log("🏁 Bot is no longer alive. Stopping logic.");
          this.isRunning = false;
        }
        return;
      }
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
