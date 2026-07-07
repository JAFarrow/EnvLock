#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { packageVersion } from './index.js';

interface RunOptions {
  apiUrl?: string;
  environment?: string;
  pat?: string;
}

interface DoctorOptions extends RunOptions {
  example?: string;
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

interface CliSecretKeysResponse {
  keys: string[];
}

const environmentSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const envExampleKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const defaultExamplePath = '.env.example';

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

  if (rest.includes('--help') || rest.includes('-h')) {
    process.stdout.write(`${helpText()}\n`);
    return 0;
  }

  if (command === 'doctor') {
    const options = parseDoctorOptions(rest);
    const config = resolveConfig(options, env);
    const examplePath = options.example ?? defaultExamplePath;
    const expectedKeys = await readEnvExampleKeys(examplePath);
    const actualKeys = await fetchSecretKeys(config);

    return reportDoctorResult(expectedKeys, actualKeys, config.environment, examplePath);
  }

  if (command !== 'run') {
    throw new CliError(`Unknown command: ${command}`);
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

function parseDoctorOptions(args: string[]): DoctorOptions {
  const options: DoctorOptions = {};

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

    if (arg.startsWith('--example=')) {
      options.example = arg.slice('--example='.length);
      continue;
    }

    if (arg === '--example') {
      options.example = readOptionValue(args, index, '--example');
      index += 1;
      continue;
    }

    throw new CliError(`Unknown doctor option: ${arg}`);
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

async function fetchSecretKeys(config: ResolvedConfig): Promise<string[]> {
  const endpoint = createSecretKeysEndpoint(config.apiUrl, config.environment);
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
  const parsedBody = parseSecretKeysResponse(body);

  return parsedBody.keys;
}

function createSecretsEndpoint(apiUrl: string, environment: string): URL {
  const normalizedBaseUrl = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
  const endpoint = new URL('api/cli/secrets', normalizedBaseUrl);
  endpoint.searchParams.set('environmentSlug', environment);

  return endpoint;
}

function createSecretKeysEndpoint(apiUrl: string, environment: string): URL {
  const normalizedBaseUrl = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
  const endpoint = new URL('api/cli/secrets/keys', normalizedBaseUrl);
  endpoint.searchParams.set('environmentSlug', environment);

  return endpoint;
}

function parseSecretValuesResponse(body: unknown): CliSecretValuesResponse {
  if (!isRecord(body) || !isStringRecord(body.variables)) {
    throw new CliError('EnvLock API returned an invalid secret payload');
  }

  return { variables: body.variables };
}

function parseSecretKeysResponse(body: unknown): CliSecretKeysResponse {
  if (!isRecord(body) || !Array.isArray(body.keys)) {
    throw new CliError('EnvLock API returned an invalid secret key payload');
  }

  if (!body.keys.every((item) => typeof item === 'string')) {
    throw new CliError('EnvLock API returned an invalid secret key payload');
  }

  return { keys: body.keys };
}

async function readEnvExampleKeys(examplePath: string): Promise<string[]> {
  let content: string;

  try {
    content = await readFile(examplePath, 'utf8');
  } catch {
    throw new CliError(`Unable to read ${examplePath}`);
  }

  return parseEnvExampleKeys(content);
}

function parseEnvExampleKeys(content: string): string[] {
  const keys: string[] = [];
  const seenKeys = new Set<string>();

  for (const line of content.split(/\r?\n/)) {
    const key = parseEnvExampleKey(line);

    if (key === null || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    keys.push(key);
  }

  return keys;
}

function parseEnvExampleKey(line: string): string | null {
  const trimmedLine = line.trim();

  if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
    return null;
  }

  const assignment = trimmedLine.startsWith('export ')
    ? trimmedLine.slice('export '.length).trimStart()
    : trimmedLine;
  const separatorIndex = assignment.indexOf('=');

  if (separatorIndex === -1) {
    return null;
  }

  const key = assignment.slice(0, separatorIndex).trim();

  return envExampleKeyPattern.test(key) ? key : null;
}

function reportDoctorResult(
  expectedKeys: string[],
  actualKeys: string[],
  environment: string,
  examplePath: string
): number {
  const actualKeySet = new Set(actualKeys);
  const expectedKeySet = new Set(expectedKeys);
  const missingKeys = expectedKeys.filter((key) => !actualKeySet.has(key));
  const extraKeys = actualKeys.filter((key) => !expectedKeySet.has(key));

  if (missingKeys.length === 0 && extraKeys.length === 0) {
    process.stdout.write(
      `EnvLock doctor passed. ${String(expectedKeys.length)} expected secret key(s) match persisted secrets in ${environment}.\n`
    );
    return 0;
  }

  if (missingKeys.length > 0) {
    process.stdout.write(`EnvLock doctor found missing secrets in ${environment}:\n`);

    for (const key of missingKeys) {
      process.stdout.write(`- ${key}\n`);
    }
  }

  if (extraKeys.length > 0) {
    process.stdout.write(
      `EnvLock doctor found persisted secrets not present in ${examplePath} for ${environment}:\n`
    );

    for (const key of extraKeys) {
      process.stdout.write(`- ${key}\n`);
    }
  }

  return 1;
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
  envlock doctor [options]

Options:
  --api-url <url>       EnvLock API URL. Defaults to ENVLOCK_API_URL.
  -e, --environment <slug>
                        Required environment slug. May also use ENVLOCK_ENVIRONMENT.
  --pat <token>         Personal access token. Defaults to ENVLOCK_PAT.
  --example <path>      .env.example path for doctor. Defaults to .env.example.
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
