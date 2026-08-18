import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiDirectory = path.resolve(configDirectory, "../..");
const repositoryRoot = path.resolve(configDirectory, "../../../..");

dotenv.config({
  path: path.join(repositoryRoot, ".env")
});
dotenv.config({
  path: path.join(apiDirectory, ".env"),
  override: true
});

export const env = {
  port: Number(process.env.API_PORT || 4001),
  agentServiceUrl: process.env.AGENT_SERVICE_URL || "http://localhost:4002",
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "agent_platform",
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10)
  },
  demoUserId: process.env.DEMO_USER_ID || "demo-user"
};
