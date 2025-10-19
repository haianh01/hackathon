import { BombermanAI } from "./ai";
import { GameEngine } from "./game";
import {
  BotDecision,
  BotAction,
  UserResponse,
  Position,
  Direction,
  ChestDestroyedEvent,
} from "./types";
import { SocketConnection } from "./connection/socketConnection";
import { getDirectionToTarget } from "./utils/position";
import {
  CELL_SIZE,
  cellToCellIndex,
  isPositionInDangerZone,
  pixelToCellCenter,
  PLAYER_SIZE,
} from "./utils";

// File-level constants to avoid magic numbers and make tuning easier
const BOT_LOGIC_INTERVAL = 800; // ms between main bot ticks
const PATH_FOLLOW_LOOKAHEAD = 5; // how many path waypoints to search ahead
const BOMB_PLACED_DISTANCE = 5; // px - consider bomb "just placed" if within this distance
const BOMB_SAFETY_MARGIN = 80; // px extra margin used when computing danger radius

// SỬA LỖI & GIẢI THÍCH:
// Ngưỡng "đến nơi" nên dựa trên kích thước của bot (30px), không phải kích thước ô (40px).
// PLAYER_SIZE / 2 = 15px. Bot được coi là đã đến khi tâm của nó cách tâm mục tiêu trong vòng 15px.
// Điều này đảm bảo bot tiến vào đủ sâu trong ô mục tiêu trước khi dừng lại, giúp các hành động sau đó (như đặt bom) chính xác hơn.
const PLAYER_REACH_THRESHOLD = CELL_SIZE / 2;
// After clearing an emergency escape state, wait this long before allowing
// normal decision logic to override state. This prevents race conditions when
// server events or danger detection lag behind client-side state.
const EMERGENCY_CLEAR_COOLDOWN_MS = 500; // ms
// Extra leniency (pixels) to account for drift between server-confirmed
// position and client-side movement/prediction.
const REACH_MARGIN_PIXELS = 8; // px

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

  // Emergency escape path (from immediate bomb threat)
  private emergencyEscapePath: Position[] | null = null;
  private emergencyEscapeTarget: Position | null = null;

  // Execution guard to prevent overlapping ticks
  private isExecuting: boolean = false;

  // State tracking for danger detection
  private lastBombCount: number = 0;
  // Timestamp when an emergency escape state was last cleared (ms since epoch)
  // Used to prevent normal logic from immediately overriding emergency behavior.
  private lastEmergencyClearedAt: number | null = null;

  // State for correlating client-predicted bombs with server-confirmed bombs.
  // Stores the position of a bomb we just placed and are waiting for confirmation.
  private pendingPredictedBomb: Position | null = null;

  // State to wait for our own bomb to explode if we have no more bombs left.
  private isWaitingForOwnBomb: boolean = false;

  // Path-following plan state
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
      console.log(
        `📍 Position updated from server: (${x}, ${y}), (${Math.floor(
          x / 40
        )}, ${Math.floor(y / 40)})`
      );
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
      console.log(
        `⚡ Realtime: New bomb from server at (${data.x}, ${data.y}) with ID ${data.id}`
      );
      const myBomber = this.socketConnection.getMyBomberInfo();

      // --- PREDICT & CORRELATE LOGIC ---
      // Check if this is the server confirming a bomb we just predicted
      if (this.pendingPredictedBomb && myBomber && data.uid === myBomber.uid) {
        const dist = Math.hypot(
          this.pendingPredictedBomb.x - data.x,
          this.pendingPredictedBomb.y - data.y
        );

        // If the server bomb is close to our predicted one, it's a match!
        if (dist < CELL_SIZE / 2) {
          console.log(
            `✅ Correlated predicted bomb with server bomb ID: ${data.id}`
          );
          // Update the temporary bomb in our game state with the real ID
          this.gameEngine.confirmPredictedBomb(this.pendingPredictedBomb, data);
          // Clear the pending state
          this.pendingPredictedBomb = null;
          // IMPORTANT: Return here to avoid treating our own confirmed bomb as a new threat
          return;
        }
      }

      // If it's not our correlated bomb, it's a new threat from another player.
      // Add it to the game state and check for danger.
      this.gameEngine.addBombRealtime(data);
      this.handleImmediateBombThreat(data);
    });

    this.socketConnection.onBombExplode((data: any) => {
      console.log(`⚡ Realtime: Bomb exploded at (${data.x}, ${data.y})`);
      // TODO: Remove bomb from danger list
      this.gameEngine.removeBombRealtime(data);
      if (data.uid === this.socketConnection.getMyBomberInfo()?.uid) {
        console.log(`💥 Our bomb exploded, re-evaluating game state.`);

        if (this.isWaitingForOwnBomb) {
          console.log(
            "✅ Bomb exploded, exiting 'waiting for explosion' state."
          );
          this.isWaitingForOwnBomb = false;
        }

        // để bot đánh giá lại tình huống sau vụ nổ (ngắt chế độ khẩn cấp).
        this.executeBotLogic();
      }
    });

    this.socketConnection.onChestDestroyed((data: ChestDestroyedEvent) => {
      console.log(`⚡ Realtime: Chest destroyed at (${data.x}, ${data.y})`);
      // TODO: An item might appear, needs re-evaluation
      this.gameEngine.removeChestRealtime(data);
    });

    this.socketConnection.onItemCollected((data: any) => {
      console.log(`⚡ Realtime: Item collected at (${data.x}, ${data.y})`);
      // TODO: Remove item from target list if present
      this.gameEngine.handleItemCollected(data);
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
    this.botLogicInterval = setInterval(
      () => this.executeBotLogic(),
      BOT_LOGIC_INTERVAL
    );
  }

  /**
   * Executes the main bot logic.
   */
  private executeBotLogic(): void {
    // Prevent overlapping execution and ensure game is running
    if (
      this.isExecuting ||
      !this.socketConnection.isGameRunning() ||
      !this.isRunning
    ) {
      if (this.isExecuting)
        console.warn("⚠️ Previous tick still running, skipping this tick...");
      return;
    }

    this.isExecuting = true;
    const startTime = Date.now();
    console.log("🤖 Executing bot logic...");
    try {
      // Cache frequently used references
      const socket = this.socketConnection;
      const ai = this.ai;
      const engine = this.gameEngine;
      const gameState = engine.getGameState();
      const currentBot = socket.getMyBomberInfo();

      // PRIORITY: Handle emergency escape if active. If it returns true,
      // the emergency was handled and we should short-circuit this tick.
      if (this.isHandlingEmergencyEscape(currentBot, gameState)) {
        return;
      }

      // PRIORITY: If waiting for our bomb, execute a defensive/waiting action.
      if (this.isWaitingForOwnBomb) {
        console.log(
          "⏳ Waiting for own bomb to explode. Executing defensive action."
        );
        const defensiveDecision = this.ai.makeDefensiveDecision(gameState);
        this.executeAction(defensiveDecision);
        // Short-circuit to prevent other logic from running.
        this.isExecuting = false;
        return;
      }

      // Normal path/decision execution
      this.handleNormalPathExecution(currentBot, gameState);
    } catch (err) {
      console.error("❌ Error in bot logic:", err);
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Returns true if emergency escape handling took action and this tick should stop.
   */
  private isHandlingEmergencyEscape(
    currentBot: any | null,
    gameState: any
  ): boolean {
    if (this.emergencyEscapePath && this.emergencyEscapeTarget && currentBot) {
      const dx = currentBot.x - this.emergencyEscapeTarget.x;
      const dy = currentBot.y - this.emergencyEscapeTarget.y;
      const distanceToTarget = Math.hypot(dx, dy);
      const REACHED_THRESHOLD = PLAYER_REACH_THRESHOLD;

      const isCurrentlySafe = !isPositionInDangerZone(currentBot, gameState);
      console.log(
        "%c🤪 ~ file: c:Userslehaihackathonsrc\bombermanBot.ts:306 [] -> isCurrentlySafe : ",
        "color: #d4df0d",
        isCurrentlySafe
      );

      // Case 1: Already safe — clear emergency state but allow this tick to continue
      if (isCurrentlySafe) {
        console.log(
          "✅ Bot đã ở vùng an toàn. Hủy bỏ trạng thái thoát hiểm khẩn cấp."
        );
        this.emergencyEscapePath = null;
        this.emergencyEscapeTarget = null;
        this.socketConnection.stopContinuousMove();
        this.clearPath();
        // record when emergency was cleared to prevent immediate override by normal logic
        this.lastEmergencyClearedAt = Date.now();

        // Do NOT short-circuit; allow normal logic to run in this tick
        return false;
      }

      // Case 2: Still in danger — recompute escape and act immediately
      console.warn(
        "🏃 Vẫn trong vùng nguy hiểm. Tiếp tục hoặc tính toán lại đường thoát hiểm."
      );
      this.lastBombCount = gameState.map.bombs.length;
      const reDecision = this.ai.makeDecisionEscape(gameState);

      if (reDecision.action === BotAction.MOVE && reDecision.target) {
        // Update emergency escape state with new path/target
        this.emergencyEscapeTarget = reDecision.target;
        this.emergencyEscapePath = reDecision.path || [
          currentBot.position,
          reDecision.target,
        ];

        // Execute escape immediately
        this.executeAction(reDecision);
      } else {
        // AI couldn't find a move — stop as last resort
        console.error("❌ KHÔNG THỂ TÌM THẤY ĐƯỜNG THOÁT HIỂM! Dừng lại.");
        this.executeAction({
          action: BotAction.STOP,
          reason: "No escape path found",
        } as any);
      }

      // Short-circuit: emergency handled this tick
      return true;
    }

    // Not handling emergency escape
    return false;
  }

  /**
   * Handles non-emergency decision making and path following.
   */
  private handleNormalPathExecution(
    currentBot: any | null,
    gameState: any
  ): void {
    // If we just cleared an emergency escape state, wait a short cooldown
    // before letting normal logic overwrite paths. This prevents flip-flopping
    // when danger detection lags behind.
    if (
      this.lastEmergencyClearedAt &&
      Date.now() - this.lastEmergencyClearedAt < EMERGENCY_CLEAR_COOLDOWN_MS
    ) {
      // still in cooldown window — skip normal decision making this tick
      console.log(
        `⏳ Emergency clear cooldown active (${
          Date.now() - this.lastEmergencyClearedAt
        }ms elapsed), skipping normal logic.`
      );
      return;
    }
    // Update bomb count (cheap) and clear path if needed
    this.lastBombCount = gameState.map.bombs.length;

    // Determine if current path target is reached
    let distanceToTarget = Infinity;
    if (currentBot && this.currentPath && this.currentPath.length) {
      const last = this.currentPath[this.currentPath.length - 1];

      if (last) {
        const dx = currentBot.x - last.x;
        const dy = currentBot.y - last.y;
        distanceToTarget = Math.hypot(dx, dy);
      }
    }
    console.log(
      "bothandleNormalPathExecution - distanceToTarget:",
      distanceToTarget
    );
    if (this.currentPath && currentBot) {
      const lastPos = this.currentPath.length
        ? this.currentPath[this.currentPath.length - 1]
        : undefined;
      console.log("pass", this.isAtPosition(currentBot, lastPos, 30));
      if (lastPos && this.isAtPosition(currentBot, lastPos, 30)) {
        console.log(
          "✅ Detected arrival at current path target (normal logic). Clearing currentPath."
        );
        this.clearPath();
      }
    }

    // If no active path, ask AI for a decision

    if (!this.currentPath || this.currentPath.length === 0) {
      (gameState as any).bombermanCurrentPlan = this.currentPlan;
      const decisionStart = Date.now();
      const decision = this.ai.makeDecision(gameState);
      const decisionTime = Date.now() - decisionStart;

      this.executeAction(decision);

      const totalTime = Date.now() - decisionStart; // measure only decision time here
      // Keep only actionable warnings to reduce noise
      if (totalTime > 150) {
        console.warn(
          `⚠️ Slow decision: ${totalTime}ms (decision ${decisionTime}ms)`
        );
      }
    }
  }

  /**
   * Executes an action based on the AI's decision.
   */
  private executeAction(decision: BotDecision): void {
    // Log the high-level decision for easier debugging of strategy switches
    try {
      console.log(
        `🤖 executeAction: ${decision.reason} (action: ${decision.action}, priority: ${decision.priority})`
      );
    } catch (e) {
      // Fallback: ensure logging never throws
    }
    switch (decision.action) {
      case BotAction.MOVE:
        if (decision.path && decision.path.length > 1) {
          this.followPath(decision);
        } else if (decision.target && decision.direction) {
          this.followNextStep(decision);
        } else if (decision.direction) {
          this.clearPath();
          this.socketConnection.startContinuousMove(decision.direction);
        }
        break;
      case BotAction.BOMB:
        this.clearPath();
        this.socketConnection.stopContinuousMove(); // Stop moving first
        this.socketConnection.placeBomb();
        const currentBot = this.gameEngine.getCurrentBot();

        if (currentBot) {
          // Snap to cell center for consistency
          const snappedBombPos = pixelToCellCenter(currentBot.position);

          // Prevent adding duplicate predictions if a pending one already exists
          if (
            this.pendingPredictedBomb &&
            Math.hypot(
              this.pendingPredictedBomb.x - snappedBombPos.x,
              this.pendingPredictedBomb.y - snappedBombPos.y
            ) < 10
          ) {
            console.warn(
              "⏩ Skipping bomb prediction: already have a pending bomb at this location."
            );
            break;
          }

          this.ai.markBombPlaced(snappedBombPos);
          // Set the pending bomb position for correlation in the onNewBomb event
          this.pendingPredictedBomb = snappedBombPos;

          // Create a temporary bomb object for immediate client-side reaction
          const predictedBomb = {
            x: snappedBombPos.x,
            y: snappedBombPos.y,
            range: currentBot.flameRange || 2,
            id: `predicted-${snappedBombPos.x}-${snappedBombPos.y}`, // A more stable temporary ID
            ownerId: currentBot.id, // Mark it as ours
          };
          this.gameEngine.addBombRealtime(predictedBomb);
          this.handleImmediateBombThreat(predictedBomb);

          // If we have no bombs left after this, enter waiting state.
          if (currentBot.bombCount <= 1) {
            this.isWaitingForOwnBomb = true;
            console.log(
              "⏳ Bot has no more bombs, entering 'waiting for explosion' state."
            );
          }
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
        `🛤️ Starting new path: ${decision.path.length} steps to (${decision.target?.x}, ${decision.target?.y}) — reason: ${decision.reason} (priority: ${decision.priority})`
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

    // SỬA LỖI: Logic tìm waypoint gần nhất quá "tham lam", có thể nhảy cóc các bước.
    // Thay vào đó, chỉ nên quyết định giữa waypoint hiện tại và waypoint kế tiếp.
    // Điều này đảm bảo bot đi tuần tự qua từng bước của path.
    const currentIndex = this.currentPathIndex;
    const nextIndex = Math.min(currentIndex + 1, this.currentPath.length - 1);

    const currentWaypoint = this.currentPath[currentIndex];
    const nextWaypointCandidate = this.currentPath[nextIndex];

    if (
      currentWaypoint &&
      nextWaypointCandidate &&
      currentIndex !== nextIndex
    ) {
      const distToCurrent = Math.hypot(
        currentPos.x - currentWaypoint.x,
        currentPos.y - currentWaypoint.y
      );
      const distToNext = Math.hypot(
        currentPos.x - nextWaypointCandidate.x,
        currentPos.y - nextWaypointCandidate.y
      );

      // Nếu bot đã ở gần waypoint tiếp theo hơn là waypoint hiện tại,
      // thì ta tiến index lên.
      if (distToNext < distToCurrent) {
        closestIndex = nextIndex;
      }
    }
    // Nếu không, closestIndex vẫn là this.currentPathIndex, bot sẽ tiếp tục
    // di chuyển về waypoint hiện tại.

    // Update to closest index
    this.currentPathIndex = closestIndex;

    // Check if we reached the target
    if (this.pathTarget && this.isAtPosition(currentPos, this.pathTarget)) {
      console.log(
        `✅ Reached path target at (${this.pathTarget.x}, ${this.pathTarget.y})`
      );
      this.clearPath();
      this.socketConnection.stopContinuousMove();
      return;
    }

    // Get next waypoint in path
    const nextWaypoint = this.currentPath[nextIndex];

    if (!nextWaypoint) {
      console.log(`⚠️ No next waypoint found, clearing path`);
      this.clearPath();
      return;
    }
    console.log(
      "🚶 Following path...",
      `CurrentPos: (${currentPos.x}, ${currentPos.y}), NextWaypoint: (${nextWaypoint.x}, ${nextWaypoint.y}),  decision.direction : ${decision.direction}`
    );
    // Calculate direction to next waypoint
    // SỬA LỖI: Ưu tiên hướng đi đã được tính toán sẵn từ pathfinding (decision.direction).
    // Chỉ tính toán lại bằng getDirectionToTarget nếu không có hướng nào được cung cấp.
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
   * Thực hiện bước di chuyển đơn lẻ (nextStep) được cung cấp trong BotDecision,
   * thay vì quản lý toàn bộ một đường đi dài (fullPath).
   * * Hàm này lý tưởng cho các quyết định khẩn cấp (Emergency Decisions)
   * nơi chỉ cần thực hiện nextStep từ BFS.
   */
  private followNextStep(decision: BotDecision): void {
    const currentBot = this.gameEngine.getCurrentBot();

    // Kiểm tra điều kiện cần thiết: Bot, Target và Direction phải tồn tại
    if (!currentBot || !decision.target || !decision.direction) {
      console.log(
        "⚠️ executeNextStep: Missing bot, target, or direction in decision."
      );
      return;
    }

    const currentPos = currentBot.position;
    const nextWaypoint = decision.target; // decision.target chứa nextStep pixel position từ Emergency Escape

    // 1. Kiểm tra đã đến đích chưa (Trường hợp Bot bị lag hoặc đã gần đến đích)
    if (this.isAtPosition(currentPos, nextWaypoint, 10)) {
      console.log(
        `✅ Reached next step target at (${nextWaypoint.x}, ${nextWaypoint.y}). Stopping and waiting for next decision.`
      );
      this.socketConnection.stopContinuousMove();
      this.clearPath();
      return;
    }
    console.log(
      "🚶 Executing next step towards emergency target...",
      decision.direction
    );
    // 2. Tính toán lại hướng (để chống lại drift)
    const direction = getDirectionToTarget(currentPos, nextWaypoint);

    // Distance left for logging/debugging
    // SỬA LỖI: Tính khoảng cách trực tiếp, không trừ đi các giá trị tùy tiện.
    const distToTarget = Math.hypot(
      currentPos.x - nextWaypoint.x,
      currentPos.y - nextWaypoint.y
    );

    console.log(
      `🎯 Executing Next Step: ${direction} to (${nextWaypoint.x}, ${
        nextWaypoint.y
      }). Dist remaining: ${distToTarget.toFixed(1)}px — reason: ${
        decision.reason
      } (priority: ${decision.priority})`
    );

    // 3. Thực hiện di chuyển liên tục
    this.socketConnection.startContinuousMove(direction);

    // Gán đường đi để BotStrategy biết rằng nó đang thực hiện một lệnh MOVE
    // Dù chỉ là 1 bước, ta vẫn cần lưu nó để tránh bị gián đoạn.
    this.currentPath = [currentPos, nextWaypoint];
    this.currentPathIndex = 0;
    this.pathTarget = nextWaypoint;
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
   * Robust reach-detection helper.
   * Returns true when currentPos is considered to have reached targetPos.
   * Uses either cell-aligned equality (rounded) or a pixel-distance threshold
   * with a small margin to avoid false negatives due to minor offsets.
   */
  private isAtPosition(
    currentPos: Position,
    targetPos: Position | undefined,
    threshold?: number
  ): boolean {
    if (!currentPos || !targetPos) return false;

    const effectiveThreshold =
      (threshold ?? PLAYER_REACH_THRESHOLD) + REACH_MARGIN_PIXELS;

    const dx = currentPos.x - targetPos.x;
    const dy = currentPos.y - targetPos.y;
    const dist = Math.hypot(dx, dy);
    return dist <= effectiveThreshold;
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
    const dangerRadius =
      bombRange * CELL_SIZE + PLAYER_REACH_THRESHOLD + BOMB_SAFETY_MARGIN;

    // Special case: If bot is EXACTLY on bomb (distance < BOMB_PLACED_DISTANCE), it just placed the bomb
    // Always trigger escape in this case
    const isOnBomb = distance < BOMB_PLACED_DISTANCE;

    // Check if bot is in immediate danger
    if (isOnBomb || distance < dangerRadius) {
      if (isOnBomb) {
        console.warn(
          `🚨 JUST PLACED BOMB! Bot at bomb position, forcing immediate escape!`
        );
      }
      console.warn(
        `🚨 IMMEDIATE THREAT! Bomb ${distance.toFixed(
          0
        )}px away (danger threshold: ${dangerRadius}px)`
      );

      // INTERRUPT current action immediately
      this.socketConnection.stopContinuousMove();
      this.clearPath();

      // Get escape decision from AI (uses EscapeStrategy with A* pathfinding)
      const gameState = this.gameEngine.getGameState();
      const escapeDecision = this.ai.makeDecisionEscape(gameState);

      console.log(`🏃 EMERGENCY ESCAPE: ${escapeDecision.reason}`);

      // CRITICAL: Save emergency escape path so regular ticks can continue following it
      if (escapeDecision.target) {
        this.emergencyEscapeTarget = escapeDecision.target;
        // THÊM DÒNG NÀY VÀO
        this.emergencyEscapePath = escapeDecision.path || [
          this.gameEngine.getCurrentBot()!.position,
          escapeDecision.target,
        ];

        console.log(
          `🛤️ Emergency path saved: ${this.emergencyEscapePath.length} steps to (${escapeDecision.target?.x}, ${escapeDecision.target?.y})`
        );
      }

      // Execute emergency escape immediately (starts movement)
      this.executeAction(escapeDecision);
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
        return;
      }
      this.gameEngine.updateGameState(gameData, socketId);
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
