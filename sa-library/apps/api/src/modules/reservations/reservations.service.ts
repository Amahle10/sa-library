import { randomUUID } from 'node:crypto';
import { getPrisma } from '../../lib/prisma.js';
import { atomic, audit, type Tx } from '../../lib/transaction.js';
import { AppError, required, conflict } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import type { CurrentUser } from '../auth/auth.service.js';
import { assertBranch, branchScope } from '../users/access.service.js';

export const reservationInclude = {
  book: true,
  copy: true,
  pickupBranch: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
};
export async function ensureMembership(tx: Tx, userId: string, libraryId: string) {
  const membership = await tx.libraryMembership.upsert({
    where: { userId_libraryId: { userId, libraryId } },
    create: { userId, libraryId, membershipNumber: `SA-${randomUUID()}` },
    update: {},
  });
  if (membership.status !== 'ACTIVE')
    throw new AppError(403, 'MEMBERSHIP_INACTIVE', 'Your library membership is not active.');
}
export async function reserve(user: CurrentUser, bookId: string, pickupBranchId: string) {
  return atomic(async (tx) => {
    required(await tx.book.findUnique({ where: { id: bookId } }), 'Book');
    const branch = required(
      await tx.libraryBranch.findUnique({ where: { id: pickupBranchId } }),
      'Branch',
    );
    const copy = await tx.bookCopy.findFirst({
      where: { bookId, branchId: pickupBranchId, status: 'AVAILABLE' },
      orderBy: { barcode: 'asc' },
    });
    if (!copy) conflict('No available copy exists at this branch.', 'BOOK_NOT_AVAILABLE');
    await ensureMembership(tx, user.id, branch.libraryId);
    const changed = await tx.bookCopy.updateMany({
      where: { id: copy.id, status: 'AVAILABLE' },
      data: { status: 'RESERVED' },
    });
    if (!changed.count) conflict('This copy was just reserved.', 'BOOK_NOT_AVAILABLE');
    const reservation = await tx.reservation.create({
      data: { userId: user.id, bookId, pickupBranchId, copyId: copy.id },
      include: reservationInclude,
    });
    await audit(tx, user.id, 'RESERVATION_CREATED', 'Reservation', reservation.id);
    return reservation;
  });
}
export function myReservations(userId: string) {
  return getPrisma().reservation.findMany({
    where: { userId, status: { in: ['ACTIVE', 'READY'] } },
    include: reservationInclude,
    orderBy: { reservedAt: 'desc' },
  });
}
export function staffReservations(user: CurrentUser) {
  return getPrisma().reservation.findMany({
    where: { pickupBranch: branchScope(user), status: { in: ['ACTIVE', 'READY'] } },
    include: reservationInclude,
    orderBy: { reservedAt: 'asc' },
  });
}
export async function cancelReservation(user: CurrentUser, id: string) {
  const reservation = required(
    await getPrisma().reservation.findUnique({ where: { id } }),
    'Reservation',
  );
  if (reservation.userId !== user.id) await assertBranch(user, reservation.pickupBranchId);
  return atomic(async (tx) => {
    const current = required(await tx.reservation.findUnique({ where: { id } }), 'Reservation');
    if (!['ACTIVE', 'READY'].includes(current.status))
      conflict('Only active or ready reservations can be cancelled.');
    await tx.bookCopy.update({ where: { id: current.copyId }, data: { status: 'AVAILABLE' } });
    const updated = await tx.reservation.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await audit(tx, user.id, 'RESERVATION_CANCELLED', 'Reservation', id);
    return updated;
  });
}
export async function readyReservation(user: CurrentUser, id: string) {
  const reservation = required(
    await getPrisma().reservation.findUnique({ where: { id } }),
    'Reservation',
  );
  await assertBranch(user, reservation.pickupBranchId);
  return atomic(async (tx) => {
    const current = required(await tx.reservation.findUnique({ where: { id } }), 'Reservation');
    if (current.status !== 'ACTIVE') conflict('Only active reservations can be marked ready.');
    const now = new Date();
    const updated = await tx.reservation.update({
      where: { id },
      data: {
        status: 'READY',
        readyAt: now,
        expiresAt: new Date(now.getTime() + env.COLLECTION_WINDOW_DAYS * 86400000),
      },
    });
    await tx.bookCopy.update({
      where: { id: current.copyId },
      data: { status: 'READY_FOR_COLLECTION' },
    });
    await tx.notification.create({
      data: {
        userId: current.userId,
        type: 'RESERVATION_READY',
        title: 'Your book is ready',
        message:
          'Your reserved book is ready for collection. Check My Library for the branch and collection deadline.',
      },
    });
    await audit(tx, user.id, 'RESERVATION_READY', 'Reservation', id);
    return updated;
  });
}
