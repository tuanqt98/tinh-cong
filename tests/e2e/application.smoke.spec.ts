import { expect, test } from '@playwright/test';

const emptyApiPaths = [
  '/departments',
  '/employees',
  '/attendance',
  '/exceptions',
  '/periods',
  '/publications',
  '/me/timesheets',
  '/shifts',
  '/company-holidays',
  '/audit-logs',
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');

    if (path === '/auth/login' && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'synthetic-e2e-token',
          refreshToken: 'synthetic-e2e-refresh-token',
          user: { id: 'e2e-user', username: 'e2e_admin', employeeId: null, roles: ['ADMIN'] },
        }),
      });
      return;
    }

    if (path === '/dashboard') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          employees: 1,
          employeesWithAttendance: 1,
          totalWorkedSeconds: 28_800,
          openExceptions: 0,
          pendingPeriods: 0,
          publishedTimesheets: 0,
          openFeedback: 0,
          tierSeconds: {
            tier100: 28_800,
            tier130: 0,
            tier150: 0,
            tier200: 0,
            tier210: 0,
            tier230: 0,
          },
        }),
      });
      return;
    }

    if (path === '/employees/statistics') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"total":0,"ACTIVE":0,"ON_LEAVE":0,"RESIGNED":0}',
      });
      return;
    }

    if (path === '/employees') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"items":[],"total":0,"page":1,"pageSize":20}',
      });
      return;
    }

    if (path === '/periods') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '00000000-0000-0000-0000-000000000901',
            year: 2026,
            month: 10,
            status: 'DRAFT',
            version: 1,
            lockedAt: null,
            publishedAt: null,
          },
        ]),
      });
      return;
    }

    if (path === '/attendance/summary') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          pageSize: 10,
          period: {
            id: '00000000-0000-0000-0000-000000000901',
            year: 2026,
            month: 10,
            status: 'DRAFT',
            version: 1,
            lockedAt: null,
            publishedAt: null,
          },
          totals: {
            employees: 0,
            calculatedEmployees: 0,
            workedSeconds: 0,
            tier100Seconds: 0,
            tier130Seconds: 0,
            tier150Seconds: 0,
            tier200Seconds: 0,
            tier210Seconds: 0,
            tier230Seconds: 0,
            lateCount: 0,
            earlyCount: 0,
            attendanceDays: 0,
            exceptionCount: 0,
          },
          workingDaysAvailable: false,
          calculationVersion: { engineVersions: [], maxRevision: null },
        }),
      });
      return;
    }

    if (emptyApiPaths.some((candidate) => path === candidate || path.startsWith(`${candidate}/`))) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
});

test('đăng nhập và hiển thị dashboard bằng API contract', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập').fill('e2e_admin');
  await page.locator('input[name="password"]').fill('Synthetic!123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Tổng quan HR' })).toBeVisible();
  await expect(page.getByText('8:00:00').first()).toBeVisible();
});

test('điều hướng đủ 12 màn hình và render trạng thái dữ liệu', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập').fill('e2e_admin');
  await page.locator('input[name="password"]').fill('Synthetic!123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  const routes = [
    '/dashboard',
    '/imports',
    '/employees',
    '/attendance',
    '/attendance/synthetic-employee',
    '/exceptions',
    '/periods',
    '/publications',
    '/me/timesheets',
    '/shifts',
    '/audit',
  ];

  for (const path of routes) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('TypeError');
  }
});

test('layout mobile mở được menu responsive', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập').fill('e2e_admin');
  await page.locator('input[name="password"]').fill('Synthetic!123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('button', { name: 'Mở menu' }).click();
  await expect(page.getByRole('link', { name: 'Import Excel' }).last()).toBeVisible();
});

test('tự refresh access token hết hạn và thử lại request', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    if (path === '/auth/refresh') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'refreshed-access-token',
          refreshToken: 'rotated-refresh-token',
          user: { id: 'e2e-user', username: 'e2e_admin', employeeId: null, roles: ['ADMIN'] },
        }),
      });
      return;
    }
    if (
      path === '/dashboard' &&
      request.headers().authorization === 'Bearer expired-access-token'
    ) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{"message":"Unauthorized"}',
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 'e2e-user',
        username: 'e2e_admin',
        employeeId: null,
        roles: ['ADMIN'],
      }),
    );
    sessionStorage.setItem('access_token', 'expired-access-token');
    sessionStorage.setItem('refresh_token', 'valid-refresh-token');
  });
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Tổng quan HR' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('access_token')))
    .toBe('refreshed-access-token');
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('refresh_token')))
    .toBe('rotated-refresh-token');
});

