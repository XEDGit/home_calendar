FROM node:latest

WORKDIR /app

RUN apt-get -y update && apt-get -y upgrade

COPY ./package* /app/

EXPOSE 3000

RUN npm i