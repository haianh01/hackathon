import { BombermanBot } from "./bombermanBot";

/**
 * Entry point của ứng dụng
 */

// Tạo instance bot
const bot = new BombermanBot();

// Khởi tạo bot
bot.initialize();

// Export để sử dụng ở nơi khác
export { BombermanBot };
export * from "./types";
export * from "./ai";
export * from "./game";
export * from "./strategies";
export * from "./utils";

// Example usage
if (require.main === module) {
  console.log("🎮 Bomberman Bot - Zinza Hackathon 2025");
  console.log("📋 AI Strategies:");

  const strategies = bot.getAIInfo();
  strategies.forEach((strategy) => {
    console.log(`  - ${strategy.name}: Priority ${strategy.priority}`);
  });

  // Example game data processing
  const exampleGameData = {
    map: {
      width: 640,
      height: 640,
      walls: [
        { x: 40, y: 40, destructible: false },
        { x: 80, y: 40, destructible: true },
      ],
      items: [{ id: "1", x: 120, y: 80, type: "SPEED" }],
      bombs: [],
      bots: [
        {
          id: "bot1",
          x: 0,
          y: 0,
          speed: 1,
          bombCount: 1,
          flameRange: 2,
          isAlive: true,
          score: 0,
        },
      ],
    },
    currentBotId: "bot1",
    timeRemaining: 300000,
    round: 1,
  };

  console.log("🎯 Example decision:", bot.processGameData(exampleGameData));
}
