import "dotenv/config";
import app from "./app.js";
import { initDatabase, closeDatabase } from "./database/mysql.js";
import { env } from "./config/env.js";

const port = Number(process.env.API_PORT || 4001);
try {
  console.log(`环境配置：${env.mysql.host}:${env.mysql.port}/${env.mysql.database}（用户：${env.mysql.user}，密码：${env.mysql.password ? "已设置" : "未设置"}）`);
  await initDatabase();
  const server = app.listen(port, () => console.log(`业务 API：http://localhost:${port}`));
  const shutdown = async () => { server.close(); await closeDatabase(); process.exit(0); };
  process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
} catch (error) {
  console.error("API 启动失败：", error.message);
  process.exit(1);
}
