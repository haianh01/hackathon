import { BombermanAI } from "./ai";
import { GameEngine } from "./game";
import {
  BotDecision,
  BotAction,
  UserResponse,
  Position,
  Direction,
  GameState,
  BombExplodeEvent,
} from "./types";
import { SocketConnection } from "./connection/socketConnection";
import { getDirectionToTarget } from "./utils/position";
import { CELL_SIZE, isPositionInDangerZone, pixelToCell } from "./utils";
import { getDistance } from "./utils/coordinates";
import { isBotFullyInCell } from "./utils/gameLogic";

const CONFIG = {
  BOT_LOGIC_INTERVAL: 300,
  BOMB_PLACED_DISTANCE: 5,
  BOMB_SAFETY_MARGIN: 80,
  PLAYER_REACH_THRESHOLD: CELL_SIZE / 2,
  EMERGENCY_CLEAR_COOLDOWN_MS: 500,
  REACH_MARGIN_PIXELS: 8,
  WAYPOINT_ADVANCE_THRESHOLD: 2,
  FINAL_TARGET_THRESHOLD: 2,
  MOVE_INTERVAL_MS: 17,
  MOVE_STEP_SIZE: 1,
  MIN_LOGIC_DELAY: 50,

  PATH_REVALIDATE_INTERVAL: 1000,
  OBSTACLE_CHECK_DISTANCE: CELL_SIZE * 2,
  PREDICTION_STEPS: 3,
  STUCK_DETECTION_THRESHOLD: 200,
  STUCK_DISTANCE_THRESHOLD: 2,

  CELL_SIZE_PX: 40,
  BOT_SIZE_PX: 35,
  WAYPOINT_REACHED_THRESHOLD: 10, // ✅ Trong vòng 10px = đã đến waypoint

  MAX_STUCK_TICKS: 5,
} as const;

interface PathState {
  currentPath: Position[] | null;
  currentWaypointIndex: number; // ✅ NEW: Index của waypoint đang đi đến
  pathTarget: Position | null;
  pathCreatedAt: number;
  lastValidatedAt: number;
  waypointReachedFlag?: boolean;
  targetPixelPosition: Position | null;
  isMovingToWaypoint: boolean;

  stuckTicks: number;
  lastPixelPosition: Position | null;
}

interface MovementState {
  lastPosition: Position | null;
  lastPositionTime: number;
  currentDirection: Direction | null;
  isStuck: boolean;
  stuckCounter: number;
}

interface EmergencyState {
  escapePath: Position[] | null;
  escapeTarget: Position | null;
  lastClearedAt: number | null;
}

interface BombState {
  lastBombCount: number;
  pendingPredicted: Position | null;
  isWaitingForOwn: boolean;
}

/**
 * ⭐ Bot with Waypoint Index Approach
 *
 * Key improvements:
 * - Track which waypoint we're moving to (currentWaypointIndex)
 * - Never go backwards in the path
 * - Clear and easy to debug
 * - Works perfectly with cell centers from pathfinding
 */
export class BomberManBot {
  private readonly ai: BombermanAI;
  private readonly gameEngine: GameEngine;
  private readonly socketConnection: SocketConnection;

  private isRunning = false;
  private isExecuting = false;
  private botLogicTimeout: NodeJS.Timeout | undefined;
  private nextLogicDelay: number = CONFIG.BOT_LOGIC_INTERVAL;

  private eventQueue: Array<() => void> = [];

  private pathState: PathState = {
    currentPath: null,
    currentWaypointIndex: 0,
    pathTarget: null,
    pathCreatedAt: 0,
    lastValidatedAt: 0,
    targetPixelPosition: null,
    isMovingToWaypoint: false,
    stuckTicks: 0,
    lastPixelPosition: null,
  };

  private movementState: MovementState = {
    lastPosition: null,
    lastPositionTime: 0,
    currentDirection: null,
    isStuck: false,
    stuckCounter: 0,
  };

  private emergencyState: EmergencyState = {
    escapePath: null,
    escapeTarget: null,
    lastClearedAt: null,
  };

  private bombState: BombState = {
    lastBombCount: 0,
    pendingPredicted: null,
    isWaitingForOwn: false,
  };

  constructor(serverAddress?: string, botToken?: string) {
    this.ai = new BombermanAI();
    this.gameEngine = new GameEngine();

    const address = serverAddress || "https://zarena-dev4.zinza.com.vn";
    const token = botToken || process.env.BOT_TOKEN || "";

    this.socketConnection = new SocketConnection(address, token);
  }

