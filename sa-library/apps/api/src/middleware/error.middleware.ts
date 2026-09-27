import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';

export const errorMiddleware: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status =
      error.code === 'P2002' ? 409 : error.code === 'P2025' || error.code === 'P2003' ? 404 : 500;
    if (status !== 500) {
      res.status(status).json({
        error: {
          code: status === 409 ? 'CONFLICT' : 'NOT_FOUND',
          message:
            status === 409
              ? 'A record with these unique details already exists.'
              : 'The requested record does not exist.',
        },
      });
      return;
    }
  }
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    (error.status === 400 || error.status === 413)
  ) {
    res.status(error.status).json({
      error: { code: 'INVALID_REQUEST', message: 'The request body is invalid or too large.' },
    });
    return;
  }
  console.error(error);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  });
};
