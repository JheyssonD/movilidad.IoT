# Stage 1: build Angular SPA
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG API_BASE_URL=http://localhost:5100
RUN printf '{"apiUrl":"%s"}' "$API_BASE_URL" > src/assets/config.json

RUN npm run build

# Stage 2: serve with nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/simon-movilidad-iot-frontend /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
