import { expect, test, type Page } from '@playwright/test';

// Each run uses a fresh street so leftovers in the shared test database never collide (S5.4).
const street = () => `${Date.now()} E Golden Eagle Blvd`;

/** Matches FAILING_ZIP in weatherstack-stub.mjs. */
const FAILING_ZIP = '00000';

async function createProperty(page: Page, address: { street: string; zipCode: string }) {
  await page.goto('/properties/new');
  await page.getByLabel('Street').fill(address.street);
  await page.getByLabel('City').fill('Fountain Hills');
  await page.getByLabel('State').selectOption('AZ');
  await page.getByLabel('Zip code').fill(address.zipCode);
  await page.getByRole('button', { name: 'Create property' }).click();
}

const filters = (page: Page) => page.getByRole('form', { name: 'Filter properties' });

test('X4 happy path: create → appears in list → filter → detail → delete', async ({ page }) => {
  const address = { street: street(), zipCode: '85268' };

  // Create (S5.8): lands on the new property's detail view with its weather (S4.4).
  await createProperty(page, address);
  await expect(page.getByRole('heading', { level: 1, name: address.street })).toBeVisible();
  await expect(page.locator('dt:text-is("Latitude") + dd')).toHaveText('33.609');
  await expect(page.locator('dt:text-is("Longitude") + dd')).toHaveText('-111.729');
  const weather = page.getByRole('region', { name: 'Weather when recorded' });
  await expect(weather.getByText('79°F').first()).toBeVisible();
  await expect(weather.getByText('Overcast')).toBeVisible();
  const detailUrl = page.url();

  // Appears in the list (S1).
  await page.getByRole('link', { name: 'Covertree properties' }).click();
  const list = page.getByRole('list', { name: 'Properties' });
  await expect(list.getByRole('link', { name: new RegExp(address.street) })).toBeVisible();

  // Filter (S3): matching city substring + zip + state keeps it; a non-matching city hides it.
  await filters(page).getByLabel('City').fill('hills');
  await filters(page).getByLabel('Zip code').fill('85268');
  await filters(page).getByLabel('State').selectOption('AZ');
  await filters(page).getByRole('button', { name: 'Apply' }).click();
  await expect(list.getByRole('link', { name: new RegExp(address.street) })).toBeVisible();

  // Filters and sort persist in the URL across a reload (SPEC P1).
  await page.getByRole('button', { name: /Newest first/ }).click();
  await expect(page).toHaveURL('/?city=hills&zip=85268&state=AZ&sort=oldest');
  await page.reload();
  await expect(filters(page).getByLabel('City')).toHaveValue('hills');
  await expect(filters(page).getByLabel('State')).toHaveValue('AZ');
  await expect(page.getByRole('button', { name: /Oldest first/ })).toBeVisible();
  await expect(list.getByRole('link', { name: new RegExp(address.street) })).toBeVisible();

  await filters(page).getByLabel('City').fill('Nowhere');
  await filters(page).getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('No properties match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();

  // Detail (S4) → delete with confirmation (S6.6).
  await list.getByRole('link', { name: new RegExp(address.street) }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(address.street);
  await dialog.getByRole('button', { name: 'Delete property' }).click();

  // Back on the list it came from: filters were cleared, the sort was kept.
  await expect(page).toHaveURL('/?sort=oldest');
  await expect(page.getByRole('link', { name: new RegExp(address.street) })).toHaveCount(0);
  await page.goto(detailUrl);
  await expect(page.getByText('Property not found')).toBeVisible();
});

test('X4 failure path: Weatherstack success:false → weather error, list unchanged', async ({
  page,
}) => {
  const address = { street: street(), zipCode: FAILING_ZIP };
  const rows = page.getByRole('list', { name: 'Properties' }).getByRole('listitem');
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  const before = await rows.allTextContents();

  await createProperty(page, address);

  await expect(page.getByText('Weather data unavailable, property not created')).toBeVisible();
  // S5.8 — the form keeps its values.
  await expect(page.getByLabel('Street')).toHaveValue(address.street);
  await expect(page.getByLabel('Zip code')).toHaveValue(FAILING_ZIP);

  await page.getByRole('link', { name: 'Covertree properties' }).click();
  await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByText(address.street)).toHaveCount(0);
  expect(await rows.allTextContents()).toEqual(before);
});
