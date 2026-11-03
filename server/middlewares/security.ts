import helmet from "helmet";
import cors from "cors";
import { RequestHandler } from "express";

/**
 * Helmet configuration tailored for full-stack Vite development & production
 */
export const helmetMiddleware: RequestHandler = helmet({
  contentSecurityPolicy: false, // Vite injects scripts dynamically in development
  crossOriginEmbedderPolicy: false
});

/**
 * CORS configuration restricting origins or defaulting to local dev
 */
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : ["*"];

export const corsMiddleware: RequestHandler = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS policy violation: origin not allowed"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
});
