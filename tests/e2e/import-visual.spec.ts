import { expect, test, type Page } from '@playwright/test';

const preview = {
  id: '00000000-0000-0000-0000-000000000099',
  status: 'PREVIEW',
  rowCount: 1245,
  sheets: ['Xuất lưới'],
  duplicateRuleConfigured: true,
  canConfirm: true,
  issues: [
    { sheet: 'Xuất lưới', rowNo: 7, code: 'EQUAL_TIMESTAMPS', blocking: false },
    { sheet: 'Xuất lưới', rowNo: 8, code: 'MISSING_CHECKOUT', blocking: false },
    { sheet: 'Xuất lưới', rowNo: 9, code: 'ABNORMAL_DURATION', blocking: false },
  ],
  previewRows: [
    {
      sheet: 'Xuất lưới',
      rowNo: 4,
      employeeCode: 'NH0234',
      employeeName: 'Trần Văn Minh',
      departmentName: 'Sản xuất',
      attendanceDate: '01/10/2026',
      checkIn: '08:02',
      checkOut: '17:12',
      shiftName: 'Ca1',
    },
    {
      sheet: 'Xuất lưới',
      rowNo: 5,
      employeeCode: 'NH0456',
      employeeName: 'Nguyễn Thị Hoa',
      departmentName: 'Kỹ thuật',
      attendanceDate: '01/10/2026',
      checkIn: '07:55',
      checkOut: '16:30',
      shiftName: 'Ca1',
    },
    {
      sheet: 'Xuất lưới',
      rowNo: 6,
      employeeCode: 'NH0789',
      employeeName: 'Lê Văn Hải',
      departmentName: 'Sản xuất',
      attendanceDate: '01/10/2026',
      checkIn: '22:15',
      checkOut: '06:50',
      shiftName: 'Ca3',
    },
    {
      sheet: 'Xuất lưới',
      rowNo: 7,
      employeeCode: 'NH0123',
      employeeName: 'Phạm Thị Lan',
      departmentName: 'Kho vận',
      attendanceDate: '01/10/2026',
      checkIn: '08:00',
      checkOut: '08:00',
      shiftName: 'Ca1',
    },
    {
      sheet: 'Xuất lưới',
      rowNo: 8,
      employeeCode: 'NH0345',
      employeeName: 'Hoàng Văn Tuấn',
      departmentName: 'Kinh doanh',
      attendanceDate: '01/10/2026',
      checkIn: '22:00',
      checkOut: null,
      shiftName: 'Ca3',
    },
    {
      sheet: 'Xuất lưới',
      rowNo: 9,
      employeeCode: 'NH0678',
      employeeName: 'Đỗ Thị Hương',
      departmentName: 'Sản xuất',
      attendanceDate: '01/10/2026',
      checkIn: '06:30',
      checkOut: '18:45',
      shiftName: 'Ca1',
    },
    {
      sheet: 'Xuất lưới',
      rowNo: 10,
      employeeCode: 'NH0901',
      employeeName: 'Vũ Văn Nam',
      departmentName: 'Hành chính',
      attendanceDate: '02/10/2026',
      checkIn: '08:05',
      checkOut: '17:01',
      shiftName: 'Ca1',
    },
    {
      sheet: 'Xuất lưới',
      rowNo: 11,
      employeeCode: 'NH0111',
      employeeName: 'Nguyễn Văn Cường',
      departmentName: 'Kỹ thuật',
      attendanceDate: '02/10/2026',
      checkIn: '22:10',
      checkOut: '07:20',
      shiftName: 'Ca3',
    },
  ],
};

async function openPopulatedImport(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 'visual-user',
        username: 'Nguyễn Văn A',
        employeeId: null,
        roles: ['HR'],
      }),
    );
    sessionStorage.setItem('access_token', 'visual-token');
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    if (path === '/imports/preview' && request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(preview),
      });
      return;
    }
    if (path === '/imports') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"items":[],"total":0,"page":1,"pageSize":20}',
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/imports');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'SX_Thang10_2026.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('synthetic visual fixture'),
  });
  await page.getByRole('button', { name: 'Kiểm tra lại' }).click();
  await expect(page.getByRole('heading', { name: /3\. Xem trước dữ liệu/ })).toBeVisible();
}

for (const viewport of [
  { width: 1536, height: 1024 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
]) {
  test(`visual Import Excel after redesign ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openPopulatedImport(page);
    await page.screenshot({
      path: `docs/ui-reference/import-excel-after-${viewport.width}x${viewport.height}.png`,
      fullPage: false,
    });
  });
}
