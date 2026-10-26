import { expect, test } from '@playwright/test';

const rawId = '00000000-0000-0000-0000-000000000701';
const periodId = '00000000-0000-0000-0000-000000000901';
const departmentId = '00000000-0000-0000-0000-000000000801';

const exceptionCodes = [
  {
    id: '00000000-0000-0000-0000-000000000711',
    code: 'MISSING_CHECKIN',
    description: 'Thiếu giờ vào',
    blocking: true,
    severity: 'BLOCKING',
    status: 'OPEN',
    details: { message: 'Thiếu giờ vào' },
    createdAt: '2026-10-03T01:00:00.000Z',
    updatedAt: '2026-10-03T01:00:00.000Z',
    resolutions: [],
  },
  {
    id: '00000000-0000-0000-0000-000000000712',
    code: 'MULTIPLE_ROWS_SAME_EMPLOYEE_DATE',
    description: 'Không tự cộng nhiều dòng cùng nhân viên/ngày.',
    blocking: true,
    severity: 'BLOCKING',
    status: 'OPEN',
    details: { reason: 'Không tự cộng nhiều dòng cùng nhân viên/ngày.' },
    createdAt: '2026-10-03T01:00:00.000Z',
    updatedAt: '2026-10-03T01:00:00.000Z',
    resolutions: [],
  },
  {
    id: '00000000-0000-0000-0000-000000000713',
    code: 'EXCESSIVE_DURATION',
    description: 'Hiện diện vượt ngưỡng 16 giờ.',
    blocking: true,
    severity: 'BLOCKING',
    status: 'OPEN',
    details: { message: 'Hiện diện vượt ngưỡng 16 giờ.' },
    createdAt: '2026-10-03T01:00:00.000Z',
    updatedAt: '2026-10-03T01:00:00.000Z',
    resolutions: [],
  },
] as const;

const row = {
  id: rawId,
  employeeId: '00000000-0000-0000-0000-000000000601',
  employeeCode: 'NH0678',
  employeeName: 'Đỗ Thị Hương',
  departmentId,
  departmentName: 'Sản xuất',
  attendanceDate: '2026-10-03',
  shiftDate: '2026-10-03',
  shiftCode: 'CA1',
  checkIn: '06:37',
  checkOut: '18:11',
  normalizedCheckInAt: '2026-10-03T06:37:00+07:00',
  normalizedCheckOutAt: '2026-10-03T18:11:00+07:00',
  normalizationRevision: 1,
  calculationRevision: 1,
  calculationStatus: 'NEEDS_REVIEW',
  workedSeconds: null,
  lateCount: null,
  earlyCount: null,
  period: { id: periodId, year: 2026, month: 10, status: 'DRAFT', version: 1 },
  severity: 'BLOCKING',
  status: 'OPEN',
  exceptions: exceptionCodes,
};

