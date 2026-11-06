FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
COPY test ./test
COPY scripts ./scripts
COPY sql ./sql
EXPOSE 3001
CMD ["npm", "run", "dev"]
