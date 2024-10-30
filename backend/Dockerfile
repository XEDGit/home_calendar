FROM node:latest

WORKDIR /app

RUN apt-get -y update && apt-get -y upgrade

COPY ./package* /app/

RUN npm i

EXPOSE 3000
