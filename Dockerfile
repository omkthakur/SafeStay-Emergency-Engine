# Stage 1: Build the React application
FROM node:20-alpine as build-stage

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all files and build the project
COPY . .
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:stable-alpine

# Copy the build output to Nginx's html directory
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration if needed (handling client-side routing)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port (Cloud Run uses 80 by default or $PORT)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
