import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, staffOnly } from '../middleware/auth.middleware.js';
import { login, loginSchema, register, registerSchema } from '../modules/auth/auth.service.js';
import * as books from '../modules/books/books.service.js';
import * as copies from '../modules/copies/copies.service.js';
import * as reservations from '../modules/reservations/reservations.service.js';
import * as loans from '../modules/loans/loans.service.js';
import * as libraries from '../modules/libraries/libraries.service.js';
import { reconcileCirculation } from '../modules/reservations/lifecycle.service.js';
import { getPrisma } from '../lib/prisma.js';

export const apiRouter = Router();
const id = (value: unknown) => z.string().min(1).max(200).parse(value);
const query = (value: unknown) => z.string().trim().max(200).default('').parse(value);
apiRouter.get('/health', (_req, res) => res.json({ status: 'ok', service: 'sa-library-api' }));
apiRouter.post('/auth/register', async (req, res) =>
  res.status(201).json(await register(registerSchema.parse(req.body))),
);
apiRouter.post('/auth/login', async (req, res) =>
  res.json(await login(loginSchema.parse(req.body))),
);
apiRouter.get('/auth/me', authenticate, (req, res) => res.json(req.user));
apiRouter.post('/auth/logout', authenticate, (_req, res) => res.status(204).end());
apiRouter.get('/libraries', async (_req, res) => res.json(await libraries.libraries()));
const circulation = Router();
circulation.use(async (_req, _res, next) => {
  await reconcileCirculation();
  next();
});
circulation.get('/books', async (req, res) => res.json(await books.listBooks(query(req.query.q))));
circulation.get('/books/:id', async (req, res) => res.json(await books.getBook(id(req.params.id))));
circulation.post('/books', authenticate, staffOnly, async (req, res) =>
  res.status(201).json(await books.createBook(req.user!, books.bookSchema.parse(req.body))),
);
circulation.post('/books/:bookId/copies', authenticate, staffOnly, async (req, res) =>
  res
    .status(201)
    .json(
      await copies.addCopy(req.user!, id(req.params.bookId), copies.copySchema.parse(req.body)),
    ),
);
circulation.get('/branches/:branchId/copies', authenticate, staffOnly, async (req, res) =>
  res.json(await copies.listCopies(req.user!, id(req.params.branchId))),
);
circulation.patch('/copies/:copyId', authenticate, staffOnly, async (req, res) =>
  res.json(
    await copies.editCopy(req.user!, id(req.params.copyId), copies.editCopySchema.parse(req.body)),
  ),
);
circulation.post('/reservations', authenticate, async (req, res) => {
  const data = z
    .object({ bookId: z.string().min(1), pickupBranchId: z.string().min(1) })
    .parse(req.body);
  res.status(201).json(await reservations.reserve(req.user!, data.bookId, data.pickupBranchId));
});
circulation.get('/reservations/me', authenticate, async (req, res) =>
  res.json(await reservations.myReservations(req.user!.id)),
);
circulation.delete('/reservations/:id', authenticate, async (req, res) =>
  res.json(await reservations.cancelReservation(req.user!, id(req.params.id))),
);
circulation.get('/loans/me', authenticate, async (req, res) =>
  res.json(await loans.myLoans(req.user!.id)),
);
circulation.get('/loans/history', authenticate, async (req, res) =>
  res.json(await loans.myLoans(req.user!.id, true)),
);
circulation.get('/notifications/me', authenticate, async (req, res) =>
  res.json(
    await getPrisma().notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ),
);
const staff = Router();
staff.use(authenticate, staffOnly);
staff.get('/dashboard', async (req, res) => res.json(await libraries.dashboard(req.user!)));
staff.get('/members', async (req, res) =>
  res.json(await libraries.members(req.user!, query(req.query.q))),
);
staff.get('/reservations', async (req, res) =>
  res.json(await reservations.staffReservations(req.user!)),
);
staff.patch('/reservations/:id/ready', async (req, res) =>
  res.json(await reservations.readyReservation(req.user!, id(req.params.id))),
);
staff.get('/loans', async (req, res) =>
  res.json(
    await loans.staffLoans(
      req.user!,
      z.enum(['true', 'false']).default('false').parse(req.query.overdue) === 'true',
    ),
  ),
);
staff.post('/loans/checkout', async (req, res) => {
  const data = z
    .union([
      z.object({ userId: z.string().min(1), copyId: z.string().min(1) }),
      z.object({
        member: z.string().trim().min(1).max(254),
        barcode: z.string().trim().min(1).max(80),
      }),
    ])
    .parse(req.body);
  res
    .status(201)
    .json(
      'userId' in data
        ? await loans.checkout(req.user!, data.userId, data.copyId)
        : await loans.checkoutByDetails(req.user!, data.member, data.barcode),
    );
});
staff.post('/loans/return', async (req, res) => {
  const data = z.object({ copyId: z.string().min(1) }).parse(req.body);
  res.json(await loans.returnCopy(req.user!, data.copyId));
});
circulation.use('/staff', staff);
apiRouter.use(circulation);
const admin = Router();
admin.use(authenticate, authorize('PLATFORM_ADMIN'));
admin.get('/totals', async (_req, res) => res.json(await libraries.totals()));
admin.get('/libraries', async (_req, res) => res.json(await libraries.libraries()));
admin.post('/libraries', async (req, res) =>
  res
    .status(201)
    .json(await libraries.createLibrary(req.user!, libraries.librarySchema.parse(req.body))),
);
admin.post('/libraries/:id/branches', async (req, res) =>
  res
    .status(201)
    .json(
      await libraries.createBranch(
        req.user!,
        id(req.params.id),
        libraries.branchSchema.parse(req.body),
      ),
    ),
);
apiRouter.use('/admin', admin);
