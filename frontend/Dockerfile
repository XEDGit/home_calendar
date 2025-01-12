FROM node:latest

WORKDIR /app

RUN apt-get -y update && apt-get -y upgrade

# Copy package and package-lock files
COPY ./package* /app/

RUN npm i
