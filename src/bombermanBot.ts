import { BombermanAI } from "./ai";
import { GameEngine } from "./game";
import {
  BotDecision,
  BotAction,
  UserResponse,
  Position,
  Direction,
  Bomber,
  GameState,
  BombExplodeEvent,
} from "./types";
import { SocketConnection } from "./connection/socketConnection";
import { getDirectionToTarget } from "./utils/position";
import { CELL_SIZE, isPositionInDangerZone, pixelToCellCenter } from "./utils";
import {
  getDistance,
  isAtPosition,
  pixelToCellIndex,
} from "./utils/coordinates";

// Configuration constants
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

  // New: Path validation and prediction
  PATH_REVALIDATE_INTERVAL: 1000, // Recheck path every 1s
  OBSTACLE_CHECK_DISTANCE: CELL_SIZE * 2, // Look ahead 2 cells
  PREDICTION_STEPS: 3, // Predict 3 steps ahead
  STUCK_DETECTION_THRESHOLD: 200, // 200ms without progress = stuck
  STUCK_DISTANCE_THRESHOLD: 2, // Less than 2px movement = stuck
} as const;

interface PathState {
  currentPath: Position[] | null;
  currentPathIndex: number;
  pathTarget: Position | null;
  pathCreatedAt: number; // Timestamp for path age tracking
  lastValidatedAt: number; // Last time path was validated
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
 * Main Bot class - optimized for performance and maintainability
 */
export class BomberManBot {
  private readonly ai: BombermanAI;
  private readonly gameEngine: GameEngine;
  private readonly socketConnection: SocketConnection;

  private isRunning = false;
  private isExecuting = false;
  private botLogicTimeout: NodeJS.Timeout | undefined;
  private nextLogicDelay: number = CONFIG.BOT_LOGIC_INTERVAL;
  private readonly BASE_TICK_RATE = 300; // Fixed base rate

  private eventQueue: Array<() => void> = [];
  // State management - grouped for better cache locality
  private pathState: PathState = {
    currentPath: null,
    currentPathIndex: 0,
    pathTarget: null,
    pathCreatedAt: 0,
    lastValidatedAt: 0,
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

  private currentPlan: {
    phase: "MOVING_TO_TARGET";
    path: Position[];
    bombPosition: Position;
    targetChests: number;
    plannedAt: number;
  } | null = null;

  constructor(serverAddress?: string, botToken?: string) {
    this.ai = new BombermanAI();
    this.gameEngine = new GameEngine();

    const address = serverAddress || "https://zarena-dev4.zinza.com.vn";
    const token = botToken || process.env.BOT_TOKEN || "";

    this.socketConnection = new SocketConnection(address, token);
  }

  public async initialize(): Promise<void> {
    console.log("🚀 Initializing Bomberman Bot...");

    try {
      await this.connectToServer();
      console.log("✅ Bot đã sẵn sàng!");

      this.isRunning = true; // Set BEFORE setupBotLogic so tick() sees it
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
    this.socketConnection.onPositionUpdate((x, y) => {
      this.eventQueue.push(() => {
        console.log("   → Updating bot position");
        console.log(
          `📍 Position updated: (${x}, ${y}), Cell: (${Math.floor(
            x / 40
          )}, ${Math.floor(y / 40)})`
        );
        this.gameEngine.updateBotPosition(x, y);
      });
    });
  }

  private setupRealtimeEventCallbacks(): void {
    this.socketConnection.onNewBomb((data) => {
      this.eventQueue.push(() => {
        console.log("   → Processing bomb threat");
        console.log(`⚡ New bomb at (${data.x}, ${data.y}) ID: ${data.id}`);
        this.handleNewBomb(data);
      });
    });

    this.socketConnection.onBombExplode((data) => {
      this.eventQueue.push(() => {
        // <--- Đưa vào hàng đợi
        console.log(`⚡ Bomb exploded at (${data.x}, ${data.y})`);
        this.handleBombExplode(data);
      });
    });

    this.socketConnection.onChestDestroyed((data) => {
      console.log(`⚡ Chest destroyed at (${data.x}, ${data.y})`);
      this.gameEngine.removeChestRealtime(data);
    });

    this.socketConnection.onItemCollected((data) => {
      console.log(`⚡ Item collected at (${data.x}, ${data.y})`);
      this.gameEngine.handleItemCollected(data);
    });

    this.socketConnection.onUserDie((data) => {
      const myBomber = this.socketConnection.getMyBomberInfo();
      if (!myBomber) return;

      if (data.killed.uid === myBomber.uid) {
        console.log("💀 Bot has been eliminated!");
        this.isRunning = false;
      } else if (data.killer.uid === myBomber.uid) {
        console.log(`🎉 Bot eliminated ${data.killed.name}! +${data.score}`);
      }
    });
  }

  setupBotLogic() {
    console.log("✅ Event-driven bot logic initialized with dynamic delay.");
    // Reset delay to default and start the first tick.
    this.nextLogicDelay = CONFIG.BOT_LOGIC_INTERVAL;
    this.tick();
  }

  private tick() {
    // Clear any pending timeout to ensure this tick runs now and prevents duplicates.
    if (this.botLogicTimeout) {
      clearTimeout(this.botLogicTimeout);
    }

    // If the previous tick is somehow still running, reschedule and exit.
    if (this.isExecuting) {
      if (this.isRunning) {
        this.botLogicTimeout = setTimeout(
          () => this.tick(),
          this.nextLogicDelay
        );
      }
      return;
    }

    this.isExecuting = true;

    // ✅ Process any pending events first
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        console.log("📨 Processing queued event");
        event();
      }
    }

    // Set a default delay for the next tick. This can be overridden by
    // calculateDynamicDelay during the execution of the bot's logic.
    this.nextLogicDelay = CONFIG.BOT_LOGIC_INTERVAL;

    // ✅ Then run normal bot logic
    this.executeBotLogic();

    this.isExecuting = false;

    // ✅ Schedule the next tick using the (potentially dynamic) delay
    if (this.isRunning) {
      this.botLogicTimeout = setTimeout(() => this.tick(), this.nextLogicDelay);
    }
  }

