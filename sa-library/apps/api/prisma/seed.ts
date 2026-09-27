import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production.');
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before seeding.');
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: process.env.DATABASE_URL },
    { schema: new URL(process.env.DATABASE_URL).searchParams.get('schema') ?? 'public' },
  ),
});
const catalogue = [
  [
    '9780132350884',
    'Clean Code',
    'Robert C. Martin',
    'Technology',
    2008,
    'Prentice Hall',
    'A practical introduction to writing readable, maintainable software.',
  ],
  [
    '9780735211292',
    'Atomic Habits',
    'James Clear',
    'Personal Development',
    2018,
    'Avery',
    'Small changes and practical systems for building better everyday habits.',
  ],
  [
    '9780857197689',
    'The Psychology of Money',
    'Morgan Housel',
    'Business',
    2020,
    'Harriman House',
    'Stories about the behaviour and decisions behind personal finance.',
  ],
  [
    '9780385474542',
    'Things Fall Apart',
    'Chinua Achebe',
    'Fiction',
    1958,
    'Anchor',
    'A landmark novel exploring community and change in an Igbo village.',
  ],
  [
    '9780316548182',
    'Long Walk to Freedom',
    'Nelson Mandela',
    'South African literature',
    1994,
    'Little, Brown',
    'Nelson Mandela recounts his life and the struggle for a democratic South Africa.',
  ],
  [
    '9780399588174',
    'Born a Crime',
    'Trevor Noah',
    'South African literature',
    2016,
    'Spiegel & Grau',
    'A memoir of childhood, family and identity in South Africa.',
  ],
  [
    '9780141439518',
    'Pride and Prejudice',
    'Jane Austen',
    'Fiction',
    1813,
    'Penguin Classics',
    'A witty novel of family, social expectations and first impressions.',
  ],
  [
    '9780553380163',
    'A Brief History of Time',
    'Stephen Hawking',
    'Science',
    1988,
    'Bantam',
    'An accessible exploration of the universe, black holes and the nature of time.',
  ],
  [
    '9780143105428',
    'Cry, the Beloved Country',
    'Alan Paton',
    'South African literature',
    1948,
    'Penguin',
    'A moving novel of family and social change set in South Africa.',
  ],
  [
    '9780140449136',
    'The Odyssey',
    'Homer',
    'Fiction',
    2003,
    'Penguin Classics',
    'An epic journey of homecoming and perseverance in a modern English edition.',
  ],
  [
    '9780062316097',
    'Sapiens',
    'Yuval Noah Harari',
    'Science',
    2015,
    'Harper',
    'A broad exploration of human history, societies and shared stories.',
  ],
  [
    '9780345472328',
    'Mindset',
    'Carol S. Dweck',
    'Education',
    2006,
    'Random House',
    'An introduction to growth mindsets in learning, work and everyday life.',
  ],
  [
    '9780307887894',
    'The Lean Startup',
    'Eric Ries',
    'Business',
    2011,
    'Crown Business',
    'A guide to testing ideas and learning while building a new business.',
  ],
  [
    '9780201616224',
    'The Pragmatic Programmer',
    'Andrew Hunt|David Thomas',
    'Technology',
    1999,
    'Addison-Wesley',
    'Practical approaches to software development and professional craftsmanship.',
  ],
  [
    '9780141184999',
    'Disgrace',
    'J. M. Coetzee',
    'South African literature',
    1999,
    'Penguin',
    'A novel examining responsibility and relationships in post-apartheid South Africa.',
  ],
  [
    '9780767908184',
    'A Short History of Nearly Everything',
    'Bill Bryson',
    'Science',
    2003,
    'Broadway Books',
    'A curious journey through scientific discovery, from atoms to the cosmos.',
  ],
  [
    '9780241250990',
    'The Book You Wish Your Parents Had Read',
    'Philippa Perry',
    'Education',
    2019,
    'Penguin',
    'Reflections on communication and building understanding in family relationships.',
  ],
  [
    '9780141187761',
    'Animal Farm',
    'George Orwell',
    'Fiction',
    1945,
    'Penguin',
    'A short political fable about power, ideals and the animals of a farm.',
  ],
] as const;

