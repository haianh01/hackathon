import dotenv from "dotenv";
import readline from "readline";
import { SocketConnection } from "./connection/socketConnection";
import { Direction, BotAction } from "./types";
import { GameEngine } from "./game";
import { BombermanAI } from "./ai";

dotenv.config();

/**
 * Manual keyboard control for debugging the bot on real server
 * Press arrow keys or WASD to move, Space to bomb
 * Press 'M' to toggle between Manual and Auto (AI) mode
 */
export class ManualBotControl {
  private readonly socketConnection: SocketConnection;
  private readonly gameEngine: GameEngine;
  private readonly ai: BombermanAI;
  private isRunning = false;
  private currentDirection: Direction | null = null;
  private isManualMode = true; // Start in manual mode
  private botLogicInterval?: NodeJS.Timeout;
  private readonly BASE_TICK_RATE = 680; // Same as BomberManBot

  constructor(serverAddress?: string, botToken?: string) {
    const address =
      serverAddress ||
      process.env.SOCKET_SERVER ||
      "https://zarena-dev3.zinza.com.vn";
    const token = botToken || process.env.BOT_TOKEN || "";

    console.log(`🎮 Hybrid Bot Control (Manual + AI)`);
    console.log(`📡 Server: ${address}`);
    console.log(`🔑 Token: ${token}`);

    this.socketConnection = new SocketConnection(address, token);
    this.gameEngine = new GameEngine();
    this.ai = new BombermanAI();
  }

  public async initialize(): Promise<void> {
    console.log("🚀 Initializing hybrid control...");

    try {
      await this.connectToServer();
      this.setupKeyboardInput();
      this.setupAILogic();
      this.isRunning = true;

      console.log("\n✅ Hybrid control ready!");
      console.log(`📍 Mode: ${this.isManualMode ? "🎮 MANUAL" : "🤖 AI AUTO"}`);
      this.printInstructions();
    } catch (error) {
      console.error("❌ Error during initialization:", error);
      throw error;
    }
  }

  private async connectToServer(): Promise<void> {
    console.log("🔌 Connecting to server...");

    this.setupEventListeners();
    await this.socketConnection.connect();

    console.log("✅ Connected to server.");
  }

  private setupEventListeners(): void {
    this.socketConnection.onGameData((data) => {
      const myBotInfo = this.socketConnection.getMyBomberInfo();
      if (myBotInfo) {
        this.gameEngine.updateGameState(data, myBotInfo.uid);
      }
    });

    this.socketConnection.onGameStart(() => {
      console.log("\n🎮 GAME STARTED!");
      this.printInstructions();
    });

    this.socketConnection.onGameEnd(() => {
      console.log("\n🏁 GAME ENDED!");
      if (!this.socketConnection.isDevelopment()) {
        this.isRunning = false;
      }
    });

    this.socketConnection.onPositionUpdate((x, y) => {
      console.log(
        `📍 Position: (${x}, ${y}) | Cell: (${Math.floor(x / 40)}, ${Math.floor(
          y / 40
        )})`
      );
      this.gameEngine.updateBotPosition(x, y);
    });

    this.socketConnection.onNewBomb((data) => {
      console.log(`💣 Bomb placed at (${data.x}, ${data.y})`);
      this.gameEngine.addBombRealtime(data);
    });

    this.socketConnection.onBombExplode((data) => {
      console.log(`💥 Bomb exploded at (${data.x}, ${data.y})`);
      this.gameEngine.removeBombRealtime(data);
    });

    this.socketConnection.onChestDestroyed((data) => {
      console.log(`📦 Chest destroyed at (${data.x}, ${data.y})`);
      this.gameEngine.removeChestRealtime(data);
    });

    this.socketConnection.onItemCollected((data) => {
      console.log(`🎁 Item collected at (${data.x}, ${data.y})`);
      this.gameEngine.handleItemCollected(data);
    });

    this.socketConnection.onUserDie((data) => {
      const myBomber = this.socketConnection.getMyBomberInfo();
      if (!myBomber) return;

      if (data.killed.uid === myBomber.uid) {
        console.log("\n💀 YOU DIED!");
        this.isRunning = false;
      } else if (data.killer.uid === myBomber.uid) {
        console.log(
          `\n🎉 YOU ELIMINATED ${data.killed.name}! +${data.score} points`
        );
      }
    });
  }