  private executeBotLogic(): void {
    // tick() already handles isExecuting flag, just check game state
    if (!this.socketConnection.isGameRunning() || !this.isRunning) {
      return;
    }

    try {
      console.log("🤖 Executing bot logic...");

      const currentBot = this.socketConnection.getMyBomberInfo();
      const gameState = this.gameEngine.getGameState();

      // Priority 1: Handle emergency escape
      if (this.handleEmergencyEscape(currentBot!, gameState)) {
        return;
      }

      // Priority 2: Handle waiting for own bomb
      if (this.bombState.isWaitingForOwn) {
        console.log("⏳ Waiting for own bomb to explode.");
        const defensiveDecision = this.ai.makeDefensiveDecision(gameState);
        this.executeAction(defensiveDecision);
        return;
      }

      // Priority 3: Normal path execution
      this.handleNormalPathExecution(currentBot!, gameState);
    } catch (err) {
      console.error("❌ Error in bot logic:", err);
    }
  }

  private handleEmergencyEscape(
    currentBot: Bomber,
    gameState: GameState
  ): boolean {
    const { escapePath, escapeTarget } = this.emergencyState;

    if (!escapePath || !escapeTarget || !currentBot) {
      return false;
    }

    const isCurrentlySafe = !isPositionInDangerZone(currentBot, gameState);
    const distanceToEscapeTarget = getDistance(currentBot, escapeTarget);

    if (
      isCurrentlySafe &&
      distanceToEscapeTarget < CONFIG.FINAL_TARGET_THRESHOLD
    ) {
      console.log("✅ Bot is safe. Clearing emergency state.");
      this.clearEmergencyState();
      this.socketConnection.stopContinuousMove();
      this.clearPath();
      this.emergencyState.lastClearedAt = Date.now();
      return false;
    }

    console.warn("🏃 Still in danger. Recomputing escape path.");
    this.bombState.lastBombCount = gameState.map.bombs.length;

    const reDecision = this.ai.makeDecisionEscape(gameState);

    if (reDecision.action === BotAction.MOVE && reDecision.target) {
      this.emergencyState.escapeTarget = reDecision.target;
      this.emergencyState.escapePath = reDecision.path || [
        currentBot,
        reDecision.target,
      ];
      this.executeAction(reDecision);
    } else {
      console.error("❌ No escape path found! Stopping.");
      this.executeAction({
        action: BotAction.STOP,
        reason: "No escape path found",
      } as any);
    }

    return true;
  }

