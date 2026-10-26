import { expect, test, type Page } from '@playwright/test';

interface Holiday {
  id: string;
  holidayDate: string;
  name: string;
  createdAt: string;
  createdBy: { id: string; username: string };
  resolvedExceptions?: number;
}

async function authenticate(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 'e2e-admin', username: 'e2e_admin', employeeId: null, roles: ['ADMIN'] }),
    );
    sessionStorage.setItem('access_token', 'synthetic-e2e-token');
    sessionStorage.setItem('refresh_token', 'synthetic-e2e-refresh-token');
  });
}

test('HR cấu hình và xóa ngày nghỉ lễ trên màn cấu hình ca', async ({ page }) => {
  const holidays: Holiday[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/shifts') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'shift-ca1',
            code: 'CA1',
            name: 'Ca 1',
            active: true,
            rules: [
              {
                id: 'rule-ca1-v4',
                version: 4,
                effectiveFrom: '2026-09-01T00:00:00.000Z',
                effectiveTo: null,
                scheduledStartSeconds: 25_200,
                scheduledCompletionSeconds: 68_400,
                breakStartSeconds: 43_200,
                breakEndSeconds: 46_800,
              },
            ],
          },
        ]),
      });
      return;
    }
    if (path === '/company-holidays' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(holidays) });
      return;
    }
    if (path === '/company-holidays' && request.method() === 'POST') {
      const body = request.postDataJSON() as { holidayDate: string; name: string };
      const created: Holiday = {
        id: '00000000-0000-0000-0000-000000000777',
        holidayDate: `${body.holidayDate}T00:00:00.000Z`,
        name: body.name,
        createdAt: '2026-10-24T10:00:00.000Z',
        createdBy: { id: 'e2e-admin', username: 'e2e_admin' },
        resolvedExceptions: 3,
      };
      holidays.push(created);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
      return;
    }
    if (path.startsWith('/company-holidays/') && request.method() === 'DELETE') {
      holidays.splice(0, holidays.length);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"deleted":true}' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await authenticate(page);
  await page.goto('/shifts');
  await expect(page.getByRole('heading', { name: 'Cấu hình ca làm việc' })).toBeVisible();
  await expect(page.getByText('cả giờ vào và giờ ra đều trống')).toBeVisible();
  await expect(page.getByText('07:00 – 19:00')).toBeVisible();

  await page.getByLabel('Tháng ngày nghỉ lễ').fill('2026-10');
  await page.getByLabel('Ngày nghỉ', { exact: true }).fill('2026-10-20');
  await page.getByLabel('Tên ngày nghỉ').fill('Ngày thành lập công ty');
  await page.getByRole('button', { name: 'Thêm ngày nghỉ' }).click();

  await expect(page.getByText('Ngày thành lập công ty')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('đóng 3 ngoại lệ');
  await page.getByRole('button', { name: 'Xóa Ngày thành lập công ty' }).click();
  await expect(page.getByRole('dialog', { name: 'Xác nhận xóa ngày nghỉ' })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa ngày nghỉ' }).click();
  await expect(page.getByText('Ngày thành lập công ty')).not.toBeVisible();
});
