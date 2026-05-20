FROM node:18-alpine AS build-step
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build --configuration=production

FROM nginx:1.21-alpine
COPY --from=build-step /app/dist/simon-movilidad-iot-frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