  public async initialize(): Promise<void> {
    console.log("🚀 Initializing Bomberman Bot (Waypoint Index Approach)...");

    try {
      await this.connectToServer();
      console.log("✅ Bot đã sẵn sàng!");

      this.isRunning = true;
      this.setupBotLogic();
    } catch (error) {
      console.error("❌ Error during bot initialization:", error);
      throw error;
    }
  }

  private async connectToServer(): Promise<void> {
    console.log("🔌 Connecting to server...");

    this.setupEventListeners();
    this.setupRealtimeEventCallbacks();

    await this.socketConnection.connect();
    console.log("🔌 Connected to server.");
  }

  private setupEventListeners(): void {
    this.socketConnection.onGameData((data) => this.processGameData(data));
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
  }

  private setupRealtimeEventCallbacks(): void {
    this.socketConnection.onNewBomb((data) => {
      console.log(`⚡ New bomb at (${data.x}, ${data.y}) ID: ${data.id}`);
      this.handleNewBomb(data);
    });

    this.socketConnection.onBombExplode((data) => {
      console.log(`💥 Bomb exploded at (${data.x}, ${data.y})`);
      this.handleBombExplode(data);
    });

    this.socketConnection.onPositionUpdate((x, y) => {
      console.log(`💣bot(${x},${y}`);

      this.gameEngine.updateBotPosition(x, y);
      this.checkCellReached({ x, y });

      this.eventQueue.push(() => {
        this.checkStuckState({ x, y });
      });
    });

    this.socketConnection.onChestDestroyed((data) => {
      this.eventQueue.push(() => {
        console.log(`📦 Chest destroyed at (${data.x}, ${data.y})`);
        this.gameEngine.removeChestRealtime(data);
      });
    });

    this.socketConnection.onItemCollected((data) => {
      this.eventQueue.push(() => {
        console.log(`🎁 Item collected at (${data.x}, ${data.y})`);
        this.gameEngine.handleItemCollected(data);
      });
    });

    this.socketConnection.onUserDie((data) => {
      this.eventQueue.push(() => {
        const myBomber = this.socketConnection.getMyBomberInfo();
        if (!myBomber) return;

        if (data.killed.uid === myBomber.uid) {
          console.log("💀 Bot has been eliminated!");
          this.isRunning = false;
        } else if (data.killer.uid === myBomber.uid) {
          console.log(`🎉 Bot eliminated ${data.killed.name}! +${data.score}`);
        }
      });
    });
  }

  setupBotLogic() {
    console.log("✅ Waypoint-based bot logic initialized.");
    this.nextLogicDelay = CONFIG.BOT_LOGIC_INTERVAL;
    this.tick();
  }

  private tick() {
    try {
      // Clear previous timeout
      if (this.botLogicTimeout) {
        clearTimeout(this.botLogicTimeout);
      }

      // ✅ Check running state FIRST
      if (!this.isRunning) {
        console.log("⏸️ Bot stopped, tick exiting");
        return;
      }

      // ✅ Re-entrance guard
      if (this.isExecuting) {
        console.log("⚠️ Tick already executing, rescheduling");
        this.botLogicTimeout = setTimeout(
          () => this.tick(),
          this.nextLogicDelay || CONFIG.BOT_LOGIC_INTERVAL
        );
        return;
      }

      this.isExecuting = true;

      // ✅ Handle flags FIRST
      if (this.pathState.waypointReachedFlag) {
        this.pathState.currentWaypointIndex++;
        this.pathState.targetPixelPosition = null;
        this.pathState.isMovingToWaypoint = false;
        this.pathState.waypointReachedFlag = false;

        console.log("🔄 Waypoint completed, recalculating...");
      }

      // ✅ Process queue with limit
      const MAX_EVENTS_PER_TICK = 100;
      let processedEvents = 0;

      while (
        this.eventQueue.length > 0 &&
        processedEvents < MAX_EVENTS_PER_TICK
      ) {
        const event = this.eventQueue.shift();
        if (event) {
          event();
          processedEvents++;
        }
      }

      if (this.eventQueue.length > 0) {
        console.warn(
          `⚠️ Event queue still has ${this.eventQueue.length} pending events`
        );
      }

      // ✅ Execute bot logic
      this.executeBotLogic();
    } catch (error) {
      console.error("❌ Critical error in tick loop:", error);
      // Emergency cleanup
      this.socketConnection.stopContinuousMove();
      this.clearPath();
    } finally {
      // ✅ ALWAYS unlock (even on error)
      this.isExecuting = false;

      // ✅ Schedule next tick
      if (this.isRunning) {
        const delay = this.nextLogicDelay || CONFIG.BOT_LOGIC_INTERVAL;
        this.botLogicTimeout = setTimeout(() => this.tick(), delay);

        // Reset for next cycle
        this.nextLogicDelay = CONFIG.BOT_LOGIC_INTERVAL;
      }
    }
  }

