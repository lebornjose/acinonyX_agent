import { Router } from "express";
import { pool } from "../database/mysql.js";
const router = Router();
router.get("/", async (_req, res, next) => { try { await pool.query("SELECT 1"); res.json({ ok: true, service: "api", database: "mysql" }); } catch (error) { next(error); } });
export default router;
