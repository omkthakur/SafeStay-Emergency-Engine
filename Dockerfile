# Stage 1: Build the React application
FROM node:20-alpine as build-stage

# Pass build arguments into environment variables for Vite
ARG _VITE_GEMINI_API_KEY
ARG _VITE_FIREBASE_API_KEY
ARG _VITE_FIREBASE_AUTH_DOMAIN
ARG _VITE_FIREBASE_PROJECT_ID
ARG _VITE_FIREBASE_STORAGE_BUCKET
ARG _VITE_FIREBASE_MESSAGING_SENDER_ID
ARG _VITE_FIREBASE_APP_ID
ARG _VITE_FIREBASE_MEASUREMENT_ID

# Set them as environment variables so Vite can see them
ENV VITE_GEMINI_API_KEY=$_VITE_GEMINI_API_KEY
ENV VITE_FIREBASE_API_KEY=$_VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$_VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$_VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$_VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$_VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$_VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_MEASUREMENT_ID=$_VITE_FIREBASE_MEASUREMENT_ID

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:stable-alpine
COPY --from=build-stage /app/dist /usr/share/nginx/html
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["/bin/sh", "-c", "sed -i 's/listen 80;/listen '\"${PORT:-8080}\"';/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
