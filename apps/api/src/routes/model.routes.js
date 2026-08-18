import { Router } from "express";
import { requireUser } from "../middleware/auth.js";
import { models } from "../controllers/public-model.controller.js";

const router = Router();

router.use(requireUser);
router.get("/", models);

export default router;
