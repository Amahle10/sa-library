import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { getPrisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
const testUrl = new URL(env.DATABASE_URL);
if (
  !testUrl.pathname.endsWith('_test') ||
  !/^test_[a-f0-9]{32}$/.test(testUrl.searchParams.get('schema') ?? '')
)
  throw new Error('Integration tests require the isolated test runner. Use pnpm test.');
const db = getPrisma();
const password = 'TestLibrary2026!';
const token = (id: string) =>
  jwt.sign({}, env.JWT_SECRET, {
    subject: id,
    expiresIn: '1h',
    issuer: 'sa-library',
    audience: 'sa-library-web',
  });
const auth = (id = 'member') => ({ Authorization: `Bearer ${token(id)}` });
let hash: string;
beforeAll(async () => {
  hash = await bcrypt.hash(password, 4);
});
beforeEach(async () => {
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.notification.deleteMany(),
    db.loan.deleteMany(),
    db.reservation.deleteMany(),
    db.libraryMembership.deleteMany(),
    db.bookCopy.deleteMany(),
    db.bookAuthor.deleteMany(),
    db.author.deleteMany(),
    db.book.deleteMany(),
    db.user.deleteMany(),
    db.libraryBranch.deleteMany(),
    db.library.deleteMany(),
  ]);
  await db.library.create({
    data: { id: 'library', name: 'Test Library', municipality: 'Ekurhuleni', province: 'Gauteng' },
  });
  await db.libraryBranch.createMany({
    data: ['branch', 'other-branch'].map((id) => ({
      id,
      libraryId: 'library',
      name: id,
      address: 'Demo address',
      city: 'Germiston',
      province: 'Gauteng',
    })),
  });
  await db.user.createMany({
    data: [
      {
        id: 'member',
        email: 'member@test.example',
        firstName: 'Member',
        lastName: 'One',
        passwordHash: hash,
      },
      {
        id: 'member2',
        email: 'member2@test.example',
        firstName: 'Member',
        lastName: 'Two',
        passwordHash: hash,
      },
      {
        id: 'staff',
        email: 'staff@test.example',
        firstName: 'Staff',
        lastName: 'One',
        passwordHash: hash,
        role: 'LIBRARIAN',
        staffBranchId: 'branch',
      },
      {
        id: 'other-staff',
        email: 'other@test.example',
        firstName: 'Staff',
        lastName: 'Two',
        passwordHash: hash,
        role: 'LIBRARIAN',
        staffBranchId: 'other-branch',
      },
      {
        id: 'admin',
        email: 'admin@test.example',
        firstName: 'Admin',
        lastName: 'One',
        passwordHash: hash,
        role: 'PLATFORM_ADMIN',
      },
    ],
  });
  await db.book.create({
    data: {
      id: 'book',
      title: 'Clean Code',
      isbn13: '9780132350884',
      authors: { create: { author: { create: { name: 'Robert C. Martin' } } } },
    },
  });
  await db.bookCopy.create({
    data: { id: 'copy', bookId: 'book', branchId: 'branch', barcode: 'TEST-001' },
  });
});
afterAll(async () => {
  await db.$disconnect();
});
const reserve = (user = 'member') =>
  request(app)
    .post('/api/reservations')
    .set(auth(user))
    .send({ bookId: 'book', pickupBranchId: 'branch' });
const checkout = (userId = 'member', staffId = 'staff') =>
  request(app)
    .post('/api/staff/loans/checkout')
    .set(auth(staffId))
    .send({ userId, copyId: 'copy' });