  private handleNormalPathExecution(
    currentBot: Bomber,
    gameState: GameState
  ): void {
    const { lastClearedAt } = this.emergencyState;

    if (
      lastClearedAt &&
      Date.now() - lastClearedAt < CONFIG.EMERGENCY_CLEAR_COOLDOWN_MS
    ) {
      console.log(
        `⏳ Emergency cooldown active (${Date.now() - lastClearedAt}ms)`
      );
      return;
    }

    this.bombState.lastBombCount = gameState.map.bombs.length;

    // If we don't have current bot info yet, skip path handling for now
    if (!currentBot) {
      return;
    }

    // Update movement tracking
    this.updateMovementTracking(currentBot);

    if (this.pathState.currentPath?.length && currentBot) {
      // Check if path needs revalidation
      if (this.shouldRevalidatePath(gameState)) {
        console.log("🔄 Path revalidation needed");
        this.clearPath();
        // Let next tick create new path
        return;
      }

      // Check if stuck
      if (this.detectStuckState()) {
        console.warn("⚠️ Stuck detected! Forcing path recalculation");
        this.clearPath();
        this.socketConnection.stopContinuousMove();
        return;
      }

      const finalTarget =
        this.pathState.pathTarget ??
        this.pathState.currentPath[this.pathState.currentPath.length - 1];

      if (
        finalTarget &&
        isAtPosition(currentBot, finalTarget, CONFIG.FINAL_TARGET_THRESHOLD)
      ) {
        console.log("✅ Reached final target. Clearing path.");
        this.clearPath();
        this.socketConnection.stopContinuousMove();
        return;
      }

      console.log("Path in progress, continuing...");
      const continueDecision: BotDecision = {
        action: BotAction.MOVE,
        path: this.pathState.currentPath,
        target: this.pathState.pathTarget,
        reason: "Continuing existing path",
      } as BotDecision;
      this.followPath(continueDecision);
    } else {
      (gameState as any).bombermanCurrentPlan = this.currentPlan;
      const decision = this.ai.makeDecision(gameState);
      this.executeAction(decision);
    }
  }

  private executeAction(decision: BotDecision): void {
    console.log(
      `🤖 Action: ${decision.action} - ${decision.reason} (Priority: ${decision.priority})`
    );

    switch (decision.action) {
      case BotAction.MOVE:
        this.handleMoveAction(decision);
        break;

      case BotAction.BOMB:
        this.handleBombAction();
        break;

      case BotAction.STOP:
      default:
        this.clearPath();
        this.socketConnection.stopContinuousMove();
        break;
    }
  }

  private handleMoveAction(decision: BotDecision): void {
    if (decision.path?.length! > 1) {
      this.followPath(decision);
    } else if (decision.target && decision.direction) {
      this.followNextStep(decision);
    } else if (decision.direction) {
      this.clearPath();
      this.socketConnection.startContinuousMove(decision.direction);
    }
  }

  private handleBombAction(): void {
    this.clearPath();
    this.socketConnection.stopContinuousMove();
    this.socketConnection.placeBomb();

    const currentBot = this.gameEngine.getCurrentBot();
    if (!currentBot) return;

    const snappedBombPos = pixelToCellCenter(currentBot.position);

    // Check for duplicate prediction
    if (
      this.bombState.pendingPredicted &&
      getDistance(this.bombState.pendingPredicted, snappedBombPos) < 10
    ) {
      console.warn("⏩ Skipping duplicate bomb prediction.");
      return;
    }

    this.ai.markBombPlaced(snappedBombPos);
    this.bombState.pendingPredicted = snappedBombPos;

    const predictedBomb = {
      x: snappedBombPos.x,
      y: snappedBombPos.y,
      flameRange: currentBot.flameRange || 2,
      id: `predicted-${snappedBombPos.x}-${snappedBombPos.y}`,
      ownerId: currentBot.id,
    };

    this.gameEngine.addBombRealtime(predictedBomb);
    this.checkImmediateThreat(predictedBomb);

    if (currentBot.bombCount <= 1) {
      this.bombState.isWaitingForOwn = true;
      console.log("⏳ No more bombs, waiting for explosion.");
    }
  }