  private setupAILogic(): void {
    // AI logic runs every 680ms (same as BomberManBot)
    this.botLogicInterval = setInterval(() => {
      if (
        !this.isManualMode &&
        this.isRunning &&
        this.socketConnection.isGameRunning()
      ) {
        this.executeAILogic();
      }
    }, this.BASE_TICK_RATE);

    console.log("✅ AI logic initialized (will activate in AUTO mode)");
  }

  private executeAILogic(): void {
    try {
      const currentBot = this.socketConnection.getMyBomberInfo();
      const gameState = this.gameEngine.getGameState();

      if (!currentBot) {
        return;
      }

      console.log("\n🤖 [AI] Making decision...");

      // Use the same AI decision making as BomberManBot
      const decision = this.ai.makeDecision(gameState);

      console.log(`🤖 [AI] Action: ${decision.action} - ${decision.reason}`);

      // Execute AI decision
      switch (decision.action) {
        case BotAction.MOVE:
          if (decision.direction) {
            console.log(`🤖 [AI] Moving ${decision.direction}`);
            this.socketConnection.startContinuousMove(decision.direction);
          }
          break;

        case BotAction.BOMB:
          console.log(`🤖 [AI] Placing bomb`);
          this.socketConnection.placeBomb();
          break;

        case BotAction.STOP:
        default:
          console.log(`🤖 [AI] Stopping`);
          this.socketConnection.stopContinuousMove();
          break;
      }
    } catch (err) {
      console.error("❌ [AI] Error in AI logic:", err);
    }
  }

  private setupKeyboardInput(): void {
    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
    }

