import "dotenv/config";
// Build timestamp: 2026-02-10T01:10:00Z - Add response compression for production
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedSampleUsers } from "./db";
import { startFollowUpWorker } from "./follow-up-system";
import { registerVoiceReceptionistRoutes } from "./voice-receptionist";
import { storage } from "./storage";

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '10mb', // Increased to handle PDF attachments for receipts
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const jsonStr = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${jsonStr.length > 200 ? jsonStr.slice(0, 200) + '...[truncated]' : jsonStr}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  
  registerVoiceReceptionistRoutes(app);
  
  // Seed sample users on startup (ensures they exist in production)
  try {
    await seedSampleUsers();
  } catch (error) {
    console.error("Failed to seed users:", error);
  }
  
  // Start background follow-up worker
  startFollowUpWorker();
  
  // Auto-archive completed jobs older than 2 weeks (check every hour)
  const runAutoArchive = async () => {
    try {
      const allJobs = await storage.getAllJobs();
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      let count = 0;
      for (const job of allJobs) {
        if (job.pipelineStage === "paid_completed" && job.completedAt) {
          if (new Date(job.completedAt) < twoWeeksAgo) {
            await storage.updateJob(job.id, { pipelineStage: "archived" });
            count++;
          }
        }
      }
      if (count > 0) console.log(`[AutoArchive] Archived ${count} completed jobs older than 2 weeks`);
    } catch (err: any) {
      console.error("[AutoArchive] Error:", err.message);
    }
  };
  runAutoArchive();
  setInterval(runAutoArchive, 60 * 60 * 1000);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
