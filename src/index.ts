import dotenv from "dotenv";
import { BomberManBot } from "./bombermanBot";
import { SocketConnection } from "./connection/socketConnection";

// Load environment variables
dotenv.config();

/**
 * Entry point của ứng dụng
 */

// Export để sử dụng ở nơi khác
export { BomberManBot };
export { SocketConnection };
export * from "./types";
export * from "./ai";
export * from "./game";
export * from "./strategies";
export * from "./utils";

/**
 * Main function - Khởi chạy bot với Socket.IO
 */
async function main() {
  console.log("🎮 Bomberman Bot - Zinza Hackathon 2025");
  console.log("=".repeat(50));

  // Lấy cấu hình từ environment variables
  const serverAddress =
    process.env.SOCKET_SERVER || "https://zarena-dev4.zinza.com.vn";
  const botToken = process.env.BOT_TOKEN || "";

  if (!botToken) {
    console.error("❌ Lỗi: Chưa cấu hình BOT_TOKEN trong file .env");
    process.exit(1);
  }

  console.log(`🌐 Server: ${serverAddress}`);
  console.log(`🔑 Token: ${botToken.substring(0, 10)}...`);
  console.log("=".repeat(50));

  const bot = new BomberManBot(serverAddress, botToken);

  // Xử lý tắt chương trình gracefully
  const shutdown = () => {
    console.log("\n🛑 Đang tắt bot...");
    bot.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    // Khởi tạo và kết nối bot
    await bot.initialize();

    console.log("✅ Bot đã sẵn sàng!1");
    console.log("📋 AI Strategies:");

    const strategies = bot.getAIInfo();
    strategies.forEach((strategy) => {
      console.log(`  - ${strategy.name}: Priority ${strategy.priority}`);
    });
  } catch (error) {
    console.error("❌ Lỗi khởi tạo bot:", error);
    process.exit(1);
  }
}

// Chạy bot nếu file được execute trực tiếp
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Lỗi không mong đợi:", error);
    process.exit(1);
  });
}
