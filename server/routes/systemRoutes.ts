import { Router, Request, Response } from "express";
import os from "os";
import { stateManager } from "../state/StateManager";
import { safeGitService } from "../services/gitService";
import { requireRole } from "../middlewares/auth";
import { validateBody, gitInitSchema, gitPullSchema } from "../models/schemas";

const router = Router();
const serverStartTime = Date.now();

/**
 * GET /api/health
 * Public healthcheck endpoint used by Docker / monitoring
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "QUANTEX-terminal",
    uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    timestamp: new Date().toISOString(),
    system: {
      loadAvg: os.loadavg(),
      freeMemMb: Math.round(os.freemem() / 1024 / 1024),
      totalMemMb: Math.round(os.totalmem() / 1024 / 1024)
    }
  });
});

/**
 * GET /api/system/git-status
 * Safe Git repository status check (Admin only)
 */
router.get("/system/git-status", requireRole(["admin"]), async (req: Request, res: Response) => {
  try {
    const status = await safeGitService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/system/git-pull
 * Safe Git pull without shell command interpolation (Admin only)
 */
router.post(
  "/system/git-pull",
  requireRole(["admin"]),
  validateBody(gitPullSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await safeGitService.pullAndDeploy(req.body);
      if (!result.success) {
        stateManager.addLog("ERROR", `Сбой обновления через Git: ${result.error}`);
        return res.status(500).json(result);
      }
      stateManager.addLog("INFO", `Программа успешно обновлена через Git Pull (${result.commit || "latest"})`);
      res.json(result);
    } catch (err: any) {
      stateManager.addLog("ERROR", `Исключение при обновлении: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * POST /api/system/git-init-repo
 * Safe Git repo initialization (Admin only)
 */
router.post(
  "/system/git-init-repo",
  requireRole(["admin"]),
  validateBody(gitInitSchema),
  async (req: Request, res: Response) => {
    try {
      const { repoUrl } = req.body;
      const result = await safeGitService.initRepo(repoUrl);
      if (!result.success) {
        return res.status(400).json(result);
      }
      stateManager.addLog("INFO", `Git репозиторий успешно инициализирован: ${repoUrl}`);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/server/logs
 * Retrieve server activity logs (Admin only)
 */
router.get("/server/logs", requireRole(["admin"]), (req: Request, res: Response) => {
  res.json({
    success: true,
    logs: stateManager.getLogs()
  });
});

export const systemRoutes = router;
