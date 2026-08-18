import mysql from "mysql2/promise";
import { env } from "../config/env.js";
import { nowUnixSeconds } from "../utils/time.js";

export const pool = mysql.createPool({ ...env.mysql, waitForConnections: true });
export async function initDatabase() {
  console.log(`MySQL 连接：${env.mysql.user}@${env.mysql.host}:${env.mysql.port}/${env.mysql.database}`);
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id VARCHAR(64) PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL DEFAULT '', nickname VARCHAR(100), status VARCHAR(32) NOT NULL DEFAULT 'active', created_at BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS conversations (id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, title VARCHAR(255) NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, INDEX (user_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS messages (id VARCHAR(64) PRIMARY KEY, conversation_id VARCHAR(64) NOT NULL, role VARCHAR(32) NOT NULL, content TEXT NOT NULL, created_at BIGINT NOT NULL, INDEX (conversation_id), FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS custom_models (id VARCHAR(64) PRIMARY KEY, name VARCHAR(100) NOT NULL, provider VARCHAR(64) NOT NULL, model_name VARCHAR(150) NOT NULL, endpoint VARCHAR(500) NOT NULL, api_key TEXT NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'active', created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, UNIQUE KEY custom_models_provider_model (provider, model_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [thinkingColumns] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = ?
       AND table_name = 'custom_models'
       AND column_name = 'thinking_mode'`,
    [env.mysql.database]
  );
  if (Number(thinkingColumns[0].count) === 0) {
    await pool.query(
      "ALTER TABLE custom_models ADD COLUMN thinking_mode VARCHAR(16) NOT NULL DEFAULT 'disabled'"
    );
  }
  await pool.query("INSERT IGNORE INTO users (id, email, nickname, created_at) VALUES (?, ?, ?, ?)", [env.demoUserId, "demo@example.com", "体验用户", nowUnixSeconds()]);
}
export const closeDatabase = () => pool.end();
