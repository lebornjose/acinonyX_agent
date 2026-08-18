import { findUser } from "../repositories/user.repository.js";
export function login(_req, res, next) { findUser("demo-user").then((user) => res.json({ token: "demo-token", user })).catch(next); }
export function me(req, res, next) { findUser(req.user.id).then(res.json.bind(res)).catch(next); }
