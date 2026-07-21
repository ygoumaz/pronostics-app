/**
 * Utility script: list all participants (id, displayName, email) so we can
 * map screen-name fragments to production DB records.
 *
 * Run from /app on the Fly.io machine so node_modules resolves correctly:
 *   node /app/list-participants.cjs
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const participants = await prisma.participant.findMany({
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: 'asc' },
  });

  for (const p of participants) {
    console.log(`${p.id}\t${p.displayName}\t${p.email}`);
  }
  console.log(`\nTotal: ${participants.length}`);
}

main()
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
