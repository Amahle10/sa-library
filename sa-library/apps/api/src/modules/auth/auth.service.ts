import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { getPrisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import type { Prisma } from '../../generated/prisma/client.js';

export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  emailVerified: true,
  staffBranchId: true,
  createdAt: true,
  staffBranch: { include: { library: true } },
  memberships: { include: { library: true } },
} satisfies Prisma.UserSelect;
export type CurrentUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
const email = z.string().trim().toLowerCase().email().max(254);
const password = z
  .string()
  .min(10)
  .max(72)
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'Password must be at most 72 UTF-8 bytes',
  );
export const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email,
  password,
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
function token(userId: string) {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: '8h',
    issuer: 'sa-library',
    audience: 'sa-library-web',
  });
}
export async function register(input: z.infer<typeof registerSchema>) {
  const { password, ...profile } = input;
  const user = await getPrisma().user.create({
    data: { ...profile, passwordHash: await bcrypt.hash(password, 12) },
    select: publicUserSelect,
  });
  return { user, token: token(user.id) };
}
export async function login(input: z.infer<typeof loginSchema>) {
  const stored = await getPrisma().user.findUnique({ where: { email: input.email } });
  // A valid fallback hash keeps unknown-email checks computationally comparable.
  const valid = await bcrypt.compare(
    input.password,
    stored?.passwordHash ?? '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
  );
  if (!stored || !valid)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  if (stored.status !== 'ACTIVE')
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account is not active.');
  const user = await getPrisma().user.findUniqueOrThrow({
    where: { id: stored.id },
    select: publicUserSelect,
  });
  return { user, token: token(user.id) };
}