    process.stdin.on("keypress", (str, key) => {
      if (!this.isRunning || !this.socketConnection.isGameRunning()) {
        return;
      }

      // Exit on Ctrl+C
      if (key.ctrl && key.name === "c") {
        this.shutdown();
        return;
      }

      this.handleKeyPress(key.name);
    });
  }

  private handleKeyPress(keyName: string): void {
    switch (keyName) {
      // Movement keys
      case "up":
      case "w":
        this.move(Direction.UP);
        break;
      case "down":
      case "s":
        this.move(Direction.DOWN);
        break;
      case "left":
      case "a":
        this.move(Direction.LEFT);
        break;
      case "right":
      case "d":
        this.move(Direction.RIGHT);
        break;

      // Place bomb
      case "space":
      case "b":
        this.placeBomb();
        break;

      // Stop movement
      case "x":
      case "return":
        this.stop();
        break;

      // Print status
      case "i":
        this.printStatus();
        break;

      // Print help
      case "h":
        this.printInstructions();
        break;

      // Toggle Manual/Auto mode
      case "m":
        this.toggleMode();
        break;

      // Continuous movement toggle
      case "c":
        this.toggleContinuousMove();
        break;

      default:
        // Ignore unknown keys
        break;
    }
  }

  private move(direction: Direction): void {
    if (!this.isManualMode) {
      console.log("⚠️ Cannot move manually in AUTO mode. Press 'M' to switch.");
      return;
    }
    console.log(`🏃 [MANUAL] Moving ${direction}`);
    this.currentDirection = direction;
    this.socketConnection.startContinuousMove(direction);
  }

  private stop(): void {
    if (!this.isManualMode) {
      console.log("⚠️ In AUTO mode. Press 'M' to switch to MANUAL.");
      return;
    }
    console.log("⏹️ [MANUAL] Stopping movement");
    this.currentDirection = null;
    this.socketConnection.stopContinuousMove();
  }

  private placeBomb(): void {
    if (!this.isManualMode) {
      console.log(
        "⚠️ Cannot place bomb manually in AUTO mode. Press 'M' to switch."
      );
      return;
    }
    console.log("💣 [MANUAL] Placing bomb!");
    this.socketConnection.placeBomb();
  }

  private toggleMode(): void {
    this.isManualMode = !this.isManualMode;

    // Stop any current movement when switching modes
    this.socketConnection.stopContinuousMove();
    this.currentDirection = null;

    const mode = this.isManualMode ? "🎮 MANUAL" : "🤖 AI AUTO";
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔄 Mode switched to: ${mode}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (!this.isManualMode) {
      console.log("🤖 AI is now controlling the bot");
      console.log("📊 AI will make decisions every 680ms");
      console.log("💡 Press 'M' again to take back manual control\n");
    } else {
      console.log("🎮 You are now in control");
      console.log("⌨️  Use arrow keys/WASD to move, Space to bomb\n");
    }
  }

  private toggleContinuousMove(): void {
    if (this.currentDirection) {
      this.stop();
    } else {
      console.log("⚠️ No direction set. Use arrow keys first.");
    }
  }

  private printStatus(): void {
    const bomber = this.socketConnection.getMyBomberInfo();
    const gameState = this.gameEngine.getGameState();

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 BOT STATUS");
    console.log(`📍 Mode: ${this.isManualMode ? "🎮 MANUAL" : "🤖 AI AUTO"}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (bomber) {
      console.log(`🤖 Name: ${bomber.name}`);
      console.log(`📍 Position: (${bomber.x}, ${bomber.y})`);
      console.log(
        `📍 Cell: (${Math.floor(bomber.x / 40)}, ${Math.floor(bomber.y / 40)})`
      );
      console.log(`💣 Bombs: ${bomber.bombCount}`);
      console.log(`🔥 Explosion flameRange: ${bomber.explosionRange}`);
      console.log(
        `⚡ Speed: ${bomber.speed} (Speed Count: ${bomber.speedCount})`
      );
      console.log(`✅ Alive: ${bomber.isAlive}`);
      console.log(`🏆 Score: ${bomber.score}`);
    } else {
      console.log("⚠️ No bot info available");
    }

    console.log(`\n🗺️ MAP INFO:`);
    console.log(`📦 Chests: ${gameState.map.chests.length}`);
    console.log(`🎁 Items: ${gameState.map.items.length}`);
    console.log(`💣 Bombs: ${gameState.map.bombs.length}`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }

  private printInstructions(): void {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⌨️  KEYBOARD CONTROLS");
    console.log(
      `📍 Current Mode: ${this.isManualMode ? "🎮 MANUAL" : "🤖 AI AUTO"}`
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔄 Mode Control:");
    console.log("   M        - Toggle MANUAL/AUTO mode");
    console.log("");
    console.log("🎮 Movement (MANUAL mode only):");
    console.log("   ↑/W      - Move UP");
    console.log("   ↓/S      - Move DOWN");
    console.log("   ←/A      - Move LEFT");
    console.log("   →/D      - Move RIGHT");
    console.log("   X/Enter  - STOP movement");
    console.log("");
    console.log("💣 Actions (MANUAL mode only):");
    console.log("   Space/B  - Place BOMB");
    console.log("");
    console.log("ℹ️  Info:");
    console.log("   I        - Print STATUS");
    console.log("   H        - Print HELP");
    console.log("   Ctrl+C   - EXIT");
    console.log("");
    console.log("💡 Tip: Press 'M' to let AI take control!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }

  public shutdown(): void {
    console.log("\n🛑 Shutting down...");
    this.isRunning = false;

    if (this.botLogicInterval) {
      clearInterval(this.botLogicInterval);
    }

    this.socketConnection.stopContinuousMove();
    this.socketConnection.disconnect();

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    console.log("✅ Shutdown complete.");
    process.exit(0);
  }

  public getSocketConnection(): SocketConnection {
    return this.socketConnection;
  }

  public getGameEngine(): GameEngine {
    return this.gameEngine;
  }
}

// Main entry point
async function main() {
  console.log("🎮 Bomberman Hybrid Control - Zinza Hackathon 2025");
  console.log("🔄 Switch between MANUAL (keyboard) and AUTO (AI) modes");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const controller = new ManualBotControl();

  const shutdown = () => {
    controller.shutdown();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    await controller.initialize();
  } catch (error) {
    console.error("❌ Initialization error:", error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });
}

export default ManualBotControl;
