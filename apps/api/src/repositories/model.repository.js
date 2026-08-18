import { pool } from "../database/mysql.js";
import { generateId } from "../utils/id.js";
import { nowUnixSeconds } from "../utils/time.js";

const publicFields = "id, name, provider, model_name AS model, endpoint, status, thinking_mode AS thinkingMode, created_at AS createdAt, updated_at AS updatedAt";

function normalizeModel(model) {
  if (model && /^\d+$/.test(String(model.model))) {
    return { ...model, model: model.name };
  }
  return model;
}

export async function listModels() {
  const [rows] = await pool.query(`SELECT ${publicFields} FROM custom_models ORDER BY created_at DESC`);
  return rows.map(normalizeModel);
}

export async function listActiveModels() {
  const [rows] = await pool.query(`SELECT ${publicFields} FROM custom_models WHERE status = 'active' ORDER BY created_at DESC`);
  return rows.map(normalizeModel);
}

export async function findActiveModel(id) {
  const [rows] = await pool.query("SELECT id, name, provider, model_name AS model, endpoint, api_key AS apiKey, status, thinking_mode AS thinkingMode FROM custom_models WHERE id = ? AND status = 'active'", [id]);
  return normalizeModel(rows[0]);
}

export async function createModel(input) {
  const id = generateId();
  const timestamp = nowUnixSeconds();
  await pool.query("INSERT INTO custom_models (id, name, provider, model_name, endpoint, api_key, thinking_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, input.name, input.provider, input.model, input.endpoint, input.apiKey, input.thinkingMode, timestamp, timestamp]);
  const [rows] = await pool.query(`SELECT ${publicFields} FROM custom_models WHERE id = ?`, [id]);
  return rows[0];
}

export async function updateModel(id, input) {
  const timestamp = nowUnixSeconds();
  const fields = [
    "name = ?",
    "provider = ?",
    "model_name = ?",
    "endpoint = ?",
    "thinking_mode = ?",
    "updated_at = ?"
  ];
  const values = [
    input.name,
    input.provider,
    input.model,
    input.endpoint,
    input.thinkingMode,
    timestamp
  ];

  if (input.apiKey) {
    fields.push("api_key = ?");
    values.push(input.apiKey);
  }

  values.push(id);
  const [result] = await pool.query(
    `UPDATE custom_models SET ${fields.join(", ")} WHERE id = ?`,
    values
  );
  if (!result.affectedRows) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT ${publicFields} FROM custom_models WHERE id = ?`,
    [id]
  );
  return rows[0];
}
