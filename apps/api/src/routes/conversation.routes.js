import { Router } from "express";
import { requireUser } from "../middleware/auth.js";
import { list, create, detail, remove, sendMessage, streamMessage } from "../controllers/conversation.controller.js";
const router = Router();

router.use(requireUser);
router.get("/", list);
router.post("/", create);
router.get("/:id", detail);
router.delete("/:id", remove);
router.post("/:id/messages", sendMessage);
router.post("/:id/messages/stream", streamMessage);
export default router;
