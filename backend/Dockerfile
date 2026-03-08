FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/
COPY docs-public ./docs-public/
COPY scripts ./scripts/

EXPOSE 3001
CMD ["sh", "scripts/start.sh"]