try {
  const library = await db.library.upsert({
    where: { id: 'demo-ekurhuleni' },
    create: {
      id: 'demo-ekurhuleni',
      name: 'City of Ekurhuleni Libraries',
      municipality: 'Ekurhuleni',
      province: 'Gauteng',
    },
    update: {},
  });
  const locations = [
    ['germiston', 'Germiston Library', 'Germiston CBD, Ekurhuleni', 'Germiston', '1401'],
    ['boksburg', 'Boksburg Library', 'Boksburg CBD, Ekurhuleni', 'Boksburg', '1459'],
    ['alberton', 'Alberton Library', 'Alberton civic precinct, Ekurhuleni', 'Alberton', '1449'],
    ['kempton', 'Kempton Park Library', 'Kempton Park CBD, Ekurhuleni', 'Kempton Park', '1619'],
  ];
  for (const [id, name, address, city, postalCode] of locations)
    await db.libraryBranch.upsert({
      where: { id: `demo-${id}` },
      create: {
        id: `demo-${id}`,
        libraryId: library.id,
        name,
        address: `${address} (demo location)`,
        city,
        province: 'Gauteng',
        postalCode,
      },
      update: {},
    });
  const passwordHash = await bcrypt.hash('LibraryDemo2026!', 12);
  for (const [id, email, firstName, role] of [
    ['member', 'member@example.com', 'Demo Member', 'MEMBER'],
    ['librarian', 'librarian@example.com', 'Demo Librarian', 'LIBRARIAN'],
    ['admin', 'admin@example.com', 'Demo Admin', 'PLATFORM_ADMIN'],
  ] as const) {
    const user = await db.user.upsert({
      where: { email },
      create: {
        id: `demo-${id}`,
        email,
        firstName,
        lastName: 'Account',
        passwordHash,
        role,
        staffBranchId: role === 'LIBRARIAN' ? 'demo-germiston' : null,
        emailVerified: true,
      },
      update: {},
    });
    if (role === 'MEMBER')
      await db.libraryMembership.upsert({
        where: { userId_libraryId: { userId: user.id, libraryId: library.id } },
        create: { userId: user.id, libraryId: library.id, membershipNumber: 'EKU-DEMO-0001' },
        update: {},
      });
  }
  for (const [
    index,
    [isbn13, title, authorNames, category, publishedYear, publisher, description],
  ] of catalogue.entries()) {
    const book = await db.book.upsert({
      where: { id: `demo-book-${index + 1}` },
      create: {
        id: `demo-book-${index + 1}`,
        isbn13,
        title,
        category,
        publishedYear,
        publisher,
        description,
        language: 'English',
      },
      update: {},
    });
    for (const name of authorNames.split('|')) {
      const author = await db.author.upsert({ where: { name }, create: { name }, update: {} });
      await db.bookAuthor.upsert({
        where: { bookId_authorId: { bookId: book.id, authorId: author.id } },
        create: { bookId: book.id, authorId: author.id },
        update: {},
      });
    }
    for (const branchIndex of [0, (index % 3) + 1]) {
      for (let n = 1; n <= (branchIndex === 0 ? 2 : 1); n++) {
        const barcode = `${locations[branchIndex][0].slice(0, 3).toUpperCase()}-${String(index + 1).padStart(4, '0')}-${n}`;
        await db.bookCopy.upsert({
          where: { barcode },
          create: {
            bookId: book.id,
            branchId: `demo-${locations[branchIndex][0]}`,
            barcode,
            shelfLocation: `${category.slice(0, 3).toUpperCase()}-${index + 1}`,
            condition: 'Good',
          },
          update: {},
        });
      }
    }
  }
  // Seed circulation once; rerunning the seed never resets loans or user actions.
  const existing = await db.auditLog.findFirst({ where: { action: 'DEMO_CIRCULATION_SEEDED' } });
  if (!existing)
    await db.$transaction(async (tx) => {
      const member = await tx.user.findUniqueOrThrow({ where: { email: 'member@example.com' } });
      const staff = await tx.user.findUniqueOrThrow({ where: { email: 'librarian@example.com' } });
      for (const [barcode, kind] of [
        ['GER-0002-1', 'ready'],
        ['GER-0003-1', 'overdue'],
        ['GER-0004-1', 'loan'],
        ['GER-0005-1', 'history'],
        ['GER-0006-1', 'reserved'],
      ] as const) {
        const copy = await tx.bookCopy.findUniqueOrThrow({ where: { barcode } });
        if (copy.status !== 'AVAILABLE') continue;
        if (kind === 'ready' || kind === 'reserved') {
          await tx.reservation.create({
            data: {
              userId: member.id,
              bookId: copy.bookId,
              copyId: copy.id,
              pickupBranchId: copy.branchId,
              status: kind === 'ready' ? 'READY' : 'ACTIVE',
              readyAt: kind === 'ready' ? new Date() : null,
              expiresAt: kind === 'ready' ? new Date(Date.now() + 3 * 86400000) : null,
            },
          });
          await tx.bookCopy.update({
            where: { id: copy.id },
            data: { status: kind === 'ready' ? 'READY_FOR_COLLECTION' : 'RESERVED' },
          });
        } else {
          await tx.loan.create({
            data: {
              userId: member.id,
              copyId: copy.id,
              branchId: copy.branchId,
              checkedOutByUserId: staff.id,
              borrowedAt: new Date(Date.now() - 16 * 86400000),
              dueAt: new Date(Date.now() + (kind === 'loan' ? 7 : -2) * 86400000),
              status: kind === 'history' ? 'RETURNED' : kind === 'overdue' ? 'OVERDUE' : 'ACTIVE',
              returnedAt: kind === 'history' ? new Date(Date.now() - 3 * 86400000) : null,
            },
          });
          if (kind !== 'history')
            await tx.bookCopy.update({
              where: { id: copy.id },
              data: { status: kind === 'overdue' ? 'OVERDUE' : 'BORROWED' },
            });
        }
      }
      await tx.auditLog.create({
        data: { action: 'DEMO_CIRCULATION_SEEDED', entityType: 'System' },
      });
    });
  console.log(
    'Seed complete: 18 demo books, 54 copies, four branches, three demo accounts. Inventory is fictional.',
  );
} finally {
  await db.$disconnect();
}