  private followPath(decision: BotDecision): void {
    const currentBot = this.gameEngine.getCurrentBot();
    if (!currentBot || !decision.path || decision.path.length <= 1) {
      return;
    }

    const isNewPath = this.isNewPath(decision);

    if (isNewPath) {
      console.log(
        `🛤️ New path: ${decision.path.length} steps to (${decision.target?.x}, ${decision.target?.y})`
      );
      const now = Date.now();
      this.pathState.currentPath = decision.path;
      this.pathState.currentPathIndex = 0;
      this.pathState.pathTarget = decision.target || null;
      this.pathState.pathCreatedAt = now;
      this.pathState.lastValidatedAt = now;

      // Reset stuck detection on new path
      this.movementState.isStuck = false;
      this.movementState.stuckCounter = 0;
    }

    const currentPos = currentBot.position;
    let currentIndex = this.pathState.currentPathIndex;

    // CRITICAL FIX: Skip first waypoint if it's the starting position or too far
    if (currentIndex === 0 && this.pathState.currentPath!.length > 1) {
      const firstWaypoint = this.pathState.currentPath![0]!;

      const distToFirst = getDistance(currentPos, firstWaypoint);

      if (distToFirst < CONFIG.FINAL_TARGET_THRESHOLD) {
        console.log(
          `⏭️ Skipping waypoint 1 (dist: ${distToFirst.toFixed(
            1
          )}px) -> targeting waypoint 2`
        );
        currentIndex = 1;
        this.pathState.currentPathIndex = 1;
      }
    }
    // Nếu không, closestIndex vẫn là this.currentPathIndex, bot sẽ tiếp tục
    // di chuyển về waypoint hiện tại.

    // Advance through reached waypoints
    currentIndex = this.advanceWaypoints(currentPos, currentIndex);

    if (currentIndex !== this.pathState.currentPathIndex) {
      this.pathState.currentPathIndex = currentIndex;
    }

    const targetWaypoint = this.pathState.currentPath![currentIndex];
    console.log(
      "%c🤪 ~ file: bombermanBot.ts:518 [] -> targetWaypoint : ",
      "color: #85f96c",
      targetWaypoint,
      currentPos
    );
    if (!targetWaypoint) {
      console.log(`⚠️ No target waypoint at index ${currentIndex}`);
      this.clearPath();
      return;
    }

    // --- START OF FIX for stuck-on-escape bug ---
    // The old logic calculated direction based on a "lookahead" target, which caused
    // the bot to cut corners. This is bad when escaping, as the bot might not be
    // in a clear corridor yet.
    // The new logic determines the direction based purely on the current path SEGMENT
    // defined by the waypoints. This forces the bot to move along grid lines.
    const prevWaypoint = this.pathState.currentPath![currentIndex - 1];

    let direction: Direction | undefined;

    // This should not happen due to the waypoint skipping logic at the start of the function,
    // but as a safeguard, we fall back to direct-to-target logic.
    if (!prevWaypoint) {
      console.warn(
        "⚠️ Could not determine path segment. Falling back to direct movement."
      );
      direction = getDirectionToTarget(currentPos, targetWaypoint);
    } else {
      const segmentDx = targetWaypoint.x - prevWaypoint.x;
      const segmentDy = targetWaypoint.y - prevWaypoint.y;

      if (Math.abs(segmentDx) > Math.abs(segmentDy)) {
        // Horizontal segment
        direction = segmentDx > 0 ? Direction.RIGHT : Direction.LEFT;
      } else {
        // Vertical segment
        direction = segmentDy > 0 ? Direction.DOWN : Direction.UP;
      }
    }

    console.log(
      `🔩 Segment Move: ${currentIndex + 1}/${
        this.pathState.currentPath!.length
      }, Pos: (${currentPos.x.toFixed(0)}, ${currentPos.y.toFixed(
        0
      )}), SegDir: ${direction}`
    );
    // --- END OF FIX ---

    // Check if reached final target
    const isAtLastWaypoint =
      currentIndex >= this.pathState.currentPath!.length - 1;
    if (
      isAtLastWaypoint &&
      this.pathState.pathTarget &&
      isAtPosition(
        currentPos,
        this.pathState.pathTarget,
        CONFIG.FINAL_TARGET_THRESHOLD
      )
    ) {
      console.log("✅ Reached final path target");
      this.clearPath();
      this.socketConnection.stopContinuousMove();
      return;
    }

    if (!direction) {
      console.warn("⚠️ Invalid direction calculated, stopping");
      this.socketConnection.stopContinuousMove();
      this.clearPath();
      return;
    }

    // Track direction changes for momentum handling
    // if (this.movementState.currentDirection !== direction) {
    //   console.log(
    //     `🔄 Direction change: ${this.movementState.currentDirection} → ${direction}`
    //   );
    //   this.movementState.currentDirection = direction;
    // }

    this.socketConnection.startContinuousMove(direction);

    // Calculate dynamic delay based on distance to waypoint
    this.calculateDynamicDelay(
      currentPos,
      targetWaypoint,
      currentBot.speed || 1
    );
  }

