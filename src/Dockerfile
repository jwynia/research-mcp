# Multi-stage build for smaller final image
FROM node:20-alpine AS builder

WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built app from builder stage
COPY --from=builder /build/dist ./dist
# Copy necessary files
COPY .env.example ./.env.example

# Create and set permissions for data directories
RUN mkdir -p ./research-archive ./url-content-archive \
    && chown -R node:node /app

# Use non-root user for security
USER node

# Set environment variables
ENV NODE_ENV=production

# Expose the port
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3100/health || exit 1

# Run the app
CMD ["node", "dist/index.js"]
