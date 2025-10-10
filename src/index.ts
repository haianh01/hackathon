import dotenv from "dotenv";
import { BomberManBot } from "./bombermanBot";
import { SocketConnection } from "./connection/socketConnection";

dotenv.config();

export { BomberManBot };
export { SocketConnection };
export * from "./types";
export * from "./ai";
export * from "./game";
export * from "./strategies";
export * from "./utils";

async function main() {
  console.log("🎮 Bomberman Bot - Zinza Hackathon 2025");
  const serverAddress =
    process.env.SOCKET_SERVER || "https://zarena-dev4.zinza.com.vn";
  const botToken = process.env.BOT_TOKEN || "";
  const bot = new BomberManBot(serverAddress, botToken);

  const shutdown = () => {
    console.log("\n🛑 Đang tắt bot...");
    bot.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    await bot.initialize();
  } catch (error) {
    console.error("❌ Lỗi khởi tạo bot:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Lỗi không mong đợi:", error);
    process.exit(1);
  });
}
