# Stage 1: Build the React application
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Run the Secure Node.js Server
FROM node:20-alpine
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --production
RUN npm install express cors @google/generative-ai

# Copy the built frontend from Stage 1
COPY --from=build-stage /app/dist ./dist

# Copy the backend server script
COPY server.js ./

# Cloud Run uses the PORT environment variable
EXPOSE 8080

# Start the secure proxy server
CMD ["node", "server.js"]
