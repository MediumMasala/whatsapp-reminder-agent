FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Copy Prisma schema BEFORE installing dependencies
COPY prisma ./prisma

# Install all dependencies (including Prisma)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start application (runs migrations and starts server)
CMD ["npm", "start"]
