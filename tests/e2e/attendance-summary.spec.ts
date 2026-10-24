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
  tier200Seconds: 0,
  tier210Seconds: 0,
  tier230Seconds: 0,
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
    tier200Seconds: result.tier200Seconds + row.tier200Seconds,
    tier210Seconds: result.tier210Seconds + row.tier210Seconds,
    tier230Seconds: result.tier230Seconds + row.tier230Seconds,
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
    tier200Seconds: 0,
    tier210Seconds: 0,
    tier230Seconds: 0,
    lateSeconds: 0,
    earlySeconds: 0,
    attendanceDays: 0,
    exceptionCount: 0,
  },
);

const detailRows = Array.from({ length: 15 }, (_, index) => {
  const day = String(index + 1).padStart(2, '0');
  const nightShift = index % 4 === 2;
  return {
    id: `calculation-${index + 1}`,
    rawId: `raw-${index + 1}`,
    rowNo: index + 2,
    revision: 1,
    status: index === 10 ? 'NEEDS_REVIEW' : 'VALID',
    engineVersion: 'synthetic-v1',
    shiftDate: `2026-10-${day}T00:00:00.000Z`,
    shiftCode: nightShift ? 'CA3' : 'CA1',
    checkInAt: nightShift ? `2026-10-${day}T15:00:00.000Z` : `2026-10-${day}T01:00:00.000Z`,
    checkOutAt: nightShift
      ? `2026-10-${String(index + 2).padStart(2, '0')}T00:00:00.000Z`
      : `2026-10-${day}T10:00:00.000Z`,
    presenceSeconds: 32_400,
    breakSeconds: 3_600,
    workedSeconds: index === 10 ? null : 28_800,
    tier100Seconds: index === 10 ? null : nightShift ? 14_400 : 28_800,
    tier130Seconds: index === 10 ? null : nightShift ? 14_400 : 0,
    tier150Seconds: index === 10 ? null : 0,
    tier200Seconds: index === 10 ? null : 0,
    tier210Seconds: index === 10 ? null : 0,
    tier230Seconds: index === 10 ? null : 0,
    lateSeconds: index === 10 ? null : index % 5 === 0 ? 300 : 0,
    earlySeconds: index === 10 ? null : 0,
    exceptions:
      index === 10
        ? [{ id: 'exception-1', code: 'MULTIPLE_ROWS', blocking: true, status: 'OPEN' }]
        : [],
    source: {
      employeeCode: 'SYN-001',
      employeeName: 'Nhân viên synthetic 01',
      departmentName: 'Sản xuất',
      attendanceDate: `2026-10-${day}`,
      checkIn: nightShift ? '22:00' : '08:00',
      checkOut: nightShift ? '07:00' : '17:00',
      shiftName: nightShift ? 'Ca3' : 'Ca1',
    },
  };
});

