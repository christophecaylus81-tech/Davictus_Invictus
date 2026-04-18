FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npm run migrate && npm run start"]