test('xác nhận import một lần và khóa nút sau khi thành công', async ({ page }) => {
  let confirmCalls = 0;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    if (path === '/imports/preview' && request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000001',
          status: 'PREVIEW',
          rowCount: 2765,
          sheets: ['Xuất lưới'],
          previewRows: [],
          issues: [],
          duplicateRuleConfigured: true,
          canConfirm: true,
        }),
      });
      return;
    }
    if (path === '/imports/00000000-0000-0000-0000-000000000001/confirm') {
      confirmCalls++;
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000001',
          status: 'ACCEPTED',
          rowCount: 2765,
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập').fill('e2e_admin');
  await page.locator('input[name="password"]').fill('Synthetic!123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.goto('/imports');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'synthetic.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('synthetic'),
  });
  await page.getByRole('button', { name: 'Kiểm tra lại' }).click();

  const confirmButton = page.getByRole('button', { name: 'Xác nhận import' });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(
    page.getByText(/Import thành công 2[.,]765 dòng; cảnh báo đã được chuyển sang Ngoại lệ\./),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đã import' })).toBeDisabled();
  expect(confirmCalls).toBe(1);
});

test('hiển thị lịch sử và dữ liệu raw đã import', async ({ page }) => {
  const importId = '00000000-0000-0000-0000-000000000002';
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    if (path === '/imports' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: importId,
              originalName: 'SX.xlsx',
              status: 'ACCEPTED',
              attemptedAt: '2026-10-22T09:00:00+07:00',
              confirmedAt: '2026-10-22T09:01:00+07:00',
              rejectionReason: null,
              _count: { issues: 1740, rawRows: 2765 },
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      });
      return;
    }
    if (path === `/imports/${importId}/rows`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'raw-1',
              sheet: 'Xuất lưới',
              rowNo: 4,
              employeeId: null,
              employeeCode: 'SYN-MASKED',
              employeeName: 'Nhân viên kiểm thử',
              departmentName: 'Phòng kiểm thử',
              attendanceDateRaw: '2026-09-01',
              checkInRaw: '08:00',
              checkOutRaw: '17:00',
              shiftNameRaw: 'Ca1',
              _count: { exceptions: 1, calculations: 0 },
            },
          ],
          total: 2765,
          page: 1,
          pageSize: 50,
        }),
      });
      return;
    }
    if (path === `/imports/${importId}/process` && request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          rawRows: 2765,
          linkedEmployees: 2705,
          missingEmployees: 60,
          missingEmployeeCodes: ['NV00084', 'NV00100'],
          promotedImportIssues: 1740,
          missingSchedules: 0,
          missingTimestampEvidence: 0,
          calculatedRows: 1025,
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập').fill('e2e_admin');
  await page.locator('input[name="password"]').fill('Synthetic!123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.goto('/imports');

  await page.getByRole('button', { name: 'Lịch sử import' }).click();
  await expect(page.getByText('SX.xlsx')).toBeVisible();
  await expect(page.getByText(/2[.,]765/)).toBeVisible();
  await page.getByRole('button', { name: 'Xem dữ liệu' }).click();
  await expect(page.getByText('SYN-MASKED')).toBeVisible();
  await expect(page.getByText('1 ngoại lệ')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chờ duyệt hồ sơ NV' })).toBeDisabled();
  await page.getByRole('button', { name: 'Xử lý dữ liệu' }).click();
  const warning = page.getByRole('alert');
  await expect(warning).toContainText('Thiếu 2 mã nhân viên đang hoạt động');
  await expect(warning).toContainText('NV00084');
  await expect(warning).toContainText('NV00100');
  await warning.getByRole('button', { name: 'Mở Quản lý nhân viên' }).click();
  await expect(page).toHaveURL(/\/employees$/);
});
