# Multi-stage Dockerfile for Bomberman Bot (TypeScript -> JavaScript)
# Hackathon 2025 - Socket.IO based bot

# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . ./
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy package files and install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Create public directory (optional, might be needed by some components)
RUN mkdir -p ./public

# Default command runs the bot
CMD ["node", "dist/index.js"]
