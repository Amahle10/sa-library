import { test, expect, type Page } from '@playwright/test';
const password = 'LibraryDemo2026!';
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}
test('member registers, reserves, collects and returns a book with staff', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email = `reader-${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('First name').fill('Browser');
  await page.getByLabel('Last name').fill('Reader');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password (10–72 characters)').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'My Library', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await login(page, email);
  await page.goto('/search');
  await page.getByRole('textbox', { name: 'Search by title, author or ISBN' }).fill('Clean Code');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('link', { name: 'View book' })).toHaveCount(1);
  await page.getByRole('link', { name: 'View book' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your pickup branch' })).toBeVisible();
  await page.getByRole('button', { name: 'Reserve at Germiston Library' }).click();
  await expect(page.getByRole('heading', { name: 'Your reservations' })).toBeVisible();
  await expect(
    page.getByText('The branch is preparing your book.', { exact: false }),
  ).toBeVisible();
  const staffContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
  const staff = await staffContext.newPage();
  await login(staff, 'librarian@example.com');
  await staff.goto('/staff/reservations');
  const row = staff.getByRole('row').filter({ hasText: email });
  await row.getByRole('button', { name: 'Mark ready' }).click();
  await expect(row.getByRole('button', { name: 'Checkout' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Collect by', { exact: false })).toBeVisible();
  await row.getByRole('button', { name: 'Checkout' }).click();
  await expect(row).toHaveCount(0);
  await page.goto('/my-library/loans');
  await expect(page.getByRole('link', { name: 'Clean Code', exact: true })).toBeVisible();
  await expect(page.getByText('Due ', { exact: false })).toBeVisible();
  await staff.goto('/staff/loans');
  await staff
    .getByRole('row')
    .filter({ hasText: email })
    .getByRole('button', { name: 'Return', exact: true })
    .click();
  await expect(staff.getByRole('row').filter({ hasText: email })).toHaveCount(0);
  await page.goto('/my-library/history');
  await expect(page.getByRole('link', { name: 'Clean Code', exact: true })).toBeVisible();
  await expect(page.getByText('Returned ', { exact: false }).first()).toBeVisible();
  await page.goto('/staff');
  await expect(page.getByRole('heading', { name: 'Staff access required' })).toBeVisible();
  expect(errors).toEqual([]);
  await staffContext.close();
});
test('staff adds a book and copy, edits it, and checks it out directly', async ({ page }) => {
  await login(page, 'librarian@example.com');
  await page.goto('/staff/catalogue');
  const title = `Browser catalogue ${Date.now()}`;
  const barcode = `BROWSER-${Date.now()}`;
  await page.getByText('Add a book', { exact: true }).click();
  const bookForm = page
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: 'Add a book' }) });
  await bookForm.getByLabel('Title', { exact: true }).fill(title);
  await bookForm.getByLabel('Authors (comma separated)').fill('Demo Author');
  await bookForm.getByRole('button', { name: 'Add book', exact: true }).click();
  await expect(bookForm.getByText('Saved successfully.')).toBeVisible();
  await page.getByText('Add a physical copy', { exact: true }).click();
  const copyForm = page
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: 'Add a physical copy' }) });
  await copyForm.getByLabel('Book', { exact: true }).selectOption({ label: title });
  await copyForm.getByLabel('Branch', { exact: true }).selectOption({ label: 'Germiston Library' });
  await copyForm.getByLabel('Unique barcode').fill(barcode);
  await copyForm.getByRole('button', { name: 'Add copy' }).click();
  const row = page.getByRole('row').filter({ hasText: barcode });
  await row.getByRole('button', { name: 'Edit copy' }).click();
  await page.getByRole('dialog').getByLabel('Shelf location').fill('DEMO-42');
  await page.getByRole('button', { name: 'Save copy' }).click();
  await expect(row).toContainText('DEMO-42');
  await page.goto('/staff/loans');
  await page.getByLabel('Member email or membership number').fill('member@example.com');
  await page.getByLabel('Book barcode').fill(barcode);
  await page.getByRole('button', { name: 'Check out book' }).click();
  await expect(page.getByRole('row').filter({ hasText: barcode })).toBeVisible();
  await page
    .getByRole('row')
    .filter({ hasText: barcode })
    .getByRole('button', { name: 'Return', exact: true })
    .click();
  await expect(page.getByRole('row').filter({ hasText: barcode })).toHaveCount(0);
});
test('platform admin creates a library and a branch', async ({ page }) => {
  await login(page, 'admin@example.com');
  await page.goto('/admin/libraries');
  await page.getByText('Create a library', { exact: true }).click();
  const form = page
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: 'Create a library' }) });
  await form.getByLabel('Library name').fill('Browser Demo Library');
  await form.getByLabel('Municipality').fill('Demo Municipality');
  await form.getByLabel('Province').fill('Gauteng');
  await form.getByRole('button', { name: 'Create library' }).click();
  await expect(page.getByRole('heading', { name: 'Browser Demo Library' })).toBeVisible();
  await page.getByText('Create a branch', { exact: true }).click();
  const branch = page
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: 'Create a branch' }) });
  await branch
    .getByLabel('Library', { exact: true })
    .selectOption({ label: 'Browser Demo Library' });
  await branch.getByLabel('Branch name').fill('Browser Demo Branch');
  await branch.getByLabel('Street address').fill('Demo civic precinct');
  await branch.getByLabel('City').fill('Germiston');
  await branch.getByLabel('Province').fill('Gauteng');
  await branch.getByRole('button', { name: 'Create branch' }).click();
  await expect(page.getByRole('heading', { name: 'Browser Demo Branch' })).toBeVisible();
});
test('homepage and search work at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good books. Closer to home.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search books', exact: true }).fill('9780132350884');
  await page.getByRole('button', { name: 'Find a book' }).click();
  await expect(page.getByRole('heading', { name: 'Clean Code', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
