# --- Stage 1: Build the React Client ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root configurations
COPY package*.json ./

# Copy client configurations and source code
COPY client/package*.json ./client/
COPY client/ ./client/

# Install dependencies and build client
RUN cd client && npm ci && npm run build


# --- Stage 2: Build the Node.js Server Environment ---
FROM node:20-alpine

# Install required OS-level dependencies (git is needed by CodeLens to clone repos)
RUN apk add --no-cache git

WORKDIR /app

# Copy root config
COPY package*.json ./

# Install ONLY production root dependencies (express, cors, dotenv)
RUN npm ci --omit=dev

# Copy the server source code
COPY server/ ./server/
# Copy the built React UI from the builder stage
COPY --from=builder /app/client/dist ./client/dist

# Expose the API and UI port
EXPOSE 3001

# Set the node environment to production so Express serves the built React app
ENV NODE_ENV=production
ENV PORT=3001

# Start the monolithic server
CMD ["node", "server/index.js"]
