import rateLimit from "express-rate-limit";

/**
 * General API rate limiter (protects against DDoS / query floods)
 */
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // limit each IP to 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    error: "Слишком много запросов. Пожалуйста, подождите минуту перед повторной попыткой.",
    code: "RATE_LIMIT_EXCEEDED"
  }
});

/**
 * Strict rate limiter for authentication endpoints (prevents password brute forcing)
 */
export const authApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // limit each IP to 15 auth attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    error: "Слишком много попыток входа. Пожалуйста, подождите 1 минуту.",
    code: "AUTH_RATE_LIMIT_EXCEEDED"
  }
});
