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
} from "../strategies";

/**
 * AI Engine chính để điều khiển bot
 */
export class BombermanAI {
  private strategies: BotStrategy[];

  constructor() {
    // Khởi tạo tất cả các strategies theo thứ tự ưu tiên
    this.strategies = [
      new EscapeStrategy(), // Ưu tiên cao nhất - thoát hiểm
      new BombStrategy(), // Đặt bom thông minh
      new AttackStrategy(), // Tấn công kẻ thù
      new DefensiveStrategy(), // Phòng thủ
      new CollectStrategy(), // Thu thập vật phẩm
      new WallBreakerStrategy(), // Phá tường
      new SmartNavigationStrategy(), // Điều hướng thông minh
      new ExploreStrategy(), // Khám phá bản đồ
    ];
  }

  /**
   * Đưa ra quyết định cho bot dựa trên trạng thái game hiện tại
   */
  public makeDecision(gameState: GameState): BotDecision {
    const decisions: BotDecision[] = [];

    // Lấy quyết định từ tất cả strategies
    for (const strategy of this.strategies) {
      // console.log(
      //   "%c🤪 ~ file: bombermanAI.ts:39 [] -> strategy : ",
      //   "color: #4b2b6a",
      //   strategy
      // );
      try {
        const decision = strategy.evaluate(gameState);
        console.log(
          "%c🤪 ~ file: bombermanAI.ts:41 [] -> decision : ",
          "color: #22e856",
          decision
        );
        if (decision) {
          decisions.push(decision);
        }
      } catch (error) {
        console.error(`Lỗi trong strategy ${strategy.name}:`, error);
      }
    }

    // Nếu không có quyết định nào, đứng yên
    if (decisions.length === 0) {
      return {
        action: BotAction.STOP,
        direction: Direction.STOP,
        priority: 0,
        reason: "Không có chiến thuật phù hợp - đứng yên",
      };
    }

    // Sắp xếp theo priority (cao nhất trước)
    decisions.sort((a, b) => b.priority - a.priority);

    // Trả về quyết định có priority cao nhất
    const bestDecision = decisions[0]!;

    // Log để debug
    console.log(
      `🤖 Bot quyết định: ${bestDecision.reason} (Priority: ${bestDecision.priority})`
    );

    return bestDecision;
  }

  /**
   * Thêm strategy tùy chỉnh
   */
  public addStrategy(strategy: BotStrategy): void {
    this.strategies.push(strategy);
    // Sắp xếp lại theo priority
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Xóa strategy theo tên
   */
  public removeStrategy(name: string): void {
    this.strategies = this.strategies.filter((s) => s.name !== name);
  }

  /**
   * Lấy thông tin về tất cả strategies
   */
  public getStrategiesInfo(): Array<{ name: string; priority: number }> {
    return this.strategies.map((s) => ({
      name: s.name,
      priority: s.priority,
    }));
  }

  /**
   * Cập nhật priority của một strategy
   */
  public updateStrategyPriority(name: string, newPriority: number): boolean {
    const strategy = this.strategies.find((s) => s.name === name);
    if (strategy) {
      strategy.priority = newPriority;
      // Sắp xếp lại theo priority
      this.strategies.sort((a, b) => b.priority - a.priority);
      return true;
    }
    return false;
  }

  /**
   * Reset tất cả strategies về mặc định
   */
  public resetStrategies(): void {
    this.strategies = [
      new EscapeStrategy(),
      new AttackStrategy(),
      new CollectStrategy(),
      new ExploreStrategy(),
    ];
  }
}