  private followNextStep(decision: BotDecision): void {
    const currentBot = this.gameEngine.getCurrentBot();

    if (!currentBot || !decision.target || !decision.direction) {
      console.log("⚠️ Missing bot, target, or direction");
      return;
    }

    const currentPos = currentBot.position;
    const nextWaypoint = decision.target;

    if (isAtPosition(currentPos, nextWaypoint, 4)) {
      console.log(
        `✅ Reached next step at (${nextWaypoint.x}, ${nextWaypoint.y})`
      );
      this.socketConnection.stopContinuousMove();
      this.clearPath();
      return;
    }

    const direction = getDirectionToTarget(currentPos, nextWaypoint);
    const distToTarget = getDistance(currentPos, nextWaypoint);

    console.log(
      `🎯 Next step: ${direction}, Distance: ${distToTarget.toFixed(1)}px`
    );

    this.socketConnection.startContinuousMove(direction);
    this.calculateDynamicDelay(currentPos, nextWaypoint, currentBot.speed || 1);

    this.pathState.currentPath = [currentPos, nextWaypoint];
    this.pathState.currentPathIndex = 0;
    this.pathState.pathTarget = nextWaypoint;
  }

  private calculateDynamicDelay(
    from: Position,
    to: Position,
    speed: number
  ): void {
    const distance = getDistance(from, to);
    const effectiveThreshold =
      CONFIG.WAYPOINT_ADVANCE_THRESHOLD + CONFIG.REACH_MARGIN_PIXELS;
    const distanceToThreshold = Math.max(0, distance - effectiveThreshold);

    // Calculate time to reach waypoint threshold
    // Formula: (distance / pixels_per_tick) * ms_per_tick
    const pixelsPerTick = CONFIG.MOVE_STEP_SIZE * speed;
    const timeToThreshold =
      (distanceToThreshold / pixelsPerTick) * CONFIG.MOVE_INTERVAL_MS;

    // Clamp between min delay and max interval
    this.nextLogicDelay = Math.max(
      CONFIG.MIN_LOGIC_DELAY,
      Math.min(timeToThreshold, CONFIG.BOT_LOGIC_INTERVAL)
    );

    console.log(
      `⏱️ Delay: ${this.nextLogicDelay.toFixed(0)}ms | Dist: ${distance.toFixed(
        0
      )}px -> ${distanceToThreshold.toFixed(0)}px to threshold`
    );
  }

  private advanceWaypoints(currentPos: Position, startIndex: number): number {
    if (!this.pathState.currentPath) return startIndex;

    let index = startIndex;
    const pathLength = this.pathState.currentPath.length;

    // Advance through all reached waypoints in one pass
    while (index < pathLength - 1) {
      const waypoint = this.pathState.currentPath[index];
      if (!waypoint) break;

      if (
        !isAtPosition(currentPos, waypoint, CONFIG.WAYPOINT_ADVANCE_THRESHOLD)
      ) {
        break;
      }

      console.log(
        `✓ Waypoint ${index + 1}/${pathLength} at (${waypoint.x}, ${
          waypoint.y
        })`
      );
      index++;
    }

    return index;
  }

  private isNewPath(decision: BotDecision): boolean {
    const { currentPath, pathTarget } = this.pathState;

    if (!currentPath || !pathTarget || !decision.target || !decision.path) {
      return true;
    }

    if (currentPath.length !== decision.path.length) {
      return true;
    }

    const firstWaypoint = decision.path[0];
    const currentFirstWaypoint = currentPath[0];

    return (
      !firstWaypoint ||
      !currentFirstWaypoint ||
      firstWaypoint.x !== currentFirstWaypoint.x ||
      firstWaypoint.y !== currentFirstWaypoint.y
    );
  }

