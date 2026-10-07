import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

/** Usage: npx tsx --env-file=.env prisma/load-template.ts <file.html> "<subject>" [sponsor] */
const [file, subject, kindArg] = process.argv.slice(2);
const id = kindArg === 'sponsor' ? 'sponsor' : 'default';
if (!file) {
  process.stderr.write('Usage: load-template.ts <file.html> [subject]\n');
  process.exit(1);
}

const prisma = new PrismaClient();
const htmlBody = readFileSync(file, 'utf8');

prisma.campaign
  .upsert({
    where: { id },
    update: { htmlBody, ...(subject ? { subject } : {}) },
    create: { id, htmlBody, ...(subject ? { subject } : {}) },
  })
  .then((c) => process.stdout.write(`Campaign updated: subject="${c.subject}", html ${c.htmlBody?.length ?? 0} chars\n`))
  .catch((err) => {
    process.stderr.write(`${err}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
