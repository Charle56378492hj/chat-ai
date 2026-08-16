FROM node:22-bookworm-slim
WORKDIR /app

# baileys يحتاج بعض أدوات النظام لفك تشفير/معالجة الوسائط
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates ffmpeg git \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

ENV NODE_ENV=production
ENV PORT=8088
EXPOSE 8088

CMD ["node", "src/index.js"]
