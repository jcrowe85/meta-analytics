# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create cache and logs directories
RUN mkdir -p cache logs

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]

