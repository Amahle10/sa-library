import { getPrisma } from '../../lib/prisma.js';
import { atomic, audit } from '../../lib/transaction.js';
import { required, conflict } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import type { CurrentUser } from '../auth/auth.service.js';
import { assertBranch, branchScope } from '../users/access.service.js';
import { ensureMembership } from '../reservations/reservations.service.js';
export const loanInclude = {
  copy: { include: { book: true } },
  branch: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
};
export async function checkout(staff: CurrentUser, userId: string, copyId: string) {
  const copy = required(await getPrisma().bookCopy.findUnique({ where: { id: copyId } }), 'Copy');
  const branch = await assertBranch(staff, copy.branchId);
  return atomic(async (tx) => {
    const member = required(await tx.user.findUnique({ where: { id: userId } }), 'Member');
    if (member.status !== 'ACTIVE') conflict('This member account is not active.');
    const current = required(await tx.bookCopy.findUnique({ where: { id: copyId } }), 'Copy');
    if (!['AVAILABLE', 'READY_FOR_COLLECTION'].includes(current.status))
      conflict(
        'Only available or ready-for-collection copies can be checked out.',
        'COPY_NOT_AVAILABLE',
      );
    const reservation = await tx.reservation.findFirst({
      where: { copyId, status: { in: ['ACTIVE', 'READY'] } },
    });
    if (
      current.status === 'READY_FOR_COLLECTION' &&
      (!reservation ||
        reservation.status !== 'READY' ||
        reservation.userId !== userId ||
        !reservation.expiresAt ||
        reservation.expiresAt <= new Date())
    )
      conflict('This reservation is not ready for this member.', 'RESERVATION_MISMATCH');
    if (current.status === 'AVAILABLE' && reservation)
      conflict('This copy has an active reservation.');
    if (await tx.loan.findFirst({ where: { copyId, returnedAt: null } }))
      conflict('This copy already has an active loan.');
    await ensureMembership(tx, userId, branch.libraryId);
    await tx.bookCopy.update({ where: { id: copyId }, data: { status: 'BORROWED' } });
    if (reservation)
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'COLLECTED', collectedAt: new Date() },
      });
    const loan = await tx.loan.create({
      data: {
        userId,
        copyId,
        branchId: current.branchId,
        checkedOutByUserId: staff.id,
        dueAt: new Date(Date.now() + env.LOAN_PERIOD_DAYS * 86400000),
      },
      include: loanInclude,
    });
    await audit(tx, staff.id, 'LOAN_CHECKED_OUT', 'Loan', loan.id);
    return loan;
  });
}
export async function returnCopy(staff: CurrentUser, copyId: string) {
  const copy = required(await getPrisma().bookCopy.findUnique({ where: { id: copyId } }), 'Copy');
  await assertBranch(staff, copy.branchId);
  return atomic(async (tx) => {
    const loan = await tx.loan.findFirst({ where: { copyId, returnedAt: null } });
    if (!loan) conflict('There is no active loan for this copy.');
    const updated = await tx.loan.update({
      where: { id: loan.id },
      data: { returnedAt: new Date(), status: 'RETURNED' },
      include: loanInclude,
    });
    await tx.bookCopy.update({ where: { id: copyId }, data: { status: 'AVAILABLE' } });
    await audit(tx, staff.id, 'LOAN_RETURNED', 'Loan', loan.id);
    return updated;
  });
}
export function myLoans(userId: string, history = false) {
  return getPrisma().loan.findMany({
    where: { userId, returnedAt: history ? { not: null } : null },
    include: loanInclude,
    orderBy: history ? { returnedAt: 'desc' } : { dueAt: 'asc' },
  });
}
export function staffLoans(user: CurrentUser, overdue = false) {
  return getPrisma().loan.findMany({
    where: {
      branch: branchScope(user),
      returnedAt: null,
      ...(overdue ? { dueAt: { lt: new Date() } } : {}),
    },
    include: loanInclude,
    orderBy: { dueAt: 'asc' },
  });
}
export async function checkoutByDetails(staff: CurrentUser, member: string, barcode: string) {
  const scope = branchScope(staff);
  const matches = await getPrisma().user.findMany({
    where: {
      OR: [
        { email: member.toLowerCase() },
        {
          memberships: {
            some: { membershipNumber: member, library: { branches: { some: scope } } },
          },
        },
      ],
    },
    take: 2,
  });
  if (matches.length > 1)
    conflict('This membership number matches multiple libraries. Use the member email.');
  const user = required(matches[0], 'Member');
  const copy = required(await getPrisma().bookCopy.findUnique({ where: { barcode } }), 'Copy');
  return checkout(staff, user.id, copy.id);
}
