# About Attendance

## Quick Start

Clone this project  

```shell
cd api_attendance/
# docker compose build --no-cache --force-rm
make build
# docker compose up -d
make up
cp .env.example .env
# npm install
make npm-i
# npm run dev
make npm-dev
```

### Docker multi-stage build

#### For local

- NextJS (node:v20)
- NuxtJS
- mariadb

#### For production

## Backend

NestJS 10.0
**Ngrok** and **Mailhog** are available in local environment.

### Authentication

#### Repository Pattern Architecture

<!-- - Model
→ Define DB object and attribute.
- Controller
→ Receive requests, use Service, pass data to View or return json response.
- Request
    → Validation
- Service
→ Business logic. Receive requests from Controller and use Repository interface
- Repository Interface
→ Call repository. Only used for Service.
- Repository
→ Execute SQL Query. Only called from Repository interface. -->

## Frontend

- Typescript
- Nuxt3
- Vue Composition API
- Vuetify 3.6.11
- Pinia

## Formatting

- Eslint
- Prettier

To fix codes  
`$ make npm-fix`  