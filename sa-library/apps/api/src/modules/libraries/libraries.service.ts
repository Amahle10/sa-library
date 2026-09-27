import { z } from 'zod';
import { getPrisma } from '../../lib/prisma.js';
import { atomic, audit } from '../../lib/transaction.js';
import { branchScope } from '../users/access.service.js';
import type { CurrentUser } from '../auth/auth.service.js';
export const librarySchema = z.object({
  name: z.string().trim().min(1).max(180),
  municipality: z.string().trim().min(1).max(120),
  province: z.string().trim().min(1).max(100),
  website: z
    .string()
    .url()
    .regex(/^https?:\/\//)
    .optional(),
});
export const branchSchema = z.object({
  name: z.string().trim().min(1).max(180),
  address: z.string().trim().min(1).max(300),
  suburb: z.string().max(120).optional(),
  city: z.string().trim().min(1).max(100),
  province: z.string().trim().min(1).max(100),
  postalCode: z.string().max(12).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
});
export function libraries() {
  return getPrisma().library.findMany({
    include: { branches: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  });
}
export async function createLibrary(user: CurrentUser, data: z.infer<typeof librarySchema>) {
  return atomic(async (tx) => {
    const library = await tx.library.create({ data });
    await audit(tx, user.id, 'LIBRARY_CREATED', 'Library', library.id);
    return library;
  });
}
export async function createBranch(
  user: CurrentUser,
  libraryId: string,
  input: z.infer<typeof branchSchema>,
) {
  return atomic(async (tx) => {
    const branch = await tx.libraryBranch.create({ data: { ...input, libraryId } });
    await audit(tx, user.id, 'BRANCH_CREATED', 'LibraryBranch', branch.id);
    return branch;
  });
}
export async function dashboard(user: CurrentUser) {
  const db = getPrisma();
  const branch = branchScope(user);
  const [
    totalCopies,
    availableCopies,
    borrowedCopies,
    activeReservations,
    readyForCollection,
    overdueLoans,
    branches,
  ] = await Promise.all([
    db.bookCopy.count({ where: { branch } }),
    db.bookCopy.count({ where: { branch, status: 'AVAILABLE' } }),
    db.bookCopy.count({ where: { branch, status: { in: ['BORROWED', 'OVERDUE'] } } }),
    db.reservation.count({ where: { pickupBranch: branch, status: 'ACTIVE' } }),
    db.reservation.count({ where: { pickupBranch: branch, status: 'READY' } }),
    db.loan.count({ where: { branch, returnedAt: null, dueAt: { lt: new Date() } } }),
    db.libraryBranch.findMany({ where: branch, include: { library: true } }),
  ]);
  return {
    totalCopies,
    availableCopies,
    borrowedCopies,
    activeReservations,
    readyForCollection,
    overdueLoans,
    branches,
  };
}
export async function totals() {
  const db = getPrisma();
  const [libraries, branches, books, copies, members, activeLoans] = await Promise.all([
    db.library.count(),
    db.libraryBranch.count(),
    db.book.count(),
    db.bookCopy.count(),
    db.user.count({ where: { role: 'MEMBER' } }),
    db.loan.count({ where: { returnedAt: null } }),
  ]);
  return { libraries, branches, books, copies, members, activeLoans };
}
export function members(user: CurrentUser, q: string) {
  // Search exact email for a first-time borrower; existing memberships are scoped to the staff library.
  return getPrisma().user.findMany({
    where: {
      role: 'MEMBER',
      OR: [
        ...(q ? [{ email: q.toLowerCase() }] : []),
        {
          memberships: {
            some: {
              library: { branches: { some: branchScope(user) } },
              ...(q
                ? {
                    OR: [
                      { membershipNumber: { contains: q, mode: 'insensitive' as const } },
                      {
                        user: {
                          OR: [
                            { firstName: { contains: q, mode: 'insensitive' as const } },
                            { lastName: { contains: q, mode: 'insensitive' as const } },
                          ],
                        },
                      },
                    ],
                  }
                : {}),
            },
          },
        },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      memberships: {
        where: { library: { branches: { some: branchScope(user) } } },
        include: { library: true },
      },
    },
    take: 100,
    orderBy: { lastName: 'asc' },
  });
}
