FROM node:20-alpine

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
