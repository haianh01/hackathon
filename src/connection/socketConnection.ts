import io from "socket.io-client";
import { Direction, UserResponse, Bomber } from "../types";
import { MOVE_STEP_SIZE } from "../utils/coordinates";

// Define the Socket type from socket.io-client
type SocketType = ReturnType<typeof io>;

/**
 * Manages the Socket.IO connection for the Bomberman bot, based on the hackathon protocol.
 */
export class SocketConnection {
  private socket: SocketType | null = null;
  private serverAddress: string;
  private token: string;
  private isGameStarted: boolean = true; // Default to true for development environments
  private myBomberInfo: Bomber | null = null;
  private onGameDataCallback?: (data: UserResponse) => void;
  private onGameStartCallback?: () => void;
  private onGameEndCallback?: () => void;
  private onPositionUpdateCallback?: (x: number, y: number) => void;
  private onNewBombCallback?: (data: any) => void;
  private onBombExplodeCallback?: (data: any) => void;
  private onMapUpdateCallback?: (data: any) => void;
  private onUserDieCallback?: (data: any) => void;
  private onChestDestroyedCallback?: (data: any) => void;
  private onItemCollectedCallback?: (data: any) => void;
  private onUserDisconnectCallback?: (data: any) => void;
  private isDevelopmentMode: boolean = true;
  private lastMoveTime: number = 0;
  private readonly moveThrottleMs: number = 17; // Match server tickrate (17ms)
  public predictedPosition: { x: number; y: number } | null = null;
  private lastConfirmedPosition: { x: number; y: number } | null = null;
  private currentDirection: Direction | null = null;
  private moveInterval: NodeJS.Timeout | null = null;

  constructor(serverAddress: string, token: string) {
    this.serverAddress = serverAddress;
    this.token = token;

    this.isDevelopmentMode =
      serverAddress.includes("zarena-dev") ||
      serverAddress.includes("localhost") ||
      serverAddress.includes("127.0.0.1");

    if (this.isDevelopmentMode) {
      this.isGameStarted = true;
      console.log("🔧 Development mode: Game will start automatically.");
    } else {
      this.isGameStarted = false;
      console.log("🏆 Competition mode: Waiting for 'start' event.");
    }
  }

  /**
   * Initializes the connection to the server.
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Attempting to connect to ${this.serverAddress}...`);

      this.socket = io(this.serverAddress, {
        auth: { token: this.token },
        transports: ["websocket"],
      });

      this.socket.on("connect", () => {
        console.log(
          `✅ Successfully connected to the server! Socket ID: ${this.socket?.id}`
        );
        this.joinGameRoom();
        resolve();
      });

      this.setupEventListeners();

      this.socket.on("connect_error", (err: Error) => {
        console.error(`❌ Connection error: ${err.message}`);
        reject(new Error(`Connection failed: ${err.message}`));
      });

      this.socket.on("disconnect", (reason: string) => {
        console.log(`❌ Disconnected. Reason: ${reason}`);
        this.isGameStarted = this.isDevelopmentMode;
      });
    });
  }

  /**
   * Sets up event listeners for Socket.IO.
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on("user", (data: UserResponse) => {
      if (data.bombers && data.bombers.length > 0) {
        this.myBomberInfo =
          data.bombers.find((b) => b.uid === this.socket?.id) || null;
        if (this.myBomberInfo) {
          console.log(`🤖 My bot (${this.myBomberInfo.name}) is ready.`);
          this.lastConfirmedPosition = {
            x: this.myBomberInfo.x,
            y: this.myBomberInfo.y,
          };
        }
      }
      this.onGameDataCallback?.(data);
    });

    this.socket.on("start", (data: any) => {
      console.log(`🚨 GAME STARTED! Time: ${data.start_at}`);
      this.isGameStarted = true;
      this.isDevelopmentMode = false;
      this.onGameStartCallback?.();
    });

    this.socket.on("finish", () => {
      console.log("🏁 GAME FINISHED!");
      this.isGameStarted = this.isDevelopmentMode;
      if (this.isDevelopmentMode) {
        setTimeout(() => {
          console.log("🔄 Game reset, continuing play...");
          this.isGameStarted = true;
        }, 1000);
      }
      this.onGameEndCallback?.();
    });

    this.socket.on("player_move", (data: any) => {
      if (data.uid === this.socket?.id) {
        const oldPos = this.lastConfirmedPosition
          ? `(${this.lastConfirmedPosition.x}, ${this.lastConfirmedPosition.y})`
          : "unknown";
        // console.log(`📍 Position updated: ${oldPos} -> (${data.x}, ${data.y})`);

        this.lastConfirmedPosition = { x: data.x, y: data.y };
        if (this.myBomberInfo) {
          this.myBomberInfo.x = data.x;
          this.myBomberInfo.y = data.y;
        }
        this.onPositionUpdateCallback?.(data.x, data.y);
      }
    });

    this.socket.on("new_bomb", (data: any) => {
      console.log(`⬅️ New bomb placed at (${data.x}, ${data.y})`);
      this.onNewBombCallback?.(data);
    });

    this.socket.on("bomb_explode", (data: any) => {
      console.log(`💥 Bomb exploded at (${data.x}, ${data.y})`);
      this.onBombExplodeCallback?.(data);
    });

    this.socket.on("map_update", (data: any) => {
      console.log("⬅️ Map updated: New chests and items.");
      this.onMapUpdateCallback?.(data);
    });

    // this.socket.on("user_die_update", (data: any) => {
    //   console.log(
    //     `💀 Bot ${data.killed.name} was eliminated by ${data.killer.name}!`
    //   );
    //   this.onUserDieCallback?.(data);
    // });

    this.socket.on("chest_destroyed", (data: any) => {
      console.log(`📦 Chest destroyed at (${data.x}, ${data.y})`);
      this.onChestDestroyedCallback?.(data);
    });

    this.socket.on("item_collected", (data: any) => {
      console.log(`🎁 Item collected at (${data.x}, ${data.y})`);
      this.onItemCollectedCallback?.(data);
    });

    this.socket.on("user_disconnect", (data: any) => {
      console.log(`👋 User ${data.name} disconnected`);
      this.onUserDisconnectCallback?.(data);
    });
  }

  /**
   * Joins the game room.
   */
  private joinGameRoom(): void {
    console.log("➡️ Sending 'join' event to enter the game room...");
    this.socket?.emit("join", {});
  }