  /**
   * ✅ Check if bot is stuck
   */
  private checkStuckState(currentPos: Position): void {
    if (!this.pathState.isMovingToWaypoint) {
      this.pathState.stuckTicks = 0;
      this.pathState.lastPixelPosition = null;
      return;
    }

    const lastPos = this.pathState.lastPixelPosition;

    if (!lastPos) {
      this.pathState.lastPixelPosition = { ...currentPos };
      return;
    }

    const distance = getDistance(lastPos, currentPos);

    if (distance < 1) {
      this.pathState.stuckTicks++;

      if (this.pathState.stuckTicks >= CONFIG.MAX_STUCK_TICKS) {
        console.error(
          `❌ Bot STUCK for ${this.pathState.stuckTicks} ticks at (${currentPos.x}, ${currentPos.y})`
        );
        console.error(
          `   Target waypoint: (${this.pathState.targetPixelPosition?.x}, ${this.pathState.targetPixelPosition?.y})`
        );

        // Force recalculation
        this.socketConnection.stopContinuousMove();
        this.clearPath();

        console.log("🔄 Forcing recalculation due to stuck state");
      }
    } else {
      // Moving normally, reset counter
      this.pathState.stuckTicks = 0;
      this.pathState.lastPixelPosition = { ...currentPos };
    }
  }

  /**
   * ✅ Execute bot logic
   */
  private executeBotLogic(): void {
    if (!this.isRunning) {
      return;
    }

    const currentBot = this.gameEngine.getCurrentBot();
    if (!currentBot) {
      console.warn("⚠️ No bot found");
      return;
    }

    const gameState = this.gameEngine.getGameState();

    // Priority 1: Danger zone
    if (isPositionInDangerZone(currentBot.position, gameState)) {
      console.log("🚨 DANGER ZONE!");
      this.checkImmediateThreat();
      return;
    }

    // Priority 2: Continue to waypoint if already moving
    if (
      this.pathState.isMovingToWaypoint &&
      this.pathState.targetPixelPosition
    ) {
      // Check if waypoint is still safe
      if (
        !isPositionInDangerZone(this.pathState.targetPixelPosition, gameState)
      ) {
        console.log("⚠️ Waypoint threatened! Recalculating...");
        this.socketConnection.stopContinuousMove();
        this.clearPath();
      } else {
        const target = this.pathState.targetPixelPosition;
        console.log(
          `🏃 Continue to waypoint [${this.pathState.currentWaypointIndex}]: (${target.x}, ${target.y})`
        );
        return;
      }
    }

    // Priority 3: Calculate next waypoint
    this.calculateNextWaypointMove(currentBot.position, gameState);
  }

  /**
   * ⭐ Calculate and move to next waypoint
   *
   * This is the CORE logic for waypoint-based movement
   */
  private calculateNextWaypointMove(
    currentBot: Position,
    gameState: GameState
  ): void {
    console.log("🧠 Calculating next waypoint...");

    const decision = this.ai.makeDecision(gameState);

    if (!decision || !decision.target) {
      console.log("❌ No decision from AI");
      return;
    }

    const fullPath = decision.path;
    if (!fullPath) {
      console.log("❌ No path from AI");
      this.handleEndOfPath(decision);

      return;
    }

    // ✅ Check if this is a new path
    const isNewPath = this.isNewPath(fullPath);

    if (isNewPath) {
      console.log(`🗺️ New path received: ${fullPath.length} waypoints`);
      console.log(
        `   Path: ${fullPath.map((p) => `(${p.x},${p.y})`).join(" → ")}`
      );

      // Reset waypoint index for new path
      this.pathState.currentPath = fullPath;
      this.pathState.currentWaypointIndex = 0;
      this.pathState.pathTarget = decision.target;
      this.pathState.pathCreatedAt = Date.now();
    }

    // ✅ Get next waypoint index
    const nextWaypointIndex = this.pathState.currentWaypointIndex;

    if (nextWaypointIndex >= fullPath.length) {
      console.log("✅ Reached end of path!");
      this.handleEndOfPath(decision);
      return;
    }

    const nextWaypoint = fullPath[nextWaypointIndex];

    // ✅ Check if already in this cell
    const nextCell = fullPath[nextWaypointIndex];
    const isFullyIn = isBotFullyInCell(currentBot, nextCell!);

    if (isFullyIn) {
      console.log(
        `✅ Already in cell [${nextCell!.x}, ${nextCell!.y}], moving to next`
      );
      this.pathState.currentWaypointIndex++;
      this.handleEndOfPath(decision);

      return;
    }

    // ✅ Check if waypoint is safe
    if (isPositionInDangerZone(nextWaypoint!, gameState)) {
      console.log(`⚠️ Waypoint [${nextWaypointIndex}] is threatened!`);
      this.clearPath();
      return;
    }

    // ✅ Set target and move
    console.log(
      `➡️ Moving to waypoint [${nextWaypointIndex}]: (${nextWaypoint!.x}, ${
        nextWaypoint!.y
      }) `
    );

    this.pathState.targetPixelPosition = nextWaypoint!;
    this.pathState.isMovingToWaypoint = true;

    // Execute move
    const moveDecision = {
      action: decision.action,
      target: nextWaypoint,
      reason: `Waypoint [${nextWaypointIndex}/${fullPath.length - 1}]`,
      path: [currentBot, nextWaypoint!],
      priority: 1000,
    } as BotDecision;

    this.executeAction(moveDecision);
  }

