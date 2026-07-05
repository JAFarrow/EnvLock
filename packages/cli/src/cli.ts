#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';

import { packageVersion } from './index.js';

interface RunOptions {
  apiUrl?: string;
  environment?: string;
  pat?: string;
}

interface ParsedRunCommand {
  options: RunOptions;
  command: string;
  args: string[];
}

interface ResolvedConfig {
  apiUrl: string;
  environment: string;
  pat: string;
}

interface CliSecretValuesResponse {
  variables: Record<string, string>;
}

const environmentSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

export async function runCli(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): Promise<number> {
  const [command, ...rest] = argv;

  if (command === undefined || command === '--help' || command === '-h') {
    process.stdout.write(`${helpText()}\n`);
    return 0;
  }

  if (command === '--version' || command === '-v') {
    process.stdout.write(`${packageVersion}\n`);
    return 0;
  }

  if (command !== 'run') {
    throw new CliError(`Unknown command: ${command}`);
  }

  if (rest.includes('--help') || rest.includes('-h')) {
    process.stdout.write(`${helpText()}\n`);
    return 0;
  }

  const parsedCommand = parseRunCommand(rest);
  const config = resolveConfig(parsedCommand.options, env);
  const variables = await fetchSecretVariables(config);

  return runSubprocess(parsedCommand.command, parsedCommand.args, variables, env);
}

function parseRunCommand(args: string[]): ParsedRunCommand {
  const separatorIndex = args.indexOf('--');

  if (separatorIndex === -1) {
    throw new CliError('Missing command separator. Use: envlock run [options] -- <command>');
  }

  const optionArgs = args.slice(0, separatorIndex);
  const commandArgs = args.slice(separatorIndex + 1);
  const command = commandArgs[0];

  if (command === undefined) {
    throw new CliError('Missing subprocess command after --');
  }

  return {
    options: parseRunOptions(optionArgs),
    command,
    args: commandArgs.slice(1)
  };
}

function parseRunOptions(args: string[]): RunOptions {
  const options: RunOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === undefined) {
      continue;
    }

    if (arg.startsWith('--api-url=')) {
      options.apiUrl = arg.slice('--api-url='.length);
      continue;
    }

    if (arg === '--api-url') {
      options.apiUrl = readOptionValue(args, index, '--api-url');
      index += 1;
      continue;
    }

    if (arg.startsWith('--environment=')) {
      options.environment = arg.slice('--environment='.length);
      continue;
    }

    if (arg.startsWith('-e=')) {
      options.environment = arg.slice('-e='.length);
      continue;
    }

    if (arg === '--environment' || arg === '-e') {
      options.environment = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith('--pat=')) {
      options.pat = arg.slice('--pat='.length);
      continue;
    }

    if (arg === '--pat') {
      options.pat = readOptionValue(args, index, '--pat');
      index += 1;
      continue;
    }

    throw new CliError(`Unknown run option: ${arg}`);
  }

  return options;
}

function readOptionValue(args: string[], optionIndex: number, optionName: string): string {
  const value = args[optionIndex + 1];

  if (value === undefined || value.startsWith('--')) {
    throw new CliError(`Missing value for ${optionName}`);
  }

  return value;
}

function resolveConfig(options: RunOptions, env: NodeJS.ProcessEnv): ResolvedConfig {
  const apiUrl = requireString(options.apiUrl, env.ENVLOCK_API_URL, 'ENVLOCK_API_URL');
  const environment = requireString(
    options.environment,
    env.ENVLOCK_ENVIRONMENT,
    '--environment or -e'
  );
  const pat = requireString(options.pat, env.ENVLOCK_PAT, 'ENVLOCK_PAT');

  validateApiUrl(apiUrl);

  if (!environmentSlugPattern.test(environment)) {
    throw new CliError(
      'Invalid environment slug. Use lowercase letters, numbers, and single hyphens.'
    );
  }

  return { apiUrl, environment, pat };
}

function requireString(
  optionValue: string | undefined,
  environmentValue: string | undefined,
  environmentName: string
): string {
  const value = optionValue ?? environmentValue;
  const trimmedValue = value?.trim();

  if (trimmedValue === undefined || trimmedValue.length === 0) {
    throw new CliError(`Missing required configuration: ${environmentName}`);
  }

  return trimmedValue;
}

function validateApiUrl(apiUrl: string): void {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new CliError('ENVLOCK_API_URL must be a valid HTTP or HTTPS URL');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new CliError('ENVLOCK_API_URL must use HTTP or HTTPS');
  }
}

async function fetchSecretVariables(config: ResolvedConfig): Promise<Record<string, string>> {
  const endpoint = createSecretsEndpoint(config.apiUrl, config.environment);
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${config.pat}`,
      Accept: 'application/json'
    }
  });

  if (response.status === 401) {
    throw new CliError('Authentication failed. Check ENVLOCK_PAT.');
  }

  if (!response.ok) {
    throw new CliError(`EnvLock API request failed with HTTP ${String(response.status)}`);
  }

  const body = await response.json();
  const parsedBody = parseSecretValuesResponse(body);

  return parsedBody.variables;
}

function createSecretsEndpoint(apiUrl: string, environment: string): URL {
  const normalizedBaseUrl = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
  const endpoint = new URL('api/cli/secrets', normalizedBaseUrl);
  endpoint.searchParams.set('environmentSlug', environment);

  return endpoint;
}

function parseSecretValuesResponse(body: unknown): CliSecretValuesResponse {
  if (!isRecord(body) || !isStringRecord(body.variables)) {
    throw new CliError('EnvLock API returned an invalid secret payload');
  }

  return { variables: body.variables };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === 'string');
}

function runSubprocess(
  command: string,
  args: string[],
  variables: Record<string, string>,
  env: NodeJS.ProcessEnv
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...env, ...variables },
      shell: process.platform === 'win32',
      stdio: 'inherit'
    });

    child.on('error', (error) => {
      reject(new CliError(`Unable to start subprocess: ${error.message}`));
    });

    child.on('exit', (code, signal) => {
      if (signal !== null) {
        process.kill(process.pid, signal);
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });
}

function helpText(): string {
  return `Usage:
  envlock run [options] -- <command> [args...]

Options:
  --api-url <url>       EnvLock API URL. Defaults to ENVLOCK_API_URL.
  -e, --environment <slug>
                        Required environment slug. May also use ENVLOCK_ENVIRONMENT.
  --pat <token>         Personal access token. Defaults to ENVLOCK_PAT.
  --help                Show help.
  --version             Show version.

Environment:
  ENVLOCK_API_URL       Required EnvLock API URL.
  ENVLOCK_ENVIRONMENT  Optional environment slug fallback.
  ENVLOCK_PAT          Required personal access token.`;
}

function writeCliError(error: unknown): void {
  if (error instanceof CliError) {
    process.stderr.write(`envlock: ${error.message}\n`);
    return;
  }

  if (error instanceof Error) {
    process.stderr.write(`envlock: ${error.message}\n`);
    return;
  }

  process.stderr.write('envlock: Unknown error\n');
}

if (require.main === module) {
  void runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      writeCliError(error);
      process.exitCode = 1;
    });
}
