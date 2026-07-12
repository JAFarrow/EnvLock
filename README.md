# EnvLock

EnvLock is a lightweight secret management tool that provides project- and environment-scoped secrets through a web dashboard and an npm CLI. The CLI fetches secrets and injects them into a subprocess environment before running a command.

## Hosted Deployment

The EnvLock dashboard and API are deployed at [https://envlock-api.onrender.com/](https://envlock-api.onrender.com/). API routes are available under `/api`, and the health check is available at [`/health`](https://envlock-api.onrender.com/health).

## Task Board

Project tasks and development progress are tracked on the [EnvLock Development Board](https://trello.com/invite/b/6a26ec3dafff07b29d8e968b/ATTI37aa053a22f1857c18b4267c72a8b442CCC57C43/envlock-development-board).

## Repository Layout

- `api/`: NestJS API and static web dashboard.
- `packages/cli/`: `envlock` CLI package.
- `docs/`: repository conventions for future development work.

## Local Setup

### Prerequisites

- Node.js 22 or newer
- npm
- PostgreSQL

### Install

Install dependencies from the repository root:

```sh
npm ci
```

### API Environment

Copy the API environment template:

```sh
cp api/.env.example api/.env
```

Generate a real local encryption key and place it in `api/.env`:

```sh
openssl rand -base64 32
```

The backend explicitly loads `api/.env`. Exported environment variables can still override local values when needed.

Required API settings:

- `DATABASE_URL`: Postgres connection URL; required
- `JWT_SECRET`: secret used to sign API bearer tokens; required
- `SECRET_ENCRYPTION_KEY_BASE64`: exactly 32 random bytes encoded as Base64; required
- `SECRET_ENCRYPTION_KEY_VERSION`: positive integer version for the active secret encryption key; required

Other API settings have development defaults: `NODE_ENV=development`, `PORT=3000`, `LOG_FORMAT=pretty`, `JWT_ACCESS_TOKEN_TTL_SECONDS=3600`, and `JWT_ACCESS_TOKEN_COOKIE_NAME=envlock_access_token`.

Defaults apply when a setting is omitted. Remove blank optional settings from `api/.env` or assign them valid values.

### Database

The API requires a PostgreSQL database. Set `DATABASE_URL` in `api/.env` to a database the API can connect to.

### Run

Start the API in watch mode:

```sh
npm run dev:api
```

By default, the dashboard is available at `http://localhost:3000`, API routes are under `/api`, and health checks are available at `/health`.

In non-production environments, TypeORM auto-synchronizes the local database schema. Production does not auto-sync schemas.

### First Dashboard Flow

1. Open `http://localhost:3000/register`.
2. Register with an email and a password of at least 12 characters.
3. Log in and create a project.
4. Create an environment such as `development`.
5. Add secrets using uppercase keys, for example `DATABASE_URL`.
6. Create a project personal access token from the project PAT page.
7. Use that PAT with the CLI.

## CLI Usage

The CLI fetches secrets from the EnvLock API with a project personal access token, injects them into a subprocess environment, and runs the requested application command.

Install the CLI from npm:

```sh
npm install -g @jfarrow777/envlock
```

Required environment variables:

- `ENVLOCK_API_URL`: EnvLock API URL, for example `https://envlock-api.onrender.com/`
- `ENVLOCK_PAT`: project personal access token

The environment slug is required for each run. Provide it with `-e` or `--environment`. `ENVLOCK_ENVIRONMENT` is also supported as an optional fallback, but it is not required.

EnvLock does not provide CLI configuration defaults. Missing required configuration fails before the subprocess starts.

Example:

```sh
ENVLOCK_API_URL=https://envlock-api.onrender.com/ ENVLOCK_PAT=envlock_pat_... envlock run -e development -- npm run dev
```

Per-run flags can override environment variables:

```sh
envlock run --api-url https://envlock-api.onrender.com/ -e production -- npm start
```

The CLI never prints secret values. Prefer `ENVLOCK_PAT` over `--pat` because command-line flags can be stored in shell history or visible in process lists.

### Local CLI Development

Run the workspace CLI without installing it globally:

```sh
npm run start -w packages/cli -- --help
```

Example using the local CLI against the local API:

```sh
ENVLOCK_API_URL=http://localhost:3000 ENVLOCK_PAT=envlock_pat_... npm run start -w packages/cli -- run -e development -- node -e "console.log('secrets loaded')"
```

### Doctor Mode

Doctor mode compares keys from a local `.env.example` file against the secret keys stored in EnvLock for an environment. It reports keys missing from EnvLock and persisted EnvLock keys missing from the example file. It does not fetch or print secret values.

```sh
ENVLOCK_API_URL=https://envlock-api.onrender.com/ ENVLOCK_PAT=envlock_pat_... envlock doctor -e development
```

Use `--example` when the example file is not at `.env.example`:

```sh
envlock doctor -e production --example config/.env.example
```

## Build

Build all workspaces:

```sh
npm run build
```

Build one workspace:

```sh
npm run build:api
npm run build:cli
```

Start the built API:

```sh
npm run start:api
```

## Test And Lint

Run all tests:

```sh
npm test
```

Run workspace-specific tests:

```sh
npm run test:api
npm run test:cli
```

Run linting and formatting checks:

```sh
npm run lint
npm run format:check
```