const detail = {
  id: rawId,
  status: 'OPEN',
  severity: 'BLOCKING',
  workflowEnabled: false,
  employee: {
    id: row.employeeId,
    code: row.employeeCode,
    name: row.employeeName,
    position: 'Công nhân in',
    department: { id: departmentId, code: 'SX', name: 'Sản xuất' },
  },
  period: { ...row.period, lockedAt: null, publishedAt: null },
  raw: {
    importId: '00000000-0000-0000-0000-000000000501',
    fileName: 'synthetic-exceptions.xlsx',
    mappingVersion: 'v1',
    importedAt: '2026-10-03T00:00:00.000Z',
    sheet: 'Xuất lưới',
    rowNo: 17,
    attendanceDate: '2026-10-03',
    checkIn: '06:37',
    checkOut: '18:11',
    shiftName: 'CA1',
    cells: { 'Mã nhân viên': 'NH0678', 'Giờ vào': '06:37', 'Giờ ra': '18:11' },
  },
  normalization: {
    revision: 1,
    shiftDate: '2026-10-03T00:00:00.000Z',
    checkInAt: '2026-10-03T06:37:00+07:00',
    checkOutAt: '2026-10-03T18:11:00+07:00',
    shiftCode: 'CA1',
    shiftDateEvidence: { type: 'SOURCE_TIMESTAMP', reference: 'synthetic' },
    checkOutDateEvidence: { type: 'SOURCE_TIMESTAMP', reference: 'synthetic' },
    ruleVersion: 'source-shift-v1',
  },
  calculation: null,
  exceptions: exceptionCodes,
  adjustments: [],
  history: [],
  version: 1,
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/auth/login') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'exceptions-token',
          refreshToken: 'exceptions-refresh',
          user: { id: 'admin-e2e', username: 'Nguyễn Văn A', employeeId: null, roles: ['ADMIN'] },
        }),
      });
      return;
    }
    if (path === '/periods') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([row.period]),
      });
      return;
    }
    if (path === '/departments') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: departmentId, code: 'SX', name: 'Sản xuất' }]),
      });
      return;
    }
    if (path === '/exceptions/summary') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalRecords: 42,
          totalCodes: 57,
          blockingRecords: 12,
          warningRecords: 18,
          infoRecords: 8,
          resolvedRecords: 4,
          openRecords: 38,
          workflowEnabled: false,
        }),
      });
      return;
    }
    if (path === `/exceptions/${rawId}` && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detail),
      });
      return;
    }
    if (path === `/exceptions/${rawId}/preview` && request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          persisted: false,
          inputVersion: 1,
          before: null,
          preview: {
            status: 'VALID',
            calculation: {
              presenceSeconds: 39600,
              breakSeconds: 3600,
              workedSeconds: 36000,
              tier100Seconds: 28800,
              tier130Seconds: 0,
              tier150Seconds: 7200,
              tier200Seconds: 0,
              tier210Seconds: 0,
              tier230Seconds: 0,
              lateCount: 0,
              earlyCount: 1,
            },
            exceptions: [],
          },
          remainingBlockingCodes: [],
        }),
      });
      return;
    }
    if (path === '/exceptions/export') {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: 'synthetic-export',
      });
      return;
    }
    if (path === '/exceptions') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [row],
          total: 42,
          page: Number(url.searchParams.get('page') ?? 1),
          pageSize: Number(url.searchParams.get('pageSize') ?? 15),
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập').fill('e2e_admin');
  await page.locator('input[name="password"]').fill('Synthetic!123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
});

test('lọc, xem đủ nhiều mã lỗi, tính thử không ghi và lưu visual evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/exceptions?month=2026-10&status=OPEN');

  await expect(page.getByRole('heading', { name: 'Xử lý ngoại lệ' })).toBeVisible();
  await expect(page.getByText('42', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('+1')).toBeVisible();
  await expect(page.getByText('57 mã lỗi')).toBeVisible();

  await page.getByLabel('Mã lỗi').selectOption('MISSING_CHECKIN');
  await page.getByRole('button', { name: 'Lọc', exact: true }).click();
  await expect(page).toHaveURL(/code=MISSING_CHECKIN/);
  await page.getByRole('button', { name: 'Xem ngoại lệ NH0678' }).click();
  const drawer = page.getByRole('complementary', { name: 'Chi tiết ngoại lệ' });
  await expect(drawer).toBeVisible();
  await expect(page.getByText('Các lỗi phát hiện (3)')).toBeVisible();
  await expect(drawer.getByText('MISSING_CHECKIN', { exact: true })).toBeVisible();
  await expect(drawer.getByText('EXCESSIVE_DURATION', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Q10/Q11');
  await expect(page.getByRole('button', { name: 'Lưu xử lý' })).toBeDisabled();

  await page.getByRole('button', { name: 'Tính thử' }).click();
  await expect(page.getByText('Kết quả tính thử')).toBeVisible();
  await expect(drawer.getByText('10.00 giờ').last()).toBeVisible();
  await expect(drawer.getByText('Tính thử không ghi dữ liệu')).toBeVisible();
  await expect(page).toHaveURL(/code=MISSING_CHECKIN/);

  await page.screenshot({ path: 'docs/ui-evidence/attendance-exceptions-after.png' });
});

test('drawer ngoại lệ phủ toàn màn hình trên mobile và nút hành động không bị che', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/exceptions');
  await page.getByRole('button', { name: 'Xem ngoại lệ NH0678' }).click();
  const drawer = page.getByRole('complementary', { name: 'Chi tiết ngoại lệ' });
  await expect(drawer).toBeVisible();
  await expect.poll(async () => (await drawer.boundingBox())?.width).toBe(390);
  await expect(page.getByRole('button', { name: 'Tính thử' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đóng', exact: true })).toBeVisible();
});
