import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIRST = ['Ada', 'Alan', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Tim'];
const LAST = ['Lovelace', 'Turing', 'Hopper', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Perlman', 'Berners'];
const UNIS = ['Fakeville University', 'Example State', 'Placeholder Tech'];
const VERIFICATION = ['VALID', 'VALID', 'VALID', 'RISKY', 'UNKNOWN'] as const;

async function main(): Promise<void> {
  await prisma.campaign.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });

  const organizers = await Promise.all(
    ['organizer1@hackutd.co', 'organizer2@hackutd.co'].map((email, i) =>
      prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, name: `Fake Organizer ${i + 1}`, role: 'ORGANIZER' },
      }),
    ),
  );

  const contacts = Array.from({ length: 200 }, (_, i) => {
    const first = FIRST[i % FIRST.length];
    const last = LAST[Math.floor(i / FIRST.length) % LAST.length];
    return {
      email: `${first}.${last}${i}@fake-seed.example.edu`.toLowerCase(),
      name: i % 7 === 0 ? `${last}, ${first}` : `Dr. ${first} ${last}`,
      title: 'Professor',
      department: 'Computer Science',
      uni: UNIS[i % UNIS.length],
      verification: VERIFICATION[i % VERIFICATION.length],
      assignedToId: i < 120 ? organizers[i % 2].id : null,
    };
  });
  const res = await prisma.contact.createMany({ data: contacts, skipDuplicates: true });
  process.stdout.write(`Seeded ${organizers.length} organizers and ${res.count} contacts (fake-seed.example.edu addresses).\n`);
}

main()
  .catch((err) => {
    process.stderr.write(`${err}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
