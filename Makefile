all:
	docker-compose --env-file .common.env up --build
build:
	docker-compose build --no-cache
down:
	docker-compose down
# clean: down
# 	docker-compose down -v
