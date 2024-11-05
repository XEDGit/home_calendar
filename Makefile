all:
	docker-compose --env-file .env up --build
down:
	docker-compose down
clean: down
	docker-compose down -v
