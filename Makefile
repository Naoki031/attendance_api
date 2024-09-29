# ------------------------------------------------------------
# For development
# ------------------------------------------------------------
dockerName=attendance_api
dataSource=src/core/database/data-source.ts
migrationDir=src/core/database/migrations
seedDir=src/core/database/seeds

up:
	@echo "Killing process on ports 3000 and 3001 if they exist..."
	@if lsof -i :3000 -t >/dev/null 2>&1 ; then kill -9 $$(lsof -i :3000 -t) ; fi
	@if lsof -i :3001 -t >/dev/null 2>&1 ; then kill -9 $$(lsof -i :3001 -t) ; fi
	@echo "Starting Docker Compose with build..."
	docker compose up -d

up-build:
	@echo "Killing process on ports 3000 and 3001 if they exist..."
	@if lsof -i :3000 -t >/dev/null 2>&1 ; then kill -9 $$(lsof -i :3000 -t) ; fi
	@if lsof -i :3001 -t >/dev/null 2>&1 ; then kill -9 $$(lsof -i :3001 -t) ; fi
	@echo "Starting Docker Compose with build..."
	docker compose up -d --build

build:
	docker compose build --no-cache --force-rm

stop:
	docker compose stop

down:
	@echo "Killing process on ports 3000 and 3001 if they exist..."
	@if lsof -i :3000 -t >/dev/null 2>&1 ; then kill -9 $$(lsof -i :3000 -t) ; fi
	@if lsof -i :3001 -t >/dev/null 2>&1 ; then kill -9 $$(lsof -i :3001 -t) ; fi
	@echo "Bringing down Docker Compose..."
	docker compose down --remove-orphans

restart:
	@make down
	@make up

logs:
	docker compose logs

ps:
	docker compose ps

api:
	docker container exec -it $(dockerName) /bin/sh

api-renpm-i:
	docker container exec -it $(dockerName) bash -c 'rm -rf node_modules package-lock.json && npm install'

api-npm-i:
	docker container exec -it $(dockerName) npm install

api-npm-dev:
	docker container exec -it $(dockerName) npm run dev

api-npm-build:
	docker container exec -it $(dockerName) npm run build

# make typeorm-create example: make migration-create name=create_users_table
migration-create:
	docker container exec -it $(dockerName) bash -c 'npx typeorm migration:create $(migrationDir)/$(name)'

# make typeorm-run example: make migrate
migrate:
	docker container exec -it $(dockerName) bash -c 'npm run typeorm migration:run -- --dataSource ${dataSource}'

# make seed-create example: make seed-create name=seed_name.ts
seed-create:
	docker container exec -it $(dockerName) bash -c 'npm run seed:create -- --name $(seedDir)/$(name)'

# make seed-run example: make seed
seed:
	docker container exec -it $(dockerName) bash -c 'npm run seed'

# make resource-create: example: make resource-create name=modules/users
create-resource:
	docker container exec -it $(dockerName) bash -c 'nest g resource $(name)'
