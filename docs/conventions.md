# Agentic Development Conventions

This document captures repository conventions for future automated and human development work.

## Repository Structure

- `api/` contains the `@envlock/api` NestJS API workspace.
- `packages/cli/` contains the `@jfarrow777/envlock` TypeScript package workspace.
- `tsconfig.base.json` contains shared TypeScript compiler settings.
- `eslint.config.mjs` contains the repo-level ESLint flat config.
- `.prettierrc` contains the repo-level formatting policy.

## Workspace Commands

- Install existing dependencies from the repository root with `npm ci`.
- Build all workspaces with `npm run build`.
- Build only the API with `npm run build:api`.
- Build only the CLI package with `npm run build:cli`.
- Start the API in watch mode with `npm run dev:api`.
- Run all tests with `npm test`.
- Run API tests with `npm run test:api`.
- Run CLI tests with `npm run test:cli`.
- Run lint checks with `npm run lint`.
- Apply safe lint fixes with `npm run lint:fix`.
- Format the repo with `npm run format`.
- Check formatting with `npm run format:check`.

## Verification Expectations

Run the smallest useful verification for the change being made. For broad or cross-workspace changes, run:

```sh
npm run lint
npm run format:check
npm run build
npm test
```

If formatting changes are required, run `npm run format`, then repeat `npm run format:check`.

## TypeScript Conventions

- Keep shared compiler options in `tsconfig.base.json`.
- Workspace-specific settings belong in that workspace's `tsconfig.json`.
- Keep Nest decorator settings in API-specific configs, not the shared base config.
- Keep declaration output enabled only for package workspaces that publish or expose types.
- Do not relax strict TypeScript settings unless there is a specific, documented reason.
- Prefer explicit return types on exported functions and public methods.
- Avoid `any`; prefer unknown, generics, or concrete interfaces.
- Avoid unchecked environment or configuration access. Validate or default values at boundaries.

## Linting And Formatting

- ESLint is configured centrally with `eslint.config.mjs`.
- Prettier owns formatting. Do not add ESLint rules that duplicate formatting concerns.
- Generated output such as `dist`, `coverage`, and `node_modules` should stay ignored.
- Use `npm run lint:fix` only for safe automated fixes; review all resulting changes.

## NestJS API Conventions

- Use `ConfigService` from `@nestjs/config` for configuration access.
- Do not read `process.env` directly in application code.
- Keep `ConfigModule.forRoot({ isGlobal: true })` in the root API module unless the app later needs a more explicit module boundary.
- Keep controllers thin. Put business logic in services.
- Validate controller request bodies with `ZodValidationPipe`; do not duplicate Zod `safeParse` handling inside controllers.
- Keep API tests under `api/src/__test__`.
- Production builds exclude `*.spec.ts`; keep test files named with the `.spec.ts` suffix.
- Add or update tests when changing observable API behavior.
- Prefer dependency injection over manual construction for framework-managed classes.
- Where possible, use Nest exception filters for cross-cutting exception-to-HTTP response mapping rather than handling infrastructure errors inside services.
- When a database failure is expected and should produce a stable HTTP response, update `PostgresExceptionFilter` instead of catching TypeORM errors in feature services.
- Use Nest's built-in `ConsoleLogger` for API logs; keep production logs single-line JSON for Render.
- Apply HTTP security headers through `applySecurityHeaders` in `api/src/main.ts` so bootstrap behavior remains directly testable.
- Keep TypeORM options centralized under `api/src/database` and add new entity classes to the shared entity list.
- Organize API code by feature under `api/src/<feature>`.
- Keep primary Nest entry points such as `*.controller.ts`, `*.module.ts`, and `*.service.ts` at the feature root when present.
- Put supporting feature files in purpose-named subdirectories such as `contracts/`, `entities/`, `repositories/`, `guards/`, `strategies/`, or other narrowly scoped implementation folders.

## Dependency Conventions

- Shared development tooling belongs in the root `devDependencies`.
- Runtime dependencies belong in the workspace that imports them.
- Install API runtime dependencies with `npm install <package> -w api`.
- Install CLI runtime dependencies with `npm install <package> -w packages/cli`.
- Install shared dev dependencies with `npm install --save-dev <package>` from the repository root.

## Change Safety

- Prefer small, focused changes over broad rewrites.
- Preserve existing public behavior unless the task explicitly asks to change it.
- Do not move files, rename packages, or change workspace topology without a clear reason.
- Do not edit generated files in `dist`, `coverage`, or `node_modules`.
- Do not revert unrelated user changes in the working tree.
- Update this document when introducing new conventions that future agents should follow.
