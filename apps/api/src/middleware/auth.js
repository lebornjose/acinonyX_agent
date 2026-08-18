import { env } from "../config/env.js";
export function requireUser(req, _res, next) { req.user = { id: env.demoUserId }; next(); }
export function requireAdmin(req, _res, next) { req.admin = { id: "demo-admin", role: "admin" }; next(); }
