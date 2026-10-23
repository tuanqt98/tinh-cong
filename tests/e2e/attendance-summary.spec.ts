import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const periodId = '00000000-0000-0000-0000-000000000901';
const employeeId = '00000000-0000-0000-0000-000000000101';

const rows = Array.from({ length: 10 }, (_, index) => ({
  employeeId:
    index === 0 ? employeeId : `00000000-0000-0000-0000-${String(index + 101).padStart(12, '0')}`,
  employeeCode: `SYN-${String(index + 1).padStart(3, '0')}`,
  employeeName: `Nhân viên synthetic ${String(index + 1).padStart(2, '0')}`,
  departmentName: index % 2 ? 'Kỹ thuật' : 'Sản xuất',
  workedSeconds: 28_800 + index * 600,
  tier100Seconds: 28_800,
  tier130Seconds: index % 2 ? 1_800 : 0,
  tier150Seconds: index % 2 ? 0 : index * 600,
  tier210Seconds: 0,
  lateSeconds: index * 60,
  earlySeconds: index * 30,
  workingDays: null,
  attendanceDays: 1,
  exceptionCount: index === 1 ? 1 : 0,
  processingStatus: index === 1 ? 'NEEDS_REVIEW' : 'VALID',
  approvalStatus: 'DRAFT',
  calculated: true,
}));

const totals = rows.reduce(
  (result, row) => ({
    employees: result.employees + 1,
    calculatedEmployees: result.calculatedEmployees + 1,
    workedSeconds: result.workedSeconds + row.workedSeconds,
    tier100Seconds: result.tier100Seconds + row.tier100Seconds,
    tier130Seconds: result.tier130Seconds + row.tier130Seconds,
    tier150Seconds: result.tier150Seconds + row.tier150Seconds,
    tier210Seconds: result.tier210Seconds + row.tier210Seconds,
    lateSeconds: result.lateSeconds + row.lateSeconds,
    earlySeconds: result.earlySeconds + row.earlySeconds,
    attendanceDays: result.attendanceDays + row.attendanceDays,
    exceptionCount: result.exceptionCount + row.exceptionCount,
  }),
  {
    employees: 0,
    calculatedEmployees: 0,
    workedSeconds: 0,
    tier100Seconds: 0,
    tier130Seconds: 0,
    tier150Seconds: 0,
    tier210Seconds: 0,
    lateSeconds: 0,
    earlySeconds: 0,
    attendanceDays: 0,
    exceptionCount: 0,
  },
);

async function mockApi(page: Page, requests: string[]) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/auth/login') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'attendance-token',
          refreshToken: 'attendance-refresh',
          user: { id: 'admin-1', username: 'admin.synthetic', employeeId: null, roles: ['ADMIN'] },
        }),
      });
      return;
    }
    if (path === '/periods') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: periodId,
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
    if (path === '/departments') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'department-1', name: 'Sản xuất' },
          { id: 'department-2', name: 'Kỹ thuật' },
        ]),
      });
      return;
    }
    if (path === '/shifts') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'shift-1', code: 'CA1', name: 'Ca 1' },
          { id: 'shift-3', code: 'CA3', name: 'Ca 3' },
        ]),
      });
      return;
    }
    if (path === '/attendance/summary') {
      requests.push(url.toString());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: rows,
          total: 10,
          page: Number(url.searchParams.get('page') ?? 1),
          pageSize: Number(url.searchParams.get('pageSize') ?? 10),
          period: {
            id: periodId,
            year: 2026,
            month: 10,
            status: 'DRAFT',
            version: 1,
            lockedAt: null,
            publishedAt: null,
          },
          totals,
          workingDaysAvailable: false,
          calculationVersion: { engineVersions: ['synthetic-v1'], maxRevision: 1 },
        }),
      });
      return;
    }
    if (path === '/attendance/export') {
      requests.push(url.toString());
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: 'synthetic-xlsx',
      });
      return;
    }
    if (path === `/attendance/employee/${employeeId}`) {
      requests.push(url.toString());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'calculation-1',
            revision: 1,
            status: 'VALID',
            workedSeconds: 28_800,
            tier100Seconds: 28_800,
            tier130Seconds: 0,
            tier150Seconds: 0,
            tier210Seconds: 0,
            lateSeconds: 0,
            earlySeconds: 0,
            normalization: {
              shiftDate: '2026-10-01T00:00:00.000Z',
              shiftCode: 'CA1',
              checkInAt: '2026-10-01T01:00:00.000Z',
              checkOutAt: '2026-10-01T10:00:00.000Z',
            },
            raw: {
              employeeCode: 'SYN-001',
              employeeName: 'Nhân viên synthetic 01',
              departmentName: 'Sản xuất',
            },
            exceptions: [],
          },
        ]),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập').fill('admin.synthetic');
  await page.locator('input[name="password"]').fill('Synthetic!123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.goto(`/attendance?periodId=${periodId}`);
}

