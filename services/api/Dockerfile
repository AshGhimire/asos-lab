# 1. The Base Layer
# "Start with a lightweight Linux machine that has Node.js 20 installed"
FROM node:20-alpine AS builder

# 2. Preparation
# "Go to the /app folder"
WORKDIR /app

# "Enable pnpm" (a faster npm)
RUN corepack enable && corepack prepare pnpm@latest --activate

# 3. Dependencies
# We copy this first so Docker can cache the installed modules if package.json hasn't changed.
COPY package.json tsconfig.json tsconfig.build.json ./

# (install libraries)
RUN pnpm install --no-frozen-lockfile

# 4. The Code
COPY src ./src
COPY public ./public
COPY data ./data
COPY index.html vite.config.ts ./

# (Compile TypeScript to JavaScript)
RUN pnpm build

# --- Runtime Stage (Serving) ---
# We do this to keep the final image small (no source code, no dev tools).
FROM node:20-alpine AS runner

WORKDIR /app

# Copy only the built backend files
COPY --from=builder /app/dist ./dist

# Copy the BUILT frontend assets to /app/public (where server.ts expects them)
# Vite output is in /app/dist/public, we move it to /app/public
COPY --from=builder /app/dist/public ./public

# Copy node_modules needed for production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/data ./data

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "dist/server.js"]
