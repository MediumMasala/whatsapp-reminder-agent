FROM node:20-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema
COPY prisma ./prisma

# Install all dependencies
RUN npm ci

# Explicitly generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema
COPY prisma ./prisma

# Install production dependencies only
RUN npm ci --only=production

# Explicitly generate Prisma client for production
RUN npx prisma generate

# Copy built application from base stage
COPY --from=base /app/dist ./dist

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
