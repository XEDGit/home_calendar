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
dev:
	docker-compose --env-file .common.env -f compose.yaml -f compose.dev.yaml up --build -d

# k3s (frontend + backend; see scripts/deploy-k3s.sh). `deploy` ships only
# what changed since the images the cluster runs. ALLOW_DIRTY=1 builds
# uncommitted changes as a preview, SKIP_TESTS=1 skips npm test, DRY_RUN=1
# prints the steps.
deploy:
	scripts/deploy-k3s.sh changed
deploy-all:
	scripts/deploy-k3s.sh all
deploy-frontend:
	scripts/deploy-k3s.sh frontend
deploy-backend:
	scripts/deploy-k3s.sh backend

.PHONY: deploy deploy-all deploy-frontend deploy-backend
