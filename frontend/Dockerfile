FROM node:23.11.0 AS build

WORKDIR /app

RUN apt-get -y update && apt-get -y upgrade

# Copy package and package-lock files
COPY ./package* /app/

RUN npm ci

COPY . /app/
RUN npm run build

# Production image: the adapter-node server plus runtime dependencies only
FROM node:23.11.0

WORKDIR /app

COPY ./package* /app/
RUN npm ci --omit=dev

COPY --from=build /app/build /app/build

ENV NODE_ENV=production
CMD ["node", "build"]
