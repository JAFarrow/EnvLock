import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { runCli } from '../cli';

type FetchMock = jest.Mock<Promise<Response>, [URL, RequestInit?]>;

const baseEnv = {
  ENVLOCK_API_URL: 'https://envlock.example',
  ENVLOCK_PAT: 'envlock_pat_00000000-0000-4000-8000-000000000000.secret'
};

describe('runCli doctor', () => {
  let tempDirectory: string;
  let fetchMock: FetchMock;
  let stdoutWriteSpy: jest.SpyInstance<boolean, Parameters<typeof process.stdout.write>>;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'envlock-cli-'));
    fetchMock = jest.fn<Promise<Response>, [URL, RequestInit?]>();
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as typeof fetch);
    stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it('passes when backend secret keys cover .env.example keys', async () => {
    const examplePath = await writeExample(`
# local development
DATABASE_URL=
export API_KEY=replace-me
DATABASE_URL=duplicate
MALFORMED_LINE
`);
    fetchMock.mockResolvedValueOnce(createJsonResponse({ keys: ['API_KEY', 'DATABASE_URL'] }));

    await expect(
      runCli(['doctor', '-e', 'development', '--example', examplePath], baseEnv)
    ).resolves.toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://envlock.example/api/cli/secrets/keys?environmentSlug=development'),
      {
        headers: {
          Authorization: `Bearer ${baseEnv.ENVLOCK_PAT}`,
          Accept: 'application/json'
        }
      }
    );
    expect(writtenStdout()).toContain(
      'EnvLock doctor passed. 2 expected secret key(s) match persisted secrets in development.'
    );
  });

  it('lists missing backend secret keys and exits with a failure code', async () => {
    const examplePath = await writeExample('DATABASE_URL=\nJWT_SECRET=\n');
    fetchMock.mockResolvedValueOnce(createJsonResponse({ keys: ['DATABASE_URL'] }));

    await expect(
      runCli(['doctor', '--environment', 'production', '--example', examplePath], baseEnv)
    ).resolves.toBe(1);

    expect(writtenStdout()).toContain('EnvLock doctor found missing secrets in production:');
    expect(writtenStdout()).toContain('- JWT_SECRET');
  });

  it('lists persisted backend secret keys missing from .env.example', async () => {
    const examplePath = await writeExample('DATABASE_URL=\n');
    fetchMock.mockResolvedValueOnce(createJsonResponse({ keys: ['API_KEY', 'DATABASE_URL'] }));

    await expect(
      runCli(['doctor', '--environment', 'production', '--example', examplePath], baseEnv)
    ).resolves.toBe(1);

    expect(writtenStdout()).toContain(
      `EnvLock doctor found persisted secrets not present in ${examplePath} for production:`
    );
    expect(writtenStdout()).toContain('- API_KEY');
  });

  it('lists missing and unexpected persisted backend secret keys', async () => {
    const examplePath = await writeExample('DATABASE_URL=\nJWT_SECRET=\n');
    fetchMock.mockResolvedValueOnce(createJsonResponse({ keys: ['API_KEY', 'DATABASE_URL'] }));

    await expect(
      runCli(['doctor', '--environment', 'production', '--example', examplePath], baseEnv)
    ).resolves.toBe(1);

    expect(writtenStdout()).toContain('EnvLock doctor found missing secrets in production:');
    expect(writtenStdout()).toContain('- JWT_SECRET');
    expect(writtenStdout()).toContain(
      `EnvLock doctor found persisted secrets not present in ${examplePath} for production:`
    );
    expect(writtenStdout()).toContain('- API_KEY');
  });

  it('rejects invalid backend key payloads', async () => {
    const examplePath = await writeExample('DATABASE_URL=\n');
    fetchMock.mockResolvedValueOnce(createJsonResponse({ keys: ['DATABASE_URL', 123] }));

    await expect(
      runCli(['doctor', '-e', 'development', '--example', examplePath], baseEnv)
    ).rejects.toThrow('EnvLock API returned an invalid secret key payload');
  });

  it('rejects missing backend key payloads', async () => {
    const examplePath = await writeExample('DATABASE_URL=\n');
    fetchMock.mockResolvedValueOnce(createJsonResponse({}));

    await expect(
      runCli(['doctor', '-e', 'development', '--example', examplePath], baseEnv)
    ).rejects.toThrow('EnvLock API returned an invalid secret key payload');
  });

  it('rejects failed backend key API responses', async () => {
    const examplePath = await writeExample('DATABASE_URL=\n');
    fetchMock.mockResolvedValueOnce(createJsonResponse({}, { ok: false, status: 401 }));

    await expect(
      runCli(['doctor', '-e', 'development', '--example', examplePath], baseEnv)
    ).rejects.toThrow('Authentication failed. Check ENVLOCK_PAT.');

    fetchMock.mockResolvedValueOnce(createJsonResponse({}, { ok: false, status: 500 }));

    await expect(
      runCli(['doctor', '-e', 'development', '--example', examplePath], baseEnv)
    ).rejects.toThrow('EnvLock API request failed with HTTP 500');
  });

  it('rejects unreadable example files', async () => {
    await expect(
      runCli(
        ['doctor', '-e', 'development', '--example', join(tempDirectory, 'missing.env')],
        baseEnv
      )
    ).rejects.toThrow('Unable to read');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  async function writeExample(content: string): Promise<string> {
    const path = join(tempDirectory, '.env.example');

    await writeFile(path, content);

    return path;
  }

  function writtenStdout(): string {
    return stdoutWriteSpy.mock.calls.map((call) => String(call[0])).join('');
  }
});

