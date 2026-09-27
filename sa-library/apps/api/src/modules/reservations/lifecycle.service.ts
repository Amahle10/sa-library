import { atomic } from '../../lib/transaction.js';
// Reconciled on circulation/catalogue requests, so expiry needs no separate worker in V1.
export async function reconcileCirculation() {
  await atomic(async (tx) => {
    const now = new Date();
    const expired = await tx.reservation.findMany({
      where: { status: 'READY', expiresAt: { lte: now } },
    });
    for (const reservation of expired) {
      await tx.reservation.update({ where: { id: reservation.id }, data: { status: 'EXPIRED' } });
      await tx.bookCopy.updateMany({
        where: { id: reservation.copyId, status: 'READY_FOR_COLLECTION' },
        data: { status: 'AVAILABLE' },
      });
    }
    const overdue = await tx.loan.findMany({
      where: { status: 'ACTIVE', dueAt: { lt: now }, returnedAt: null },
    });
    for (const loan of overdue) {
      await tx.loan.update({ where: { id: loan.id }, data: { status: 'OVERDUE' } });
      await tx.bookCopy.updateMany({
        where: { id: loan.copyId, status: 'BORROWED' },
        data: { status: 'OVERDUE' },
      });
    }
  });
}
