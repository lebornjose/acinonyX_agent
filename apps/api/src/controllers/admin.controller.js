import { listUsers } from "../repositories/user.repository.js";
import { listAll } from "../repositories/conversation.repository.js";
export async function users(_req, res, next) {
  try {
    res.json(await listUsers());
  } catch (error) {
    next(error);
  }
}

export async function conversations(_req, res, next) {
  try {
    res.json(await listAll());
  } catch (error) {
    next(error);
  }
}