describe('runCli help and version', () => {
  let stdoutWriteSpy: jest.SpyInstance<boolean, Parameters<typeof process.stdout.write>>;

  beforeEach(() => {
    stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prints help when no command is provided', async () => {
    await expect(runCli([], baseEnv)).resolves.toBe(0);

    expect(writtenStdout()).toContain('Usage:');
    expect(writtenStdout()).toContain('envlock run [options] -- <command> [args...]');
  });

  it('prints help for command-specific help flags', async () => {
    await expect(runCli(['run', '--help'], baseEnv)).resolves.toBe(0);

    expect(writtenStdout()).toContain('Usage:');
  });

  it('rejects unknown commands', async () => {
    await expect(runCli(['deploy'], baseEnv)).rejects.toThrow('Unknown command: deploy');
  });

  function writtenStdout(): string {
    return stdoutWriteSpy.mock.calls.map((call) => String(call[0])).join('');
  }
});

describe('runCli run', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = jest.fn<Promise<Response>, [URL, RequestInit?]>();
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as typeof fetch);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches secrets and injects them into the subprocess environment', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ variables: { ENVLOCK_TEST_SECRET: 'from-api' } })
    );

    await expect(
      runCli(
        [
          'run',
          '--environment=development',
          '--',
          process.execPath,
          '-e',
          'process.exit(process.env.ENVLOCK_TEST_SECRET === "from-api" ? 0 : 2)'
        ],
        baseEnv
      )
    ).resolves.toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://envlock.example/api/cli/secrets?environmentSlug=development'),
      {
        headers: {
          Authorization: `Bearer ${baseEnv.ENVLOCK_PAT}`,
          Accept: 'application/json'
        }
      }
    );
  });

  it('returns the subprocess exit code', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ variables: {} }));

    await expect(
      runCli(['run', '-e', 'development', '--', process.execPath, '-e', 'process.exit(7)'], baseEnv)
    ).resolves.toBe(7);
  });

  it('uses environment configuration fallbacks', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ variables: {} }));

    await expect(
      runCli(['run', '--', process.execPath, '-e', 'process.exit(0)'], {
        ...baseEnv,
        ENVLOCK_API_URL: 'https://envlock.example/',
        ENVLOCK_ENVIRONMENT: 'staging'
      })
    ).resolves.toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://envlock.example/api/cli/secrets?environmentSlug=staging'),
      expect.any(Object)
    );
  });

  it('prefers equals-form options over environment values', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ variables: {} }));

    await expect(
      runCli(
        [
          'run',
          '--api-url=https://override.example',
          '-e=preview',
          '--pat=override-pat',
          '--',
          process.execPath,
          '-e',
          'process.exit(0)'
        ],
        baseEnv
      )
    ).resolves.toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://override.example/api/cli/secrets?environmentSlug=preview'),
      {
        headers: {
          Authorization: 'Bearer override-pat',
          Accept: 'application/json'
        }
      }
    );
  });

  it('prefers separate-value options over environment values', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ variables: {} }));

    await expect(
      runCli(
        [
          'run',
          '--api-url',
          'https://separate.example',
          '--environment',
          'qa',
          '--pat',
          'separate-pat',
          '--',
          process.execPath,
          '-e',
          'process.exit(0)'
        ],
        baseEnv
      )
    ).resolves.toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://separate.example/api/cli/secrets?environmentSlug=qa'),
      {
        headers: {
          Authorization: 'Bearer separate-pat',
          Accept: 'application/json'
        }
      }
    );
  });

  it('rejects missing required configuration before calling the API', async () => {
    await expect(runCli(['run', '--', process.execPath], {})).rejects.toThrow(
      'Missing required configuration: ENVLOCK_API_URL'
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid API URLs', async () => {
    await expect(
      runCli(['run', '-e', 'development', '--', process.execPath], {
        ...baseEnv,
        ENVLOCK_API_URL: 'not a url'
      })
    ).rejects.toThrow('ENVLOCK_API_URL must be a valid HTTP or HTTPS URL');

    await expect(
      runCli(['run', '-e', 'development', '--', process.execPath], {
        ...baseEnv,
        ENVLOCK_API_URL: 'ftp://envlock.example'
      })
    ).rejects.toThrow('ENVLOCK_API_URL must use HTTP or HTTPS');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid environment slugs', async () => {
    await expect(
      runCli(['run', '-e', 'Development', '--', process.execPath], baseEnv)
    ).rejects.toThrow('Invalid environment slug');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed run commands', async () => {
    await expect(runCli(['run', '-e', 'development'], baseEnv)).rejects.toThrow(
      'Missing command separator'
    );
    await expect(runCli(['run', '-e', 'development', '--'], baseEnv)).rejects.toThrow(
      'Missing subprocess command after --'
    );
    await expect(runCli(['run', '--unknown', '--', process.execPath], baseEnv)).rejects.toThrow(
      'Unknown run option: --unknown'
    );
    await expect(runCli(['run', '--api-url', '--', process.execPath], baseEnv)).rejects.toThrow(
      'Missing value for --api-url'
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects failed secret API responses', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({}, { ok: false, status: 401 }));

    await expect(
      runCli(['run', '-e', 'development', '--', process.execPath], baseEnv)
    ).rejects.toThrow('Authentication failed. Check ENVLOCK_PAT.');

    fetchMock.mockResolvedValueOnce(createJsonResponse({}, { ok: false, status: 500 }));

    await expect(
      runCli(['run', '-e', 'development', '--', process.execPath], baseEnv)
    ).rejects.toThrow('EnvLock API request failed with HTTP 500');
  });

  it('rejects invalid secret value payloads', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ variables: { DATABASE_URL: 123 } }));

    await expect(
      runCli(['run', '-e', 'development', '--', process.execPath], baseEnv)
    ).rejects.toThrow('EnvLock API returned an invalid secret payload');

    fetchMock.mockResolvedValueOnce(createJsonResponse({ variables: [] }));

    await expect(
      runCli(['run', '-e', 'development', '--', process.execPath], baseEnv)
    ).rejects.toThrow('EnvLock API returned an invalid secret payload');
  });
});

function createJsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body)
  } as Response;
}
