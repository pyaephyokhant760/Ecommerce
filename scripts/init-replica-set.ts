/**
 * Turns the local MongoDB instance into a single-node replica set.
 *
 * Why this is required:
 *   Prisma's MongoDB connector wraps writes in a transaction, and MongoDB only
 *   supports transactions on replica sets. A standalone `mongod` therefore
 *   rejects every create/update/delete with:
 *
 *     Prisma needs to perform transactions, which requires your MongoDB server
 *     to be run as a replica set.
 *
 * Prerequisite (one-time, needs Administrator):
 *   `mongod.cfg` must contain
 *     replication:
 *       replSetName: rs0
 *   and the MongoDB service must be restarted.
 *
 * This script performs the remaining one-time `replSetInitiate` handshake.
 * It deliberately uses your existing Prisma client instead of `mongosh`, so
 * there is nothing extra to install.
 *
 * Usage: npm run db:replica-set
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const REPL_SET_NAME = process.env.MONGO_REPL_SET_NAME ?? 'rs0';
const NODE_HOST = process.env.MONGO_REPL_SET_HOST ?? '127.0.0.1:27017';

/** Admin commands such as replSetGetStatus/replSetInitiate must target `admin`. */
function toAdminUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (!parsed.hostname) {
    throw new Error(`Could not derive an admin URL from DATABASE_URL: ${rawUrl}`);
  }
  parsed.pathname = '/admin';
  parsed.searchParams.delete('authSource');
  return parsed.toString();
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** `myState` value reported by a replica set member that is PRIMARY. */
const PRIMARY = 1;

/**
 * After `replSetInitiate` the node still has to elect itself PRIMARY. Writes
 * issued during that window fail with "not primary", so wait it out rather
 * than leaving the user with a flaky first query.
 */
async function waitForPrimary(prisma: PrismaClient, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const status = (await prisma.$runCommandRaw({
        replSetGetStatus: 1,
      })) as { myState?: number };

      if (status.myState === PRIMARY) return;
    } catch {
      // Election in progress - the status command can be unavailable briefly.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for the node to become PRIMARY.`,
  );
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined in .env');
  }

  const adminUrl = toAdminUrl(databaseUrl);
  console.log(`Checking replica set status via ${adminUrl}`);

  const prisma = new PrismaClient({ datasourceUrl: adminUrl });

  try {
    // 1. Ask the node for its replica set status. On a standalone this fails
    //    with NoReplicationEnabled (code 76); on a replica-set node that has
    //    not yet been configured it fails with NotYetInitialized (code 94).
    try {
      const status = (await prisma.$runCommandRaw({
        replSetGetStatus: 1,
      })) as { set?: string; myState?: number };

      console.log(
        `Replica set "${status.set}" is already initialised (myState=${status.myState}). Nothing to do.`,
      );
      return;
    } catch (error) {
      const message = describe(error);

      if (/not running with --replSet|NoReplicationEnabled/i.test(message)) {
        console.error(
          [
            '',
            'MongoDB is still running as a STANDALONE server.',
            '',
            'Add this to C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.cfg (needs Administrator):',
            '',
            '  replication:',
            `    replSetName: ${REPL_SET_NAME}`,
            '',
            'then restart the service and run this script again:',
            '',
            '  Restart-Service MongoDB',
            '',
          ].join('\n'),
        );
        process.exitCode = 1;
        return;
      }

      if (!/NotYetInitialized|no replset config/i.test(message)) {
        throw error;
      }
    }

    // 2. Configure the single-node replica set.
    const response = await prisma.$runCommandRaw({
      replSetInitiate: {
        _id: REPL_SET_NAME,
        members: [{ _id: 0, host: NODE_HOST }],
      },
    });

    console.log(`replSetInitiate ok: ${JSON.stringify(response)}`);

    // 3. Wait for the election so the very next write succeeds.
    await waitForPrimary(prisma);

    console.log(
      'Single-node replica set is ready and PRIMARY. Writes will now work.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Failed:', describe(error));
  process.exitCode = 1;
});
