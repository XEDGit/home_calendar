# Self-contained backend image (k3s). TLS keys are NOT baked in:
# they're mounted at /app/keys from a Secret.
FROM node:24.22.0
WORKDIR /app
COPY ./package* /app/
RUN npm ci --omit=dev
COPY . /app/
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "backend.js"]