  /**
   * ✅ Check if path is new (different from current)
   */
  private isNewPath(newPath: Position[]): boolean {
    if (!this.pathState.currentPath) return true;

    const currentPath = this.pathState.currentPath;

    // Different length = different path
    if (currentPath.length !== newPath.length) return true;

    // Check if first or last waypoint is different
    const firstDifferent =
      currentPath![0]!.x !== newPath[0]!.x ||
      currentPath[0]!.y !== newPath[0]!.y;

    const lastDifferent =
      currentPath[currentPath.length - 1]!.x !==
        newPath![newPath!.length! - 1]!.x ||
      currentPath[currentPath.length - 1]!.y !== newPath[newPath.length - 1]!.y;

    return firstDifferent || lastDifferent;
  }

  /**
   * ✅ Handle when reaching end of path
   */
  private handleEndOfPath(decision: BotDecision): void {
    console.log(`📍 Reached end of path. Action: ${decision.action}`);

    // ✅ Check if should place bomb
    if (decision.action === BotAction.BOMB) {
      console.log("💣 End of path - placing bomb");
      this.handlePlaceBomb(decision);
      return;
    }

    // ✅ Check if at bomb target
    const currentBot = this.gameEngine.getCurrentBot();
    if (currentBot && decision.target) {
      const distance = getDistance(currentBot.position, decision.target);

      if (distance <= 20) {
        console.log("💣 At bomb target - placing bomb");
        this.handlePlaceBomb(decision);
        return;
      }
    }

    console.log("✅ Path completed, no bomb action");
    this.clearPath();
  }

  /**
   * ✅ Execute action
   */
  private executeAction(decision: BotDecision): void {
    switch (decision.action) {
      case "MOVE":
        this.handleMove(decision);
        break;
      case "BOMB":
        this.handlePlaceBomb(decision);
        break;
      case "STOP":
        console.log("⏸️ No action");
        break;
      default:
        console.warn(`⚠️ Unknown action: ${decision.action}`);
    }
  }

  private handleMove(decision: BotDecision): void {
    if (!decision.target) {
      console.warn("⚠️ Move without target");
      return;
    }

    const currentBot = this.gameEngine.getCurrentBot();
    if (!currentBot) return;

    const direction = getDirectionToTarget(
      currentBot.position,
      decision.target
    );

    if (direction) {
      console.log(`🏃 Moving ${direction}`);
      this.socketConnection.startContinuousMove(direction);
      this.movementState.currentDirection = direction;
    } else {
      console.log("✅ At target");
    }
  }

  private handlePlaceBomb(decision: BotDecision): void {
    const currentBot = this.gameEngine.getCurrentBot();
    if (!currentBot) return;

    const canPlaceBomb =
      currentBot.bombCount > 0 && !this.bombState.isWaitingForOwn;

    if (!canPlaceBomb) {
      console.log("⏳ Cannot place bomb (no bombs available or waiting)");
      return;
    }

    console.log(
      `💣 Placing bomb at (${currentBot.position.x}, ${currentBot.position.y})`
    );

    this.socketConnection.placeBomb();

    this.bombState.isWaitingForOwn = true;
    this.bombState.lastBombCount = currentBot.bombCount;

    // Clear path after placing bomb
    this.socketConnection.stopContinuousMove();
    this.clearPath();
  }

