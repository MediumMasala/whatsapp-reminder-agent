FROM node:20-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema BEFORE npm install
COPY prisma ./prisma

# Install dependencies (this will run postinstall → prisma generate)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema BEFORE npm install
COPY prisma ./prisma

# Install production dependencies (this will run postinstall → prisma generate)
RUN npm ci --only=production

# Copy built application
COPY --from=base /app/dist ./dist

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
