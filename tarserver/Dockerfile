FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && rm -rf node_modules/@rivet-dev/agentos-* node_modules/@rivet-dev/agent-os-* node_modules/@agentos-software node_modules/@rivetkit/engine-cli-*
COPY index.ts .
ENV NODE_ENV=production
CMD ["node", "index.ts"]
