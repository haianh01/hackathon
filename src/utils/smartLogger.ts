/**
 * Smart Logger - Logger thông minh với khả năng tắt log trong competition
 * Giảm thiểu I/O và tăng hiệu suất
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export enum LogCategory {
  GENERAL = "GENERAL",
  SOCKET = "SOCKET",
  MOVEMENT = "MOVEMENT",
  AI = "AI",
  GAME_STATE = "GAME_STATE",
  POSITION = "POSITION",
  BOMB = "BOMB",
  PERFORMANCE = "PERFORMANCE",
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enabledCategories: LogCategory[];
  isDevelopmentMode: boolean;
  enableConsole: boolean;
  enableFile: boolean; // Future: log to file
}

export class SmartLogger {
  private static instance: SmartLogger;
  private config: LoggerConfig = {
    minLevel: LogLevel.INFO,
    enabledCategories: Object.values(LogCategory),
    isDevelopmentMode: true,
    enableConsole: true,
    enableFile: false,
  };

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): SmartLogger {
    if (!SmartLogger.instance) {
      SmartLogger.instance = new SmartLogger();
    }
    return SmartLogger.instance;
  }

  /**
   * Configure logger
   */
  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };

    if (!this.config.isDevelopmentMode) {
      // Competition mode: Chỉ log ERROR
      this.config.minLevel = LogLevel.ERROR;
      console.log("🏆 Competition mode: Logger set to ERROR only");
    } else {
      console.log("🔧 Development mode: Full logging enabled");
    }
  }

  /**
   * Set development mode
   */
  public setDevelopmentMode(isDev: boolean): void {
    this.configure({ isDevelopmentMode: isDev });
  }

  /**
   * Set minimum log level
   */
  public setMinLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  /**
   * Enable/disable specific category
   */
  public setCategoryEnabled(category: LogCategory, enabled: boolean): void {
    if (enabled) {
      if (!this.config.enabledCategories.includes(category)) {
        this.config.enabledCategories.push(category);
      }
    } else {
      this.config.enabledCategories = this.config.enabledCategories.filter(
        (c) => c !== category
      );
    }
  }

  /**
   * Check if should log
   */
  private shouldLog(level: LogLevel, category: LogCategory): boolean {
    if (!this.config.enableConsole) {
      return false;
    }

    if (level < this.config.minLevel) {
      return false;
    }

    if (!this.config.enabledCategories.includes(category)) {
      return false;
    }

    return true;
  }

  /**
   * Debug log
   */
  public debug(category: LogCategory, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG, category)) {
      console.log(`🔍 [${category}] ${message}`, ...args);
    }
  }

  /**
   * Info log
   */
  public info(category: LogCategory, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO, category)) {
      console.log(`ℹ️  [${category}] ${message}`, ...args);
    }
  }

  /**
   * Warning log
   */
  public warn(category: LogCategory, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN, category)) {
      console.warn(`⚠️  [${category}] ${message}`, ...args);
    }
  }

  /**
   * Error log (luôn hiển thị)
   */
  public error(category: LogCategory, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR, category)) {
      console.error(`❌ [${category}] ${message}`, ...args);
    }
  }

  /**
   * Performance log (đo thời gian thực thi)
   */
  public performance(label: string, fn: () => void): void {
    if (!this.shouldLog(LogLevel.INFO, LogCategory.PERFORMANCE)) {
      fn();
      return;
    }

    const start = Date.now();
    fn();
    const duration = Date.now() - start;

    if (duration > 100) {
      this.warn(LogCategory.PERFORMANCE, `${label} took ${duration}ms (slow!)`);
    } else {
      this.debug(LogCategory.PERFORMANCE, `${label} took ${duration}ms`);
    }
  }

  /**
   * Async performance log
   */
  public async performanceAsync<T>(
    label: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.shouldLog(LogLevel.INFO, LogCategory.PERFORMANCE)) {
      return await fn();
    }

    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;

    if (duration > 100) {
      this.warn(LogCategory.PERFORMANCE, `${label} took ${duration}ms (slow!)`);
    } else {
      this.debug(LogCategory.PERFORMANCE, `${label} took ${duration}ms`);
    }

    return result;
  }

  /**
   * Disable all logging (for competition)
   */
  public disableAll(): void {
    this.config.enableConsole = false;
    console.log("🔇 All logging disabled");
  }

  /**
   * Enable all logging (for development)
   */
  public enableAll(): void {
    this.config.enableConsole = true;
    this.config.minLevel = LogLevel.DEBUG;
    this.config.enabledCategories = Object.values(LogCategory);
    console.log("🔊 All logging enabled");
  }
}

// Export singleton instance
export const logger = SmartLogger.getInstance();
