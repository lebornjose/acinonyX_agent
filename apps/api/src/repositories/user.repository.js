import { pool } from "../database/mysql.js";
export async function findUser(id) { const [rows] = await pool.query("SELECT id, email, nickname, status, created_at AS createdAt FROM users WHERE id = ?", [id]); return rows[0]; }
export async function listUsers() { const [rows] = await pool.query("SELECT id, email, nickname, status, created_at AS createdAt FROM users ORDER BY created_at DESC"); return rows; }
