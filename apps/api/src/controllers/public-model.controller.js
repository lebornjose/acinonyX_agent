import { listActiveModels } from "../repositories/model.repository.js";

export async function models(_req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await listActiveModels());
  } catch (error) {
    next(error);
  }
}