  /**
   * Re-sends the join event.
   */
  public rejoin(): void {
    if (this.socket?.connected) {
      console.log("➡️ Re-sending 'join' event...");
      this.socket.emit("join", {});
    } else {
      console.log("⚠️ Cannot join: Not connected to the server.");
    }
  }

  /**
   * Moves the bot in a specified direction (single move).
   */
  public move(direction: Direction): void {
    if (!this.isGameStarted || !this.socket) return;

    const now = Date.now();
    if (now - this.lastMoveTime < this.moveThrottleMs) return;

    const currentPos = this.getCurrentPosition();
    if (currentPos) {
      this.predictedPosition = this.predictNextPosition(currentPos, direction);
    }

    this.lastMoveTime = now;
    this.socket.emit("move", { orient: direction });
  }

  /**
   * Continuously moves the bot in a direction until stopped.
   */
  public startContinuousMove(direction: Direction): void {
    if (
      !this.isGameStarted ||
      !this.socket ||
      (this.currentDirection === direction && this.moveInterval)
    ) {
      return;
    }

    this.stopContinuousMove();
    this.currentDirection = direction;

    const moveAction = () => {
      if (this.socket?.connected && this.isGameStarted) {
        this.socket.emit("move", { orient: direction });
      } else {
        this.stopContinuousMove();
      }
    };

    moveAction(); // Move immediately
    this.moveInterval = setInterval(moveAction, 17); // Match server tickrate (17ms = ~59 ticks/sec)
    console.log(`🔄 Started continuous move: ${direction} (17ms interval)`);
  }

  /**
   * Stops continuous movement.
   */
  public stopContinuousMove(): void {
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
      this.currentDirection = null;
      console.log("⏹️ Stopped continuous move.");
    }
  }

  /**
   * Predicts the next position based on the current position and direction.
   * Server moves ~1px per tick at 17ms intervals (based on observation)
   */
  private predictNextPosition(
    currentPos: { x: number; y: number },
    direction: Direction
  ): { x: number; y: number } {
    switch (direction) {
      case Direction.UP:
        return { x: currentPos.x, y: currentPos.y - MOVE_STEP_SIZE };
      case Direction.DOWN:
        return { x: currentPos.x, y: currentPos.y + MOVE_STEP_SIZE };
      case Direction.LEFT:
        return { x: currentPos.x - MOVE_STEP_SIZE, y: currentPos.y };
      case Direction.RIGHT:
        return { x: currentPos.x + MOVE_STEP_SIZE, y: currentPos.y };
      default:
        return currentPos;
    }
  }

  /**
   * Places a bomb.
   */
  public placeBomb(): void {
    if (this.isGameStarted && this.socket) {
      console.log("➡️ Sending 'place_bomb' event");
      this.socket.emit("place_bomb", {});
    }
  }

  /**
   * Disconnects from the server.
   */
  public disconnect(): void {
    this.stopContinuousMove();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isGameStarted = false;
      console.log("🔌 Disconnected.");
    }
  }

  /**
   * Checks the connection status.
   */
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Checks if the game is currently running.
   */
  public isGameRunning(): boolean {
    return this.isGameStarted;
  }

  /**
   * Checks if the environment is for development.
   */
  public isDevelopment(): boolean {
    return this.isDevelopmentMode;
  }

  /**
   * Gets the current bomber's information.
   */
  public getMyBomberInfo(): Bomber | null {
    return this.myBomberInfo;
  }

  /**
   * Gets the current position (confirmed by the server).
   */
  public getCurrentPosition(): { x: number; y: number } | null {
    return this.lastConfirmedPosition;
  }

  // Callback registration methods
  public onGameData(callback: (data: UserResponse) => void): void {
    this.onGameDataCallback = callback;
  }
  public onGameStart(callback: () => void): void {
    this.onGameStartCallback = callback;
  }
  public onGameEnd(callback: () => void): void {
    this.onGameEndCallback = callback;
  }
  public onPositionUpdate(callback: (x: number, y: number) => void): void {
    this.onPositionUpdateCallback = callback;
  }
  public onNewBomb(callback: (data: any) => void): void {
    this.onNewBombCallback = callback;
  }
  public onBombExplode(callback: (data: any) => void): void {
    this.onBombExplodeCallback = callback;
  }
  public onMapUpdate(callback: (data: any) => void): void {
    this.onMapUpdateCallback = callback;
  }
  public onUserDie(callback: (data: any) => void): void {
    this.onUserDieCallback = callback;
  }
  public onChestDestroyed(callback: (data: any) => void): void {
    this.onChestDestroyedCallback = callback;
  }
  public onItemCollected(callback: (data: any) => void): void {
    this.onItemCollectedCallback = callback;
  }
  public onUserDisconnect(callback: (data: any) => void): void {
    this.onUserDisconnectCallback = callback;
  }
}
