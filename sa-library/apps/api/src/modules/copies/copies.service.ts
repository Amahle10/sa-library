import { z } from 'zod';
import { getPrisma } from '../../lib/prisma.js';
import { atomic, audit } from '../../lib/transaction.js';
import { required, conflict } from '../../lib/errors.js';
import type { CurrentUser } from '../auth/auth.service.js';
import { assertBranch } from '../users/access.service.js';
export const copySchema = z.object({
  branchId: z.string().min(1),
  barcode: z.string().trim().min(1).max(80),
  shelfLocation: z.string().max(100).optional(),
  condition: z.string().max(200).optional(),
});
export const editCopySchema = z
  .object({
    barcode: z.string().trim().min(1).max(80).optional(),
    shelfLocation: z.string().max(100).nullable().optional(),
    condition: z.string().max(200).nullable().optional(),
    status: z.enum(['AVAILABLE', 'LOST', 'DAMAGED']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field');
export async function addCopy(
  user: CurrentUser,
  bookId: string,
  input: z.infer<typeof copySchema>,
) {
  await assertBranch(user, input.branchId);
  return atomic(async (tx) => {
    const copy = await tx.bookCopy.create({ data: { ...input, bookId } });
    await audit(tx, user.id, 'COPY_CREATED', 'BookCopy', copy.id);
    return copy;
  });
}
export async function listCopies(user: CurrentUser, branchId: string) {
  await assertBranch(user, branchId);
  return getPrisma().bookCopy.findMany({
    where: { branchId },
    include: { book: true, branch: true },
    orderBy: { barcode: 'asc' },
  });
}
export async function editCopy(
  user: CurrentUser,
  id: string,
  input: z.infer<typeof editCopySchema>,
) {
  const copy = required(await getPrisma().bookCopy.findUnique({ where: { id } }), 'Copy');
  await assertBranch(user, copy.branchId);
  return atomic(async (tx) => {
    const current = required(await tx.bookCopy.findUnique({ where: { id } }), 'Copy');
    if (input.status && !['AVAILABLE', 'LOST', 'DAMAGED'].includes(current.status))
      conflict('Return or cancel the active circulation record before changing copy status.');
    const updated = await tx.bookCopy.update({ where: { id }, data: input });
    await audit(tx, user.id, 'COPY_UPDATED', 'BookCopy', id);
    return updated;
  });
}
