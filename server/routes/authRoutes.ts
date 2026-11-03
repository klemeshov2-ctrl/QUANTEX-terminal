import { Router, Request, Response } from "express";
import { stateManager } from "../state/StateManager";
import { getAdminPassword, maskSecret } from "../services/secretsService";
import { hashPassword, comparePassword, signJwtToken, requireRole } from "../middlewares/auth";
import { authApiLimiter } from "../middlewares/rateLimiter";
import { validateBody, authVerifySchema, changePasswordSchema } from "../models/schemas";

const router = Router();

/**
 * POST /api/auth/verify
 * Validates credentials using bcrypt and issues JWT token
 */
router.post(
  "/verify",
  authApiLimiter,
  validateBody(authVerifySchema),
  async (req: Request, res: Response) => {
    try {
      const { password, username } = req.body;
      const masterPass = getAdminPassword();

      const users = stateManager.getStationUsers();

      if (username) {
        const user = users.find(
          u => u.username.toLowerCase() === String(username).trim().toLowerCase()
        );
        if (!user) {
          return res.status(401).json({ success: false, error: "Пользователь не найден" });
        }

        const isMaster = user.role === "admin" && (await comparePassword(password, masterPass));
        const userPassValid = user.password ? await comparePassword(password, user.password) : false;

        if (!userPassValid && !isMaster) {
          return res.status(401).json({ success: false, error: "Неверный пароль пользователя" });
        }

        const allowedTabs = user.role === "admin" && !user.allowedTabs.includes("settings")
          ? [...user.allowedTabs, "settings"]
          : user.allowedTabs;

        const authPayload = {
          id: user.id,
          username: user.username,
          role: user.role,
          allowedTabs
        };

        const token = signJwtToken(authPayload);
        stateManager.addLog("INFO", `Пользователь ${user.username} успешно авторизован по JWT`);
        res.setHeader("Set-Cookie", `quantex_auth_token=${token}; Path=/; SameSite=Lax; Max-Age=604800`);

        return res.json({
          success: true,
          authenticated: true,
          token,
          user: authPayload
        });
      }

      // Master password login
      const isMasterValid = await comparePassword(password, masterPass);
      if (isMasterValid) {
        const adminUser = users.find(u => u.role === "admin") || {
          id: "usr-admin",
          username: "admin",
          role: "admin" as const,
          allowedTabs: ["chart", "gex", "calendar", "editor", "journal", "settings", "ai_learning"],
          createdAt: "2026-10-21"
        };

        const authPayload = {
          id: adminUser.id,
          username: adminUser.username,
          role: "admin" as const,
          allowedTabs: adminUser.allowedTabs
        };

        const token = signJwtToken(authPayload);
        stateManager.addLog("INFO", "Администратор успешно авторизован по мастер-паролю (выдан JWT токен)");
        res.setHeader("Set-Cookie", `quantex_auth_token=${token}; Path=/; SameSite=Lax; Max-Age=604800`);

        return res.json({
          success: true,
          authenticated: true,
          token,
          user: authPayload
        });
      }

      return res.status(401).json({ success: false, error: "Неверный пароль доступа к серверу" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/auth/status
 * Public status endpoint
 */
router.get("/status", (req: Request, res: Response) => {
  const users = stateManager.getStationUsers();
  const publicUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    allowedTabs: u.allowedTabs,
    createdAt: u.createdAt
  }));

  res.json({
    requirePasswordAuth: true,
    isDefaultPassword: false, // Default admin123 is strictly disallowed
    users: publicUsers
  });
});

/**
 * POST /api/auth/change-password
 * Admin-only: changes master password with bcrypt hashing
 */
router.post(
  "/change-password",
  requireRole(["admin"]),
  validateBody(changePasswordSchema),
  async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const masterPass = getAdminPassword();

      const isCurrentValid = await comparePassword(currentPassword, masterPass);
      if (!isCurrentValid) {
        return res.status(401).json({ success: false, error: "Текущий пароль указан неверно" });
      }

      const hashedNew = await hashPassword(newPassword);
      process.env.ADMIN_PASSWORD = newPassword;

      // Update admin user account
      const users = stateManager.getStationUsers();
      if (users.length > 0) {
        users[0].password = hashedNew;
        await stateManager.setStationUsers(users);
      }

      stateManager.addLog("INFO", "Мастер-пароль администратора успешно изменен и хеширован bcrypt");
      return res.json({ success: true, message: "Пароль успешно обновлен" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

export const authRoutes = router;
