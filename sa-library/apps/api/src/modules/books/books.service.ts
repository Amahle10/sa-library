import { z } from 'zod';
import { getPrisma } from '../../lib/prisma.js';
import { required } from '../../lib/errors.js';
import { atomic, audit } from '../../lib/transaction.js';
import type { CurrentUser } from '../auth/auth.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

export const bookSchema = z.object({
  title: z.string().trim().min(1).max(240),
  subtitle: z.string().trim().max(240).optional(),
  authors: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  isbn13: z
    .string()
    .regex(/^\d{13}$/)
    .optional(),
  isbn10: z
    .string()
    .regex(/^\d{9}[\dXx]$/)
    .optional(),
  description: z.string().max(5000).optional(),
  publisher: z.string().max(160).optional(),
  publishedYear: z.number().int().min(1000).max(2100).optional(),
  language: z.string().trim().min(1).max(60).default('English'),
  coverUrl: z
    .string()
    .url()
    .regex(/^https?:\/\//)
    .optional(),
  category: z.string().max(100).optional(),
});
const include = {
  authors: { include: { author: true } },
  copies: { include: { branch: true } },
} satisfies Prisma.BookInclude;
type FullBook = Prisma.BookGetPayload<{ include: typeof include }>;
function present(book: FullBook) {
  const { copies, authors, ...metadata } = book;
  const availability = [...new Set(copies.map((c) => c.branchId))].map((branchId) => {
    const atBranch = copies.filter((c) => c.branchId === branchId);
    return {
      branchId,
      branchName: atBranch[0].branch.name,
      city: atBranch[0].branch.city,
      totalCopies: atBranch.length,
      availableCopies: atBranch.filter((c) => c.status === 'AVAILABLE').length,
      reservedCopies: atBranch.filter((c) =>
        ['RESERVED', 'READY_FOR_COLLECTION'].includes(c.status),
      ).length,
      borrowedCopies: atBranch.filter((c) => ['BORROWED', 'OVERDUE'].includes(c.status)).length,
      unavailableCopies: atBranch.filter((c) => ['LOST', 'DAMAGED'].includes(c.status)).length,
    };
  });
  return {
    ...metadata,
    authors: authors.map((a) => a.author.name),
    totalCopies: copies.length,
    availableCopies: copies.filter((c) => c.status === 'AVAILABLE').length,
    availability,
  };
}
export async function listBooks(q = '') {
  const contains = { contains: q, mode: 'insensitive' as const };
  const books = await getPrisma().book.findMany({
    where: q
      ? {
          OR: [
            { title: contains },
            { isbn13: contains },
            { isbn10: contains },
            { authors: { some: { author: { name: contains } } } },
          ],
        }
      : {},
    include,
    orderBy: { title: 'asc' },
    take: 200,
  });
  return books.map(present);
}
export async function getBook(id: string) {
  return present(required(await getPrisma().book.findUnique({ where: { id }, include }), 'Book'));
}
export async function createBook(user: CurrentUser, input: z.infer<typeof bookSchema>) {
  const { authors, ...data } = input;
  const book = await atomic(async (tx) => {
    const book = await tx.book.create({ data });
    for (const name of new Set(authors)) {
      const author = await tx.author.upsert({ where: { name }, create: { name }, update: {} });
      await tx.bookAuthor.create({ data: { bookId: book.id, authorId: author.id } });
    }
    await audit(tx, user.id, 'BOOK_CREATED', 'Book', book.id);
    return book;
  });
  return getBook(book.id);
}
