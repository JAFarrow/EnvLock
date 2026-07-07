# EnvLock

EnvLock is a lightweight secret management tool for local Node.js development, providing repository and environment scoped secrets through a web dashboard and an NPM CLI that fetches and injects variables before running an application.

## API Local Setup

The API is a NestJS application in the `api` workspace.

### Prerequisites

- Node.js 22 or newer
- npm

### Install Dependencies

Install dependencies from the repository root:

```sh
npm ci
```

### Configure Environment

The API requires a Postgres database URL, JWT secret, and secret encryption key configuration. Other settings have development defaults.

Supported environment variables:

- `NODE_ENV`: `development`, `test`, or `production`; defaults to `development`
- `PORT`: API port; defaults to `3000`
- `LOG_FORMAT`: `pretty` or `json`; defaults to `pretty` outside production and `json` in production
- `DATABASE_URL`: Postgres connection URL; required
- `JWT_SECRET`: secret used to sign API bearer tokens; required
- `JWT_ACCESS_TOKEN_TTL_SECONDS`: access token lifetime in seconds; defaults to `3600`
- `JWT_ACCESS_TOKEN_COOKIE_NAME`: cookie name for browser access tokens; defaults to `envlock_access_token`
- `SECRET_ENCRYPTION_KEY_BASE64`: exactly 32 random bytes encoded as Base64; required
- `SECRET_ENCRYPTION_KEY_VERSION`: positive integer version for the active secret encryption key; required

Example:

```sh
DATABASE_URL=postgres://envlock:envlock@localhost:5432/envlock JWT_SECRET=replace-me SECRET_ENCRYPTION_KEY_BASE64=replace-with-generated-base64-key SECRET_ENCRYPTION_KEY_VERSION=1 PORT=4000 LOG_FORMAT=json npm run dev:api
```

### Run The API

Start the API in watch mode:

```sh
npm run dev:api
```

The API listens on `http://localhost:3000` by default.

## CLI Usage

The CLI fetches secrets from the EnvLock API with a project personal access token, injects them into a subprocess environment, and runs the requested application command.

Install the CLI from npm:

```sh
npm install -g @jfarrow777/envlock
```

Required environment variables:

- `ENVLOCK_API_URL`: EnvLock API URL, for example `http://localhost:3000`
- `ENVLOCK_PAT`: project personal access token

The environment slug is required for each run. Provide it with `-e` or `--environment`. `ENVLOCK_ENVIRONMENT` is also supported as an optional fallback, but it is not required.

EnvLock does not provide CLI configuration defaults. Missing required configuration fails before the subprocess starts.

Example:

```sh
ENVLOCK_API_URL=http://localhost:3000 ENVLOCK_PAT=envlock_pat_... envlock run -e development -- npm run dev
```

Per-run flags can override environment variables:

```sh
envlock run --api-url http://localhost:3000 -e production -- npm start
```

The CLI never prints secret values. Prefer `ENVLOCK_PAT` over `--pat` because command-line flags can be stored in shell history or visible in process lists.

### Doctor Mode

Doctor mode compares keys from a local `.env.example` file against the secret keys stored in EnvLock for an environment. It reports keys missing from EnvLock and persisted EnvLock keys missing from the example file. It does not fetch or print secret values.

```sh
ENVLOCK_API_URL=http://localhost:3000 ENVLOCK_PAT=envlock_pat_... envlock doctor -e development
```

Use `--example` when the example file is not at `.env.example`:

```sh
envlock doctor -e production --example config/.env.example
```

### Build

Build the API:

```sh
npm run build:api
```

Start the built API:

```sh
npm run start:api
```

### Test And Lint

Run API tests:

```sh
npm test
```

Run linting for the repository:

```sh
npm run lint
```
