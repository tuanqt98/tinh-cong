import { expect, Page, test } from '@playwright/test';

const department = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'SYN-FACTORY',
  name: 'Sản xuất',
  active: true,
};
type SyntheticEmployee = {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';
  active: boolean;
  departmentId: string;
  department: typeof department;
};

function fixture(index: number): SyntheticEmployee {
  const statuses = ['ACTIVE', 'ACTIVE', 'ON_LEAVE', 'RESIGNED'] as const;
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    code: `NH${String(index).padStart(4, '0')}`,
    name: `Nhân viên kiểm thử ${index}`,
    status: statuses[(index - 1) % statuses.length]!,
    active: statuses[(index - 1) % statuses.length] === 'ACTIVE',
    departmentId: department.id,
    department,
  };
}

async function installEmployeeApi(page: Page) {
  const employees = Array.from({ length: 12 }, (_, index) => fixture(index + 1));
  const departments = [department];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const json = (body: unknown, status = 200, headers?: Record<string, string>) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
        headers,
      });

    if (path === '/auth/login' && request.method() === 'POST') {
      return json({
        accessToken: 'employee-e2e-token',
        refreshToken: 'employee-e2e-refresh',
        user: { id: 'admin-e2e', username: 'admin.synthetic', employeeId: null, roles: ['ADMIN'] },
      });
    }
    if (path === '/departments' && request.method() === 'POST') {
      const body = request.postDataJSON() as { code: string; name: string };
      const created = {
        id: `11111111-1111-4111-8111-${String(departments.length + 1).padStart(12, '0')}`,
        code: body.code,
        name: body.name,
        active: true,
      };
      departments.push(created);
      return json(created, 201);
    }
    if (path === '/departments' && request.method() === 'GET') return json(departments);
    if (path === '/employees/template' && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Buffer.from('synthetic employee template'),
      });
    }
    if (path === '/employees/import/preview' && request.method() === 'POST') {
      return json({
        fileName: 'nhan-vien.xlsx',
        rowCount: 1,
        rows: [
          {
            code: 'NH0200',
            name: 'Nhân viên import',
            departmentId: department.id,
            status: 'ACTIVE',
          },
        ],
        errors: [],
        canConfirm: true,
      });
    }
    if (path === '/employees/import/confirm' && request.method() === 'POST') {
      const [row] = (request.postDataJSON() as { rows: SyntheticEmployee[] }).rows;
      employees.unshift({
        ...fixture(200),
        ...row,
        id: fixture(200).id,
        active: row?.status === 'ACTIVE',
        department,
      });
      return json({ batchId: 'synthetic-batch', imported: 1 }, 201);
    }
    if (path === '/employees/statistics') {
      return json({
        total: employees.length,
        ACTIVE: employees.filter((item) => item.status === 'ACTIVE').length,
        ON_LEAVE: employees.filter((item) => item.status === 'ON_LEAVE').length,
        RESIGNED: employees.filter((item) => item.status === 'RESIGNED').length,
      });
    }
    const historyMatch = path.match(/^\/employees\/([^/]+)\/history$/);
    if (historyMatch) {
      return json([
        {
          id: 'history-1',
          action: 'EMPLOYEE_CREATED',
          before: null,
          after: { status: 'ACTIVE' },
          reason: null,
          effectiveFrom: '2026-10-01',
          createdAt: '2026-10-01T01:00:00.000Z',
          actor: { id: 'admin-e2e', username: 'admin.synthetic' },
        },
      ]);
    }
    const employeeMatch = path.match(/^\/employees\/([^/]+)$/);
    if (employeeMatch && request.method() === 'PATCH') {
      const target = employees.find((item) => item.id === employeeMatch[1])!;
      Object.assign(target, request.postDataJSON());
      return json(target);
    }
    if (employeeMatch && request.method() === 'DELETE') {
      const target = employees.find((item) => item.id === employeeMatch[1])!;
      target.status = 'RESIGNED';
      target.active = false;
      return json({ ...target, preservedAttendance: true, attendanceRecords: 2 });
    }
    if (path === '/employees' && request.method() === 'POST') {
      const body = request.postDataJSON() as Partial<SyntheticEmployee>;
      if (employees.some((item) => item.code === body.code))
        return json({ message: 'Mã nhân viên đã tồn tại.' }, 409);
      const created = {
        ...fixture(100),
        ...body,
        id: fixture(100).id,
        department,
      } as SyntheticEmployee;
      employees.unshift(created);
      return json(created, 201);
    }
    if (path === '/employees' && request.method() === 'GET') {
      const search = (url.searchParams.get('search') ?? '').toLocaleLowerCase('vi-VN');
      const status = url.searchParams.get('status');
      const departmentId = url.searchParams.get('departmentId');
      const pageNumber = Number(url.searchParams.get('page') ?? 1);
      const pageSize = Number(url.searchParams.get('pageSize') ?? 10);
      const filtered = employees.filter(
        (item) =>
          (!search ||
            item.code.toLocaleLowerCase('vi-VN').includes(search) ||
            item.name.toLocaleLowerCase('vi-VN').includes(search)) &&
          (!status || item.status === status) &&
          (!departmentId || item.departmentId === departmentId),
      );
      return json({
        items: filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
        total: filtered.length,
        page: pageNumber,
        pageSize,
      });
    }
    return json({});
  });
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập').fill('admin.synthetic');
  await page.locator('input[name="password"]').fill('Synthetic!12345');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.goto('/employees');
  await expect(page.getByRole('heading', { name: 'Quản lý nhân viên' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installEmployeeApi(page);
});

test('danh sách, tìm kiếm, lọc, phân trang và chi tiết dùng API server-side', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await login(page);
  await expect(page.getByText('Nhân viên kiểm thử 1', { exact: true })).toBeVisible();
  await expect(page.getByText('12', { exact: true }).first()).toBeVisible();
  await expect(page.locator('thead th')).toHaveText([
    'Mã nhân viên ↑',
    'Tên nhân viên',
    'Phòng ban',
    'Trạng thái',
    'Thao tác',
  ]);
  await page.getByText('Nhân viên kiểm thử 5', { exact: true }).click();
  await expect(page.getByText('Mã NV: NH0005')).toBeVisible();
  await page.screenshot({
    path: 'docs/ui-evidence/employee-management-after.png',
    fullPage: false,
  });
  await page.getByRole('button', { name: 'Đóng thông tin nhân viên' }).click();

  const searchRequest = page.waitForRequest(
    (request) => request.url().includes('/employees?') && request.url().includes('search=NH0002'),
  );
  await page.getByPlaceholder('Tìm mã NV, tên nhân viên…').fill('NH0002');
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await searchRequest;
  await expect(page.getByText('Nhân viên kiểm thử 2', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Xóa lọc' }).click();
  await page.getByLabel('Trạng thái').selectOption('ON_LEAVE');
  await expect(page.getByText('Tạm nghỉ').last()).toBeVisible();
  await page.getByLabel('Trạng thái').selectOption('');
  await page.getByLabel('Phòng ban').selectOption(department.id);
  await expect(page.getByText('Nhân viên kiểm thử 1', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Trang sau' }).click();
  await expect(page.getByText('Nhân viên kiểm thử 11', { exact: true })).toBeVisible();
  await page.getByText('Nhân viên kiểm thử 11', { exact: true }).click();
  await expect(page.getByText('Mã NV: NH0011')).toBeVisible();
  await page.getByRole('button', { name: 'Lịch sử' }).click();
  await expect(page.getByText('Tạo hồ sơ')).toBeVisible();
});

test('thêm, validation, chỉnh sửa và ngừng hoạt động giữ dữ liệu công', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Vui lòng nhập đủ mã')).toBeVisible();
  await page.getByLabel('Mã nhân viên *').fill('NH0100');
  await page.getByLabel('Tên nhân viên *').fill('Nhân viên mới');
  await page.getByLabel('Phòng ban *').selectOption(department.id);
  await expect(page.getByLabel('Trạng thái *')).toBeVisible();
  await expect(page.getByLabel('Ca làm việc')).toHaveCount(0);
  await expect(page.getByLabel('Ngày vào làm')).toHaveCount(0);
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status')).toContainText('Đã thêm nhân viên mới');

  await page.getByRole('button', { name: 'Chỉnh sửa Nhân viên mới' }).click();
  await page.getByLabel('Tên nhân viên *').fill('Nhân viên đã sửa');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu thay đổi');

  await page.getByRole('button', { name: 'Đóng thông tin nhân viên' }).click();
  await page.getByRole('button', { name: 'Ngừng hoạt động Nhân viên đã sửa' }).click();
  await expect(
    page.getByText('Hồ sơ và toàn bộ dữ liệu chấm công cũ vẫn được giữ nguyên.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận ngừng' }).click();
  await expect(page.getByRole('status')).toContainText('2 bản ghi chấm công được giữ nguyên');
});

test('giữ import, file mẫu map bốn trường và responsive mobile', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Quản lý phòng ban' }).click();
  const departmentDialog = page.getByRole('dialog', { name: 'Quản lý phòng ban' });
  await expect(departmentDialog.getByText('Danh mục hiện có (1)')).toBeVisible();
  await page.getByLabel('Mã phòng ban *').fill('AKO');
  await page.getByLabel('Tên phòng ban *').fill('AKO');
  await departmentDialog.getByRole('button', { name: 'Thêm' }).click();
  await expect(page.getByRole('status')).toContainText('Đã tạo phòng ban AKO');
  await expect(departmentDialog.getByText('Danh mục hiện có (2)')).toBeVisible();
  await expect(departmentDialog.getByText('AKO', { exact: true }).first()).toBeVisible();
  await departmentDialog.getByRole('button', { name: 'Đóng', exact: true }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải file mẫu' }).click();
  await expect((await downloadPromise).suggestedFilename()).toBe('mau-danh-sach-nhan-vien.xlsx');

  await page.getByRole('button', { name: 'Import danh sách' }).click();
  await expect(page.getByRole('dialog', { name: 'Import danh sách nhân viên' })).toContainText(
    'Mã nhân viên, Tên nhân viên, Phòng ban, Trạng thái',
  );
  await page.getByLabel('File Excel nhân viên').setInputFiles({
    name: 'nhan-vien.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('synthetic employee workbook'),
  });
  await page.getByRole('button', { name: 'Kiểm tra file' }).click();
  await expect(page.getByText('Đã đọc 1 dòng nhân viên')).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận import' }).click();
  await expect(page.getByRole('status')).toContainText('Đã import 1 nhân viên');
  await expect(page.locator('thead th')).toHaveText([
    'Mã nhân viên ↑',
    'Tên nhân viên',
    'Phòng ban',
    'Trạng thái',
    'Thao tác',
  ]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Quản lý nhân viên' })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
  await expect(page.getByRole('heading', { name: 'Thông tin nhân viên' })).toBeVisible();
});
