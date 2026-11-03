# ===================================================
# QUANTEX Terminal - Production Multi-Stage Dockerfile
# Optimized for Node.js 22 Alpine (Ultra-light, secure, minimal attack surface)
# ===================================================

# --- STAGE 1: Build Stage ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install native build tools
RUN apk add --no-cache libc6-compat python3 make g++ git

# Copy dependency definitions
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies required for bundling)
RUN npm ci --prefer-offline --no-audit

# Copy source code and configuration files
COPY . .

# Build Vite client and bundle server.ts with esbuild into self-contained dist/server.cjs
RUN npm run build

# Prune devDependencies to keep only lean production dependencies
RUN npm prune --production

# --- STAGE 2: Production Runtime Stage ---
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Add non-root system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Create persistent data directory and set permissions
RUN mkdir -p /app/data && chown -R appuser:nodejs /app/data

# Copy strictly required production artifacts (NO source files, NO /server folder, NO /src)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Ensure proper ownership
RUN chown -R appuser:nodejs /app

# Switch to secure non-root user
USER appuser

# Expose server port
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start production server
CMD ["node", "dist/server.cjs"]
