import type { Prisma } from '../../generated/prisma/client.js';
import type { CurrentUser } from '../auth/auth.service.js';
import { AppError, required } from '../../lib/errors.js';
import { getPrisma } from '../../lib/prisma.js';

export function branchScope(user: CurrentUser): Prisma.LibraryBranchWhereInput {
  if (user.role === 'PLATFORM_ADMIN') return {};
  if (!user.staffBranch)
    throw new AppError(403, 'NO_BRANCH', 'No staff branch is assigned to your account.');
  return user.role === 'LIBRARY_ADMIN'
    ? { libraryId: user.staffBranch.libraryId }
    : { id: user.staffBranch.id };
}
export async function assertBranch(user: CurrentUser, branchId: string) {
  const branch = required(
    await getPrisma().libraryBranch.findUnique({ where: { id: branchId } }),
    'Branch',
  );
  if (user.role === 'PLATFORM_ADMIN') return branch;
  if (
    !user.staffBranch ||
    (user.role === 'LIBRARY_ADMIN'
      ? user.staffBranch.libraryId !== branch.libraryId
      : user.role !== 'LIBRARIAN' || user.staffBranch.id !== branch.id)
  ) {
    throw new AppError(403, 'BRANCH_FORBIDDEN', 'This branch is outside your staff assignment.');
  }
  return branch;
}
