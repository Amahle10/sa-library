import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { getPrisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { publicUserSelect, type CurrentUser } from '../modules/auth/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in.');
  let id: string;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'sa-library',
      audience: 'sa-library-web',
    });
    if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid subject');
    id = payload.sub;
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Your session has expired. Please sign in again.');
  }
  const user = await getPrisma().user.findUnique({ where: { id }, select: publicUserSelect });
  if (!user || user.status !== 'ACTIVE')
    throw new AppError(401, 'ACCOUNT_INACTIVE', 'Your account is unavailable.');
  req.user = user;
  next();
};
export const authorize =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in.');
    if (!roles.includes(req.user.role))
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this action.');
    next();
  };
export const staffOnly = authorize('LIBRARIAN', 'LIBRARY_ADMIN', 'PLATFORM_ADMIN');