test('render bảng công tổng hợp từ API và lưu visual evidence 1536x1024', async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await login(page);

  await expect(page.getByRole('heading', { name: 'Bảng công tổng hợp' })).toBeVisible();
  await expect(page.getByText('Nhân viên synthetic 01')).toBeVisible();
  await expect(page.locator('thead th')).toHaveCount(18);
  await expect(page.getByText('Tổng cộng toàn bộ tập lọc')).toBeVisible();
  await expect(page.getByText('N/A').first()).toHaveAttribute('title', /Chưa có lịch/);
  await expect(page.getByText('Dữ liệu kỳ này chưa chốt')).toBeVisible();
  await page.screenshot({ path: 'docs/ui-evidence/attendance-summary-after.png', fullPage: true });
});

test('đồng bộ bộ lọc, phân trang và sắp xếp vào URL/backend', async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await login(page);

  await page.getByPlaceholder('Tìm theo mã NV, tên nhân viên...').fill('SYN-001');
  await page.getByLabel('Ca làm việc').selectOption('CA1');
  await page
    .locator('label')
    .filter({ hasText: 'Trạng thái xử lý' })
    .locator('select')
    .selectOption('NEEDS_REVIEW');
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(page).toHaveURL(/search=SYN-001/);
  await expect(page).toHaveURL(/shiftCode=CA1/);
  await expect(page).toHaveURL(/processingStatus=NEEDS_REVIEW/);
  await page.getByLabel('Hiển thị').selectOption('20');
  await expect(page).toHaveURL(/pageSize=20/);
  await page.getByRole('button', { name: 'Sắp xếp theo Tổng công' }).click();
  await expect(page).toHaveURL(/sortBy=workedSeconds/);
  expect(requests.some((url) => url.includes('processingStatus=NEEDS_REVIEW'))).toBe(true);
});

test('export dùng toàn bộ bộ lọc, không gửi page/pageSize', async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await login(page);
  await page.getByPlaceholder('Tìm theo mã NV, tên nhân viên...').fill('SYN');
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Xuất Excel/ }).click();
  const artifact = await download;
  expect(artifact.suggestedFilename()).toBe('bang-cong-tong-hop-2026-10.xlsx');
  const exportRequest = requests.find((url) => url.includes('/attendance/export')) ?? '';
  expect(exportRequest).toContain('search=SYN');
  expect(exportRequest).not.toContain('page=');
  expect(exportRequest).not.toContain('pageSize=');
});

test('điều hướng chi tiết chỉ truyền employeeId và periodId', async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await login(page);
  await page.getByRole('link', { name: 'Xem chi tiết Nhân viên synthetic 01' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/attendance/detail\\?employeeId=${employeeId}.*periodId=${periodId}`),
  );
  await expect(page.getByRole('heading', { name: 'Chi tiết bảng công' })).toBeVisible();
  expect(
    requests.some((url) => url.includes(`/attendance/employee/${employeeId}?periodId=${periodId}`)),
  ).toBe(true);
});

test('viewport mobile giữ bảng ở vùng cuộn ngang', async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const table = page.locator('table');
  await expect(table).toBeVisible();
  const overflowed = await table.evaluate((element) => {
    const parent = element.parentElement;
    return Boolean(parent && element.scrollWidth > parent.clientWidth);
  });
  expect(overflowed).toBe(true);
});
