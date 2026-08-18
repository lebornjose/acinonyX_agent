import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { users, conversations } from "../controllers/admin.controller.js";
import { models, create, update } from "../controllers/model.controller.js";
const router = Router();

router.use(requireAdmin);
router.get("/users", users);
router.get("/conversations", conversations);
router.get("/models", models);
router.post("/models", create);
router.put("/models/:id", update);
export default router;