describe('Authentication', () => {
  it('registers, normalizes email and never exposes passwordHash', async () => {
    const response = await request(app).post('/api/auth/register').send({
      firstName: 'Amahle',
      lastName: 'Reader',
      email: ' NEW@Example.com ',
      password,
      role: 'PLATFORM_ADMIN',
    });
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('new@example.com');
    expect(response.body.user.role).toBe('MEMBER');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    const stored = await db.user.findUniqueOrThrow({ where: { email: 'new@example.com' } });
    expect(await bcrypt.compare(password, stored.passwordHash)).toBe(true);
  });
  it('rejects duplicate normalized email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ firstName: 'A', lastName: 'B', email: 'MEMBER@test.example', password });
    expect(response.status).toBe(409);
  });
  it('logs in and /me loads fresh database profile', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'member@test.example', password });
    expect(login.status).toBe(200);
    await db.user.update({ where: { id: 'member' }, data: { firstName: 'Updated' } });
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.body.firstName).toBe('Updated');
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  });
  it('rejects incorrect password', async () => {
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'member@test.example', password: 'incorrect' })
      ).status,
    ).toBe(401);
  });
  it('/me requires auth and rejects invalid tokens', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid')).status,
    ).toBe(401);
  });
  it('rejects suspended users even with an existing token', async () => {
    await db.user.update({ where: { id: 'member' }, data: { status: 'SUSPENDED' } });
    expect((await request(app).get('/api/auth/me').set(auth())).status).toBe(401);
  });
  it('validates registration fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('logs out successfully', async () => {
    expect((await request(app).post('/api/auth/logout').set(auth())).status).toBe(204);
  });
});
describe('Catalogue and permissions', () => {
  it.each(['clean', '9780132350884', 'Robert'])(
    'searches by title, ISBN or author: %s',
    async (q) => {
      const response = await request(app).get('/api/books').query({ q });
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('book');
    },
  );
  it('returns branch availability without borrower data', async () => {
    const response = await request(app).get('/api/books/book');
    expect(response.body.authors).toEqual(['Robert C. Martin']);
    expect(response.body.availability[0]).toMatchObject({
      branchId: 'branch',
      totalCopies: 1,
      availableCopies: 1,
      borrowedCopies: 0,
    });
    expect(JSON.stringify(response.body)).not.toContain('member@test');
  });
  it('returns 404 for missing books', async () => {
    expect((await request(app).get('/api/books/missing')).status).toBe(404);
  });
  it('blocks members from staff and admin endpoints', async () => {
    expect((await request(app).get('/api/staff/loans').set(auth())).status).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/books')
          .set(auth())
          .send({ title: 'Book', authors: ['Author'] })
      ).status,
    ).toBe(403);
    expect((await request(app).get('/api/admin/totals').set(auth('staff'))).status).toBe(403);
  });
  it('creates books and copies, edits copy metadata and rejects duplicate barcodes', async () => {
    const book = await request(app)
      .post('/api/books')
      .set(auth('staff'))
      .send({ title: 'A New Book', authors: ['Writer'] });
    expect(book.status).toBe(201);
    const copy = await request(app)
      .post(`/api/books/${book.body.id}/copies`)
      .set(auth('staff'))
      .send({ branchId: 'branch', barcode: 'NEW-001' });
    expect(copy.status).toBe(201);
    expect(
      (
        await request(app)
          .patch(`/api/copies/${copy.body.id}`)
          .set(auth('staff'))
          .send({ shelfLocation: 'FIC', condition: 'Fair' })
      ).body.shelfLocation,
    ).toBe('FIC');
    expect(
      (
        await request(app)
          .post(`/api/books/${book.body.id}/copies`)
          .set(auth('staff'))
          .send({ branchId: 'branch', barcode: 'NEW-001' })
      ).status,
    ).toBe(409);
  });
  it('limits librarians to their branch', async () => {
    expect(
      (await request(app).get('/api/branches/branch/copies').set(auth('other-staff'))).status,
    ).toBe(403);
    expect((await checkout('member', 'other-staff')).status).toBe(403);
  });
  it('allows platform admins to create libraries and branches', async () => {
    const lib = await request(app)
      .post('/api/admin/libraries')
      .set(auth('admin'))
      .send({ name: 'Demo Library', municipality: 'Demo City', province: 'Gauteng' });
    expect(lib.status).toBe(201);
    const branch = await request(app)
      .post(`/api/admin/libraries/${lib.body.id}/branches`)
      .set(auth('admin'))
      .send({
        name: 'New Branch',
        address: 'Demo address',
        city: 'Demo City',
        province: 'Gauteng',
      });
    expect(branch.status).toBe(201);
    expect((await request(app).get('/api/admin/totals').set(auth('admin'))).body.libraries).toBe(2);
  });
});
describe('Reservation transactions', () => {
  it('reserves an available copy, changes status and creates a membership', async () => {
    const response = await reserve();
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('ACTIVE');
    expect((await db.bookCopy.findUniqueOrThrow({ where: { id: 'copy' } })).status).toBe(
      'RESERVED',
    );
    expect(await db.libraryMembership.count()).toBe(1);
  });
  it('cannot reserve an unavailable copy', async () => {
    await reserve();
    const response = await reserve('member2');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BOOK_NOT_AVAILABLE');
  });
  it('cancels and releases the copy', async () => {
    const response = await reserve();
    expect(
      (await request(app).delete(`/api/reservations/${response.body.id}`).set(auth())).status,
    ).toBe(200);
    expect((await db.bookCopy.findUniqueOrThrow({ where: { id: 'copy' } })).status).toBe(
      'AVAILABLE',
    );
  });
  it('prevents cancellation by another member', async () => {
    const res = await reserve();
    expect(
      (await request(app).delete(`/api/reservations/${res.body.id}`).set(auth('member2'))).status,
    ).toBe(403);
  });
  it('allows staff cancellation at their branch', async () => {
    const res = await reserve();
    expect(
      (await request(app).delete(`/api/reservations/${res.body.id}`).set(auth('staff'))).status,
    ).toBe(200);
  });
  it('two concurrent users cannot reserve the same physical copy', async () => {
    const results = await Promise.all([reserve(), reserve('member2')]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db.reservation.count({ where: { status: 'ACTIVE' } })).toBe(1);
  });
  it('marks ready, sets the collection window and notifies the member', async () => {
    const res = await reserve();
    const ready = await request(app)
      .patch(`/api/staff/reservations/${res.body.id}/ready`)
      .set(auth('staff'));
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('READY');
    expect(new Date(ready.body.expiresAt).getTime() - new Date(ready.body.readyAt).getTime()).toBe(
      3 * 86400000,
    );
    expect((await db.bookCopy.findUniqueOrThrow({ where: { id: 'copy' } })).status).toBe(
      'READY_FOR_COLLECTION',
    );
    expect(await db.notification.count()).toBe(1);
  });
  it('expires a ready reservation and releases the copy', async () => {
    const res = await reserve();
    await request(app).patch(`/api/staff/reservations/${res.body.id}/ready`).set(auth('staff'));
    await db.reservation.update({
      where: { id: res.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const book = await request(app).get('/api/books/book');
    expect(book.body.availableCopies).toBe(1);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: res.body.id } })).status).toBe(
      'EXPIRED',
    );
  });
  it('cannot change circulation status through copy editing', async () => {
    await reserve();
    expect(
      (
        await request(app)
          .patch('/api/copies/copy')
          .set(auth('staff'))
          .send({ status: 'AVAILABLE' })
      ).status,
    ).toBe(409);
  });
});
describe('Loan transactions', () => {
  it('checks out, exposes the loan, returns and adds borrowing history', async () => {
    const loan = await checkout();
    expect(loan.status).toBe(201);
    expect(loan.body.status).toBe('ACTIVE');
    expect((await db.bookCopy.findUniqueOrThrow({ where: { id: 'copy' } })).status).toBe(
      'BORROWED',
    );
    expect((await request(app).get('/api/loans/me').set(auth())).body[0].id).toBe(loan.body.id);
    expect((await request(app).get('/api/loans/me').set(auth('member2'))).body).toHaveLength(0);
    expect(
      (
        await request(app)
          .post('/api/staff/loans/return')
          .set(auth('staff'))
          .send({ copyId: 'copy' })
      ).status,
    ).toBe(200);
    expect((await db.bookCopy.findUniqueOrThrow({ where: { id: 'copy' } })).status).toBe(
      'AVAILABLE',
    );
    expect((await request(app).get('/api/loans/history').set(auth())).body[0].status).toBe(
      'RETURNED',
    );
    expect((await request(app).get('/api/loans/me').set(auth())).body).toHaveLength(0);
  });
  it('rejects double checkout including simultaneous requests', async () => {
    const results = await Promise.all([checkout(), checkout('member2')]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db.loan.count()).toBe(1);
  });
  it('enforces reservation readiness and ownership before collection', async () => {
    const res = await reserve();
    expect((await checkout()).status).toBe(409);
    await request(app).patch(`/api/staff/reservations/${res.body.id}/ready`).set(auth('staff'));
    expect((await checkout('member2')).status).toBe(409);
    expect((await checkout()).status).toBe(201);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: res.body.id } })).status).toBe(
      'COLLECTED',
    );
  });
  it('checks out by email and typed barcode', async () => {
    expect(
      (
        await request(app)
          .post('/api/staff/loans/checkout')
          .set(auth('staff'))
          .send({ member: 'MEMBER@test.example', barcode: 'TEST-001' })
      ).status,
    ).toBe(201);
  });
  it('finds members and checks out by membership number', async () => {
    await db.libraryMembership.create({
      data: { userId: 'member', libraryId: 'library', membershipNumber: 'TEST-MEMBER' },
    });
    expect(
      (await request(app).get('/api/staff/members?q=TEST-MEMBER').set(auth('staff'))).body[0].id,
    ).toBe('member');
    expect(
      (
        await request(app)
          .post('/api/staff/loans/checkout')
          .set(auth('staff'))
          .send({ member: 'TEST-MEMBER', barcode: 'TEST-001' })
      ).status,
    ).toBe(201);
  });
  it('shows overdue loans and updates physical copy status', async () => {
    const res = await checkout();
    await db.loan.update({
      where: { id: res.body.id },
      data: {
        borrowedAt: new Date(Date.now() - 20 * 86400000),
        dueAt: new Date(Date.now() - 86400000),
      },
    });
    const overdue = await request(app).get('/api/staff/loans?overdue=true').set(auth('staff'));
    expect(overdue.body[0].status).toBe('OVERDUE');
    expect((await db.bookCopy.findUniqueOrThrow({ where: { id: 'copy' } })).status).toBe('OVERDUE');
  });
  it('cannot return twice', async () => {
    await checkout();
    await request(app).post('/api/staff/loans/return').set(auth('staff')).send({ copyId: 'copy' });
    expect(
      (
        await request(app)
          .post('/api/staff/loans/return')
          .set(auth('staff'))
          .send({ copyId: 'copy' })
      ).status,
    ).toBe(409);
  });
});
