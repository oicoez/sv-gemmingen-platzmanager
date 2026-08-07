FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev     && npx playwright install --with-deps chromium

COPY . .

ENV PORT=10000
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

EXPOSE 10000
CMD ["npm","start"]
