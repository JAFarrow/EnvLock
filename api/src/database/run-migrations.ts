import { apiDataSource } from './data-source';

async function runMigrations(): Promise<void> {
  try {
    await apiDataSource.initialize();

    const migrations = await apiDataSource.runMigrations({ transaction: 'all' });

    console.log(`Ran ${String(migrations.length)} migration(s).`);
  } finally {
    if (apiDataSource.isInitialized) {
      await apiDataSource.destroy();
    }
  }
}

void runMigrations().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
