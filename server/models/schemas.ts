import { z } from "zod";
import { Request, Response, NextFunction } from "express";

export const authVerifySchema = z.object({
  password: z.string().min(1, "Пароль обязателен для ввода"),
  username: z.string().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Текущий пароль обязателен"),
  newPassword: z.string().min(6, "Новый пароль должен содержать минимум 6 символов")
});

export const gitInitSchema = z.object({
  repoUrl: z.string().url("Укажите корректный URL").refine(u => u.includes("github.com"), {
    message: "Разрешены только репозитории GitHub"
  }),
  branch: z.string().optional()
});

export const gitPullSchema = z.object({
  autoBuild: z.boolean().optional(),
  autoInstall: z.boolean().optional(),
  stashLocal: z.boolean().optional()
});

export const stationUserSettingsSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      username: z.string().min(1),
      password: z.string().optional(),
      role: z.enum(["admin", "user"]),
      allowedTabs: z.array(z.string()),
      createdAt: z.string().optional()
    })
  ).optional(),
  userPreferences: z.record(z.string(), z.any()).optional()
});

/**
 * Express middleware helper to validate request bodies against Zod schemas
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await schema.safeParseAsync(req.body);
    if (!result.success) {
      const errorMsg = result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ");
      return res.status(400).json({
        success: false,
        error: `Ошибка валидации данных: ${errorMsg}`,
        details: result.error.format()
      });
    }
    req.body = result.data;
    next();
  };
}