  private clearPath(): void {
    this.pathState.currentPath = null;
    this.pathState.currentWaypointIndex = 0;
    this.pathState.pathTarget = null;
    this.pathState.pathCreatedAt = 0;
    this.pathState.lastValidatedAt = 0;
    this.pathState.targetPixelPosition = null;
    this.pathState.isMovingToWaypoint = false;

    this.movementState.currentDirection = null;
    this.movementState.isStuck = false;
    this.movementState.stuckCounter = 0;

    this.pathState.stuckTicks = 0;
    this.pathState.lastPixelPosition = null;
  }

  private checkImmediateThreat(): void {
    const currentBot = this.gameEngine.getCurrentBot();
    if (!currentBot) return;

    this.socketConnection.stopContinuousMove();
    this.clearPath();

    const gameState = this.gameEngine.getGameState();
    const escapeDecision = this.ai.makeDecisionEscape(gameState);

    console.log(`🏃 EMERGENCY ESCAPE: ${escapeDecision.reason}`);

    if (escapeDecision.target) {
      this.emergencyState.escapeTarget = escapeDecision.target;
      this.emergencyState.escapePath = escapeDecision.path || [
        currentBot.position,
        escapeDecision.target,
      ];

      console.log(
        `🛤️ Emergency path: ${this.emergencyState.escapePath.length} steps`
      );
    }

    this.executeAction(escapeDecision);
  }

  private checkCellReached(currentPos: Position): void {
    if (
      !this.pathState.isMovingToWaypoint ||
      !this.pathState.targetPixelPosition
    ) {
      return;
    }

    const targetCell = pixelToCell(this.pathState.targetPixelPosition);
    const isFullyIn = isBotFullyInCell(currentPos, targetCell);

    if (isFullyIn) {
      console.log(`✅ Reached cell [${targetCell.x}, ${targetCell.y}]`);

      // ✅ ALWAYS stop when reaching waypoint
      this.socketConnection.stopContinuousMove();

      // ✅ Set flag để tick handle
      this.pathState.waypointReachedFlag = true;

      console.log("🔄 Cell reached, will recalculate on next tick");
    }
  }

  private handleBombExplode(data: BombExplodeEvent): void {
    this.gameEngine.removeBombRealtime(data);

    if (data.uid === this.socketConnection.getMyBomberInfo()?.uid) {
      this.bombState.isWaitingForOwn = false;
      console.log("✅ Own bomb exploded");
    }
  }

  private processGameData(gameData: UserResponse): void {
    try {
      const myBotInfo = this.socketConnection.getMyBomberInfo();
      const socketId = myBotInfo?.uid;

      if (socketId) {
        this.gameEngine.updateGameState(gameData, socketId);
      }
    } catch (error) {
      console.error("❌ Error processing game data:", error);
    }
  }

  private handleNewBomb(data: Position): void {
    this.gameEngine.addBombRealtime(data);
    const currentBot = this.gameEngine.getCurrentBot();
    const gameState = this.gameEngine.getGameState();
    if (currentBot && isPositionInDangerZone(currentBot.position, gameState)) {
      console.log("⚠️ New bomb puts bot in danger!");
    }
  }

  // Public API
  public shutdown(): void {
    console.log("🛑 Shutting down...");
    this.isRunning = false;

    if (this.botLogicTimeout) {
      clearTimeout(this.botLogicTimeout);
      this.botLogicTimeout = undefined;
    }

    this.socketConnection.disconnect();
    console.log("✅ Shutdown complete");
  }

  public stop(): void {
    this.isRunning = false;
    console.log("⏸️ Bot paused");
  }

  public isActive(): boolean {
    return this.isRunning && this.socketConnection.isConnected();
  }

  public isConnected(): boolean {
    return this.socketConnection.isConnected();
  }

  public isGameRunning(): boolean {
    return this.socketConnection.isGameRunning();
  }

  public getBotInfo() {
    return this.socketConnection.getMyBomberInfo();
  }

  public getAIInfo(): Array<{ name: string; priority: number }> {
    return this.ai.getStrategiesInfo();
  }

  public updateStrategyPriority(
    strategyName: string,
    priority: number
  ): boolean {
    const success = this.ai.updateStrategyPriority(strategyName, priority);
    if (success) {
      console.log(`🔄 Strategy '${strategyName}' → ${priority}`);
    } else {
      console.warn(`⚠️ Strategy '${strategyName}' not found`);
    }
    return success;
  }

  public resetAI(): void {
    this.ai.resetStrategies();
    console.log("🔄 AI reset");
  }

  public getGameStats() {
    return this.gameEngine.getGameStats();
  }

  public getGameState() {
    return this.gameEngine.getGameState();
  }
}
