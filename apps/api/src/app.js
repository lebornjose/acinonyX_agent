import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import modelRoutes from "./routes/model.routes.js";
import { requireUser } from "./middleware/auth.js";
import { me } from "./controllers/auth.controller.js";
import { errorHandler } from "./middleware/error-handler.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const apiRoot = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(apiRoot, "../public");

app.use(cors());
app.use(express.json());
app.use("/admin", express.static(path.join(publicRoot, "admin")));
app.use("/web", express.static(path.join(publicRoot, "web")));
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.get("/api/me", requireUser, me);
app.use("/api/conversations", conversationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/models", modelRoutes);
app.use(errorHandler);
export default app;
