# ------------------------------------------------------------
# For development
# ------------------------------------------------------------
up:
	docker compose up -d
up-build:
	@echo "Killing process on port 3000 and 3001 if they exist..."
	@if lsof -i :3000 -t >/dev/null 2>&1 ; then kill -9 $$(lsof -i :3000 -t) ; fi
	@if lsof -i :3001 -t >/dev/null 2>&1 ; then kill -9 $$(lsof -i :3001 -t) ; fi
	@echo "Starting Docker Compose..."
	docker-compose up -d --build
build:
	docker compose build --no-cache --force-rm
stop:
	docker compose stop
down:
	@echo "Killing process on port 3000 and 3001 if they exist..."
	@if lsof -i :3000 -t >/dev/null 2>&1 ; then kill -9 $$(lsof -i :3000 -t) ; fi
	@if lsof -i :3001 -t >/dev/null 2>&1 ; then kill -9 $$(lsof -i :3001 -t) ; fi
	@echo "Starting Docker Compose..."
	docker compose down --remove-orphans
restart:
	@make down
	@make up
logs:
	docker compose logs
ps:
	docker compose ps
api:
	docker container exec -it api_attendance /bin/sh
api-renpm-i:
	docker container exec -it api_attendance rm -rf node_modules package-lock.json && npm install
api-npm-i:
	docker container exec -it api_attendance npm install
api-npm-dev:
	docker container exec -it api_attendance npm run dev
api-npm-build:
	docker container exec -it api_attendance npm run build
squelize-migrate:
	docker container exec -it api_attendance npx sequelize-cli db:migrate
squelize-seed:
	docker container exec -it api_attendance npx sequelize-cli db:seed:all