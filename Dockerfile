FROM node:22-alpine

WORKDIR /app

# ثبّت المكتبات أول عشان الـ cache يشتغل
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

CMD ["node", "index.js"]
