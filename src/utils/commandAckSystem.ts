/**
 * Command Acknowledgement System
 * Theo dõi và xác nhận các lệnh đã được server nhận
 */

import { Direction } from "../types";

export enum CommandType {
  MOVE = "move",
  PLACE_BOMB = "place_bomb",
  JOIN = "join",
}

export interface PendingCommand {
  id: string;
  type: CommandType;
  data: any;
  timestamp: number;
  acknowledged: boolean;
  timeout?: NodeJS.Timeout;
}

export interface CommandCallback {
  (success: boolean, command: PendingCommand): void;
}

export class CommandAckSystem {
  private pendingCommands: Map<string, PendingCommand> = new Map();
  private commandIdCounter: number = 0;
  private defaultTimeoutMs: number = 1000; // 1 giây timeout
  private callbacks: Map<string, CommandCallback> = new Map();

  /**
   * Gửi lệnh với acknowledgement
   * @param socket Socket.IO instance
   * @param type Loại lệnh
   * @param data Dữ liệu lệnh
   * @param callback Callback khi nhận response hoặc timeout
   * @returns Command ID
   */
  public sendCommand(
    socket: any,
    type: CommandType,
    data: any,
    callback?: CommandCallback
  ): string {
    const commandId = this.generateCommandId();
    const timestamp = Date.now();

    // Tạo pending command
    const command: PendingCommand = {
      id: commandId,
      type,
      data,
      timestamp,
      acknowledged: false,
    };

    // Lưu callback nếu có
    if (callback) {
      this.callbacks.set(commandId, callback);
    }

    // Setup timeout
    command.timeout = setTimeout(() => {
      this.handleTimeout(commandId);
    }, this.defaultTimeoutMs);

    // Lưu pending command
    this.pendingCommands.set(commandId, command);

    // Gửi lệnh với acknowledgement callback
    socket.emit(type, data, (response: any) => {
      this.handleAcknowledgement(commandId, response);
    });

    return commandId;
  }

  /**
   * Gửi lệnh move với ack
   */
  public sendMove(
    socket: any,
    direction: Direction,
    callback?: CommandCallback
  ): string {
    return this.sendCommand(
      socket,
      CommandType.MOVE,
      { orient: direction },
      callback
    );
  }

  /**
   * Gửi lệnh place bomb với ack
   */
  public sendPlaceBomb(socket: any, callback?: CommandCallback): string {
    return this.sendCommand(socket, CommandType.PLACE_BOMB, {}, callback);
  }

  /**
   * Xử lý acknowledgement từ server
   */
  private handleAcknowledgement(commandId: string, response: any): void {
    const command = this.pendingCommands.get(commandId);

    if (!command) {
      return; // Command đã timeout hoặc không tồn tại
    }

    // Clear timeout
    if (command.timeout) {
      clearTimeout(command.timeout);
    }

    // Đánh dấu acknowledged
    command.acknowledged = true;

    // Gọi callback
    const callback = this.callbacks.get(commandId);
    if (callback) {
      callback(true, command);
    }

    // Xóa khỏi pending
    this.pendingCommands.delete(commandId);
    this.callbacks.delete(commandId);

    // Log thời gian xử lý
    const processingTime = Date.now() - command.timestamp;
    console.log(
      `✅ Command ${command.type} acknowledged in ${processingTime}ms`
    );
  }

  /**
   * Xử lý timeout (server không phản hồi)
   */
  private handleTimeout(commandId: string): void {
    const command = this.pendingCommands.get(commandId);

    if (!command) {
      return;
    }

    console.warn(
      `⏱️ Command ${command.type} timeout after ${this.defaultTimeoutMs}ms`
    );

    // Gọi callback với failed
    const callback = this.callbacks.get(commandId);
    if (callback) {
      callback(false, command);
    }

    // Xóa khỏi pending
    this.pendingCommands.delete(commandId);
    this.callbacks.delete(commandId);
  }

  /**
   * Generate unique command ID
   */
  private generateCommandId(): string {
    this.commandIdCounter++;
    return `cmd_${Date.now()}_${this.commandIdCounter}`;
  }

  /**
   * Lấy số lệnh đang chờ acknowledge
   */
  public getPendingCount(): number {
    return this.pendingCommands.size;
  }

  /**
   * Kiểm tra xem có lệnh nào đang pending không
   */
  public hasPending(): boolean {
    return this.pendingCommands.size > 0;
  }

  /**
   * Get stats
   */
  public getStats(): {
    pending: number;
    types: { [key: string]: number };
  } {
    const types: { [key: string]: number } = {};

    this.pendingCommands.forEach((cmd) => {
      types[cmd.type] = (types[cmd.type] || 0) + 1;
    });

    return {
      pending: this.pendingCommands.size,
      types,
    };
  }

  /**
   * Clear all pending commands
   */
  public clear(): void {
    this.pendingCommands.forEach((cmd) => {
      if (cmd.timeout) {
        clearTimeout(cmd.timeout);
      }
    });

    this.pendingCommands.clear();
    this.callbacks.clear();
  }

  /**
   * Set timeout duration
   */
  public setTimeout(ms: number): void {
    this.defaultTimeoutMs = ms;
  }
}
