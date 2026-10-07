import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

/**
 * Load a plain-text file as version B of a campaign's A/B test. The test stays off until it is switched on
 * in Admin > Template. The file's first line may be "Subject: ...".
 * Usage: npx tsx --env-file=.env prisma/load-version-b.ts <file.txt> [sponsor]
 */
const [file, kindArg] = process.argv.slice(2);
if (!file) {
  process.stderr.write('Usage: load-version-b.ts <file.txt> [sponsor]\n');
  process.exit(1);
}

const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const match = /^Subject:\s*(.+)\n+/i.exec(raw);
const bSubject = match ? match[1].trim() : null;
const bBody = (match ? raw.slice(match[0].length) : raw).trimEnd();
if (!bSubject) {
  process.stderr.write('The file must start with a "Subject: ..." line.\n');
  process.exit(1);
}

const prisma = new PrismaClient();
prisma.campaign
  .update({ where: { id: kindArg === 'sponsor' ? 'sponsor' : 'default' }, data: { bSubject, bBody, bHtmlBody: null } })
  .then((c) => process.stdout.write(`Version B saved: subject="${c.bSubject}", ${c.bBody?.length ?? 0} chars, A/B test is ${c.abEnabled ? 'ON' : 'off'}\n`))
  .catch((err) => {
    process.stderr.write(`${err}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
