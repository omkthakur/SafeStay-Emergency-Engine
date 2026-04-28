# Stage 1: Build the React application
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Inject Firebase keys into the Vite build
ARG _VITE_FIREBASE_API_KEY
ARG _VITE_FIREBASE_AUTH_DOMAIN
ARG _VITE_FIREBASE_PROJECT_ID
ARG _VITE_FIREBASE_STORAGE_BUCKET
ARG _VITE_FIREBASE_MESSAGING_SENDER_ID
ARG _VITE_FIREBASE_APP_ID
ARG _VITE_FIREBASE_MEASUREMENT_ID

ENV VITE_FIREBASE_API_KEY=$_VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$_VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$_VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$_VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$_VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$_VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_MEASUREMENT_ID=$_VITE_FIREBASE_MEASUREMENT_ID
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
