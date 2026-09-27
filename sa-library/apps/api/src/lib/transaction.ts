import { Prisma } from '../generated/prisma/client.js';
import { getPrisma } from './prisma.js';
import { AppError } from './errors.js';
export type Tx = Prisma.TransactionClient;
export async function atomic<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await getPrisma().$transaction(work, {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034')
        throw error;
      if (attempt === 3)
        throw new AppError(409, 'CONCURRENT_CHANGE', 'This item changed. Please try again.');
      await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)));
    }
  }
  throw new Error('Unreachable transaction state');
}
export async function audit(
  tx: Tx,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
) {
  await tx.auditLog.create({ data: { actorUserId, action, entityType, entityId } });
}
