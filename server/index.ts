import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import feedRouter from "./routes/feed";
import authRouter from "./routes/auth";
import groupsRouter from "./routes/groups";

async function startServer() {
  const app = express();
  
  // Use port 3000 as mandated by container constraints. 
  // Supports fallback to 3001 if explicitly run on local system by developer, 
  // but defaults to 3000 for AI Studio hosting environment.
  const PORT = parseInt(process.env.PORT || "3000");

  // Basic Middlewares
  app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true
  }));
  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ success: true, data: { status: "Awaaz API is healthy" } });
  });

  // Mount API Routes
  app.use("/api/feed", feedRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/groups", groupsRouter);

  // Configure Vite Middleware for SPA Frontend
  if (process.env.NODE_ENV !== "production") {
    console.log("Configuring Vite dev server middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static files in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to 0.0.0.0 for container accessibility
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