const detailTotals = detailRows.reduce(
  (result, row) => {
    if (row.status !== 'VALID') {
      result.exceptionCount += row.exceptions.length;
      return result;
    }
    result.workedSeconds += row.workedSeconds ?? 0;
    result.tier100Seconds += row.tier100Seconds ?? 0;
    result.tier130Seconds += row.tier130Seconds ?? 0;
    result.tier150Seconds += row.tier150Seconds ?? 0;
    result.tier200Seconds += row.tier200Seconds ?? 0;
    result.tier210Seconds += row.tier210Seconds ?? 0;
    result.tier230Seconds += row.tier230Seconds ?? 0;
    result.lateSeconds += row.lateSeconds ?? 0;
    result.earlySeconds += row.earlySeconds ?? 0;
    result.attendanceDays += 1;
    return result;
  },
  {
    workedSeconds: 0,
    tier100Seconds: 0,
    tier130Seconds: 0,
    tier150Seconds: 0,
    tier200Seconds: 0,
    tier210Seconds: 0,
    tier230Seconds: 0,
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
        body: JSON.stringify({
          employee: {
            id: employeeId,
            code: 'SYN-001',
            name: 'Nhân viên synthetic 01',
            position: 'Công nhân',
            startDate: '2026-01-05T00:00:00.000Z',
            status: 'ACTIVE',
            departmentName: 'Sản xuất',
          },
          period: {
            id: periodId,
            year: 2026,
            month: 10,
            status: 'DRAFT',
            version: 1,
            timezone: 'Asia/Ho_Chi_Minh',
            lockedAt: null,
            publishedAt: null,
          },
          rows: detailRows,
          adjustments: [
            {
              id: 'adjustment-1',
              rawId: 'raw-1',
              rowNo: 2,
              revision: 2,
              before: { checkIn: '08:05' },
              after: { checkIn: '08:00' },
              reason: 'Điều chỉnh synthetic',
              createdAt: '2026-10-16T02:00:00.000Z',
              actor: { id: 'admin-1', username: 'admin.synthetic' },
            },
          ],
          totals: detailTotals,
          workingDays: null,
          workingDaysAvailable: false,
          calculationVersion: { engineVersions: ['synthetic-v1'], maxRevision: 1 },
        }),
      });
      return;
    }
    if (path === `/attendance/employee/${employeeId}/pdf`) {
      requests.push(url.toString());
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-synthetic' });
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
  await expect(page.locator('thead th')).toHaveCount(20);
  await expect(page.locator('thead th', { hasText: 'Giờ 200%' })).toBeVisible();
  await expect(page.locator('thead th', { hasText: 'Giờ 230%' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Nhân viên synthetic 01' })).toBeVisible();
  await expect(page.getByText('Số ngày làm việc').first()).toBeVisible();
  await expect(page.getByText('N/A').first()).toBeVisible();
  expect(
    requests.some((url) => url.includes(`/attendance/employee/${employeeId}?periodId=${periodId}`)),
  ).toBe(true);
});

test('render Màn 06, chuyển tab dữ liệu nguồn/lịch sử và lưu visual evidence', async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await login(page);
  await page.goto(`/attendance/detail?employeeId=${employeeId}&periodId=${periodId}`);

  await expect(page.getByRole('heading', { name: 'Chi tiết bảng công' })).toBeVisible();
  await expect(page.getByText('Tổng cộng')).toBeVisible();
  await expect(page.getByText('Cần kiểm tra')).toBeVisible();
  await page.getByRole('button', { name: /Dữ liệu nguồn/ }).click();
  await expect(page.locator('thead').getByText('Tên ca', { exact: true })).toBeVisible();
  await expect(page.getByText('Ca3').first()).toBeVisible();
  await page.getByRole('button', { name: /Lịch sử điều chỉnh/ }).click();
  await expect(page.getByText('Điều chỉnh synthetic')).toBeVisible();
  await page.getByRole('button', { name: /Bảng công chi tiết/ }).click();
  await page.screenshot({ path: 'docs/ui-evidence/attendance-detail-after.png', fullPage: true });
});

test('xuất PDF chi tiết dùng đúng nhân viên và kỳ công', async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await login(page);
  await page.goto(`/attendance/detail?employeeId=${employeeId}&periodId=${periodId}`);
  await expect(page.getByRole('heading', { name: 'Nhân viên synthetic 01' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất PDF' }).click();
  const artifact = await download;
  expect(artifact.suggestedFilename()).toBe('chi-tiet-bang-cong-SYN-001-2026-10.pdf');
  expect(
    requests.some((url) =>
      url.includes(`/attendance/employee/${employeeId}/pdf?periodId=${periodId}`),
    ),
  ).toBe(true);
});

test('Màn 06 mobile giữ bảng trong vùng cuộn ngang', async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto(`/attendance/detail?employeeId=${employeeId}&periodId=${periodId}`);

  const table = page.locator('table').first();
  await expect(table).toBeVisible();
  const overflowed = await table.evaluate((element) => {
    const parent = element.parentElement;
    return Boolean(parent && element.scrollWidth > parent.clientWidth);
  });
  expect(overflowed).toBe(true);
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
