all:
	docker-compose --env-file .common.env up --build -d
run:
	docker-compose --env-file .common.env up --build
build:
	docker-compose build --no-cache
down:
	docker-compose down
logs:
	docker-compose logs -f
# clean: down
# 	docker-compose down -v