  private clearPath(): void {
    this.pathState.currentPath = null;
    this.pathState.currentPathIndex = 0;
    this.pathState.pathTarget = null;
    this.pathState.pathCreatedAt = 0;
    this.pathState.lastValidatedAt = 0;

    // Reset movement tracking
    this.movementState.currentDirection = null;
    this.movementState.isStuck = false;
    this.movementState.stuckCounter = 0;
  }

  private clearEmergencyState(): void {
    this.emergencyState.escapePath = null;
    this.emergencyState.escapeTarget = null;
  }

  private checkImmediateThreat(bombData: any): void {
    const currentBot = this.gameEngine.getCurrentBot();
    if (!currentBot) return;

    const bombPos = { x: bombData.x, y: bombData.y };
    const bombFlameRange = bombData.flameRange || 2;
    const distance = getDistance(currentBot.position, bombPos);

    const dangerRadius =
      bombFlameRange * CELL_SIZE +
      CONFIG.PLAYER_REACH_THRESHOLD +
      CONFIG.BOMB_SAFETY_MARGIN;

    const isOnBomb = distance < CONFIG.BOMB_PLACED_DISTANCE;

    if (isOnBomb || distance < dangerRadius) {
      if (isOnBomb) {
        console.warn("🚨 JUST PLACED BOMB! Forcing immediate escape!");
      }
      console.warn(
        `🚨 IMMEDIATE THREAT! Bomb ${distance.toFixed(
          0
        )}px away (threshold: ${dangerRadius}px)`
      );

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
  }

  private handleBombExplode(data: BombExplodeEvent): void {
    this.gameEngine.removeBombRealtime(data);

    if (data.uid === this.socketConnection.getMyBomberInfo()?.uid) {
      this.bombState.isWaitingForOwn = false;
      console.log("✅ Own bomb exploded. Resuming normal operations.");
    }

    // No need to call executeBotLogic() here - the current tick will handle it
    // after all queued events are processed
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

  private handleNewBomb(data: any): void {
    const myBomber = this.socketConnection.getMyBomberInfo();

    // Correlate predicted bomb
    if (
      this.bombState.pendingPredicted &&
      myBomber &&
      data.uid === myBomber.uid
    ) {
      const dist = getDistance(this.bombState.pendingPredicted, {
        x: data.x,
        y: data.y,
      });

      if (dist < CONFIG.BOMB_PLACED_DISTANCE) {
        this.gameEngine.confirmPredictedBomb(
          this.bombState.pendingPredicted,
          data
        );
        this.bombState.pendingPredicted = null;
        return;
      }
    }

    this.gameEngine.addBombRealtime(data);
    this.checkImmediateThreat(data);
  }

  // Public API methods
  public shutdown(): void {
    console.log("🛑 Shutting down bot...");
    this.isRunning = false;

    if (this.botLogicTimeout) {
      clearTimeout(this.botLogicTimeout);
      this.botLogicTimeout = undefined;
    }

    // if (this.botLogicInterval) {
    //   clearInterval(this.botLogicInterval);
    // }

    this.socketConnection.disconnect();
    console.log("✅ Bot shut down completely.");
  }

  public stop(): void {
    this.isRunning = false;
    console.log("⏸️ Bot paused.");
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
      console.log(`🔄 Strategy '${strategyName}' priority → ${priority}`);
    } else {
      console.warn(`⚠️ Strategy '${strategyName}' not found`);
    }
    return success;
  }

  public resetAI(): void {
    this.ai.resetStrategies();
    console.log("🔄 AI strategies reset to default");
  }

  public getGameStats() {
    return this.gameEngine.getGameStats();
  }

  public getGameState() {
    return this.gameEngine.getGameState();
  }

  /**
   * OPTIMIZATION: Predictive movement for smoother pathfinding
   * Looks ahead to the next waypoint to start turning earlier
   */
  private calculateLookaheadTarget(
    currentPos: Position,
    targetWaypoint: Position,
    nextWaypoint?: Position
  ): Position {
    if (!nextWaypoint) return targetWaypoint;

    const distToCurrent = getDistance(currentPos, targetWaypoint);

    if (distToCurrent < CELL_SIZE * 0.8) {
      // NEW: Check if waypoints are adjacent (wall risk)
      const currentCell = pixelToCellIndex(targetWaypoint);
      const nextCell = pixelToCellIndex(nextWaypoint);
      const manhattan =
        Math.abs(currentCell.x - nextCell.x) +
        Math.abs(currentCell.y - nextCell.y);

      if (manhattan === 1) {
        return targetWaypoint; // NO BLENDING if adjacent!
      }

      // Safe to blend
      return {
        x: targetWaypoint.x * 0.7 + nextWaypoint.x * 0.3,
        y: targetWaypoint.y * 0.7 + nextWaypoint.y * 0.3,
      };
    }

    return targetWaypoint;
  }

  /**
   * OPTIMIZATION: Detect if bot is stuck (not making progress)
   */
  private detectStuckState(): boolean {
    const { lastPosition, lastPositionTime } = this.movementState;

    if (!lastPosition || !this.pathState.currentPath) {
      return false;
    }

    const currentBot = this.gameEngine.getCurrentBot();
    if (!currentBot) return false;

    const currentPos = currentBot.position;
    const timeDiff = Date.now() - lastPositionTime;

    // Check if enough time has passed
    if (timeDiff < CONFIG.STUCK_DETECTION_THRESHOLD) {
      return false;
    }

    const distanceMoved = getDistance(lastPosition, currentPos);

    // If moved less than threshold, increment stuck counter
    if (distanceMoved < CONFIG.STUCK_DISTANCE_THRESHOLD) {
      this.movementState.stuckCounter++;
      console.warn(`⚠️ Stuck counter: ${this.movementState.stuckCounter}/3`);

      // Stuck for 3 consecutive checks = definitely stuck
      if (this.movementState.stuckCounter >= 3) {
        this.movementState.isStuck = true;
        return true;
      }
    } else {
      // Making progress, reset counter
      this.movementState.stuckCounter = 0;
      this.movementState.isStuck = false;
    }

    return false;
  }

  /**
   * OPTIMIZATION: Update movement tracking for stuck detection
   */
  private updateMovementTracking(currentPos: Position): void {
    const now = Date.now();
    const { lastPosition, lastPositionTime } = this.movementState;

    // Update tracking every 200ms
    if (
      !lastPosition ||
      now - lastPositionTime >= CONFIG.STUCK_DETECTION_THRESHOLD
    ) {
      this.movementState.lastPosition = { ...currentPos };
      this.movementState.lastPositionTime = now;
    }
  }

  /**
   * OPTIMIZATION: Check if path should be revalidated
   * Revalidate if:
   * 1. Path is old (> 1 second)
   * 2. New bombs appeared near the path
   * 3. Haven't validated recently
   */
  private shouldRevalidatePath(gameState: GameState): boolean {
    const { pathCreatedAt, lastValidatedAt, currentPath } = this.pathState;

    if (!currentPath || currentPath.length === 0) {
      return false;
    }

    const now = Date.now();

    // Don't revalidate too frequently
    if (now - lastValidatedAt < 500) {
      return false;
    }

    // Path is old, should revalidate
    if (now - pathCreatedAt > CONFIG.PATH_REVALIDATE_INTERVAL) {
      console.log("🕐 Path is old, needs revalidation");
      return true;
    }

    // Check if new bombs threaten the path
    if (this.isPathThreatened(currentPath, gameState)) {
      console.log("💣 Path threatened by bombs, needs revalidation");
      return true;
    }

    // Update validation timestamp
    this.pathState.lastValidatedAt = now;
    return false;
  }

  /**
   * OPTIMIZATION: Check if any bombs threaten the current path
   */
  private isPathThreatened(path: Position[], gameState: GameState): boolean {
    const bombs = gameState.map.bombs || [];

    // Check next few waypoints in the path
    const waypointsToCheck = path.slice(
      this.pathState.currentPathIndex,
      this.pathState.currentPathIndex + CONFIG.PREDICTION_STEPS
    );

    for (const waypoint of waypointsToCheck) {
      for (const bomb of bombs) {
        const bombPos = { x: bomb.position.x, y: bomb.position.y };
        const distance = getDistance(waypoint, bombPos);
        const dangerRadius =
          (bomb.flameRange || 2) * CELL_SIZE + CONFIG.BOMB_SAFETY_MARGIN;

        if (distance < dangerRadius) {
          return true;
        }
      }
    }

    return false;
  }
}
