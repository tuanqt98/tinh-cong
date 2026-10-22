import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { ExcelParserService } from '../src/imports/excel-parser.service.js';

const mapping = {
  employeeCode: 'Mã NV',
  employeeName: 'Họ tên',
  departmentName: 'Phòng ban',
  attendanceDate: 'Ngày',
  checkIn: 'Vào',
  checkOut: 'Ra',
  shiftName: 'Ca',
};

async function workbookBuffer(withFormula = false) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('SX');
  sheet.addRow(Object.values(mapping));
  sheet.addRow(['SYN-001', 'Nhân viên mẫu', 'Sản xuất', '2026-10-01', '08:00', '17:00', 'CA1']);
  if (withFormula) {
    sheet.getCell('A2').value = { formula: '1+1', result: 2 };
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('ExcelParserService', () => {
  const parser = new ExcelParserService();

  it('dò header dòng 3 và alias đúng định dạng file Xuất lưới thực tế', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Xuất lưới');
    sheet.addRow(['CHI TIẾT CHẤM CÔNG']);
    sheet.addRow(['Từ ngày 01/09/2026 đến ngày 30/09/2026']);
    sheet.addRow([
      'Mã N.Viên', 'Tên N.Viên', 'Phòng ban', 'Chức vụ', 'Ngày', 'Thứ',
      'Vào', 'Ra', 'Công', 'Giờ', 'Công+', 'Giờ+', 'Vào trễ', 'Ra sớm',
      'TC1', 'TC2', 'TC3', 'Tên ca', 'K.hiệu', 'K.hiệu +', 'Tổng giờ',
    ]);
    sheet.addRow([
      'SYN-001', 'Nhân viên mẫu', 'Sản xuất', '', '2026-09-01', '',
      '08:00', '17:00', '', '', '', '', '', '', '', '', '', 'CA1', '', '', '',
    ]);

    const result = await parser.parse(Buffer.from(await workbook.xlsx.writeBuffer()), mapping);

    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      rowNo: 4,
      employeeCode: 'SYN-001',
      employeeName: 'Nhân viên mẫu',
      attendanceDate: '2026-09-01',
      checkIn: '08:00',
      checkOut: '17:00',
      shiftName: 'CA1',
    });
  });

  it('đọc đúng bảy trường từ fixture synthetic', async () => {
    const result = await parser.parse(await workbookBuffer(), mapping);
    expect(result.sheets).toEqual(['SX']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      employeeCode: 'SYN-001',
      employeeName: 'Nhân viên mẫu',
      departmentName: 'Sản xuất',
      shiftName: 'CA1',
    });
    expect(result.issues).toEqual([]);
  });

  it('từ chối công thức trong trường nguồn', async () => {
    const result = await parser.parse(await workbookBuffer(true), mapping);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FORMULA_NOT_ALLOWED_IN_SOURCE_FIELD', blocking: true }),
      ]),
    );
  });

  it('phát hiện mapping thiếu cột', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('SX').addRow(['Mã NV']);
    const result = await parser.parse(Buffer.from(await workbook.xlsx.writeBuffer()), mapping);
    expect(result.issues.filter((issue) => issue.code === 'MISSING_MAPPED_COLUMN')).toHaveLength(6);
  });

  it('nhận diện hàng tiêu đề linh hoạt và alias cột giống cấu trúc SX.xlsx', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Xuất lưới');
    sheet.addRow(['CHI TIẾT CHẤM CÔNG']);
    sheet.addRow(['Từ ngày 01/09/2026 đến ngày 30/09/2026']);
    sheet.addRow(['Mã N.Viên', 'Tên N.Viên', 'Phòng ban', 'Chức vụ', 'Ngày', 'Thứ', 'Vào', 'Ra', 'Công', 'Tên ca']);
    sheet.addRow(['NV0005', 'Nguyễn Văn Đông', 'AKO', 'Nhân viên', new Date('2026-09-01T00:00:00.000Z'), 'T.3', '05:01', '', 0, 'Ca1']);

    const defaultMapping = {
      employeeCode: 'Mã NV',
      employeeName: 'Họ tên',
      departmentName: 'Phòng ban',
      attendanceDate: 'Ngày chấm công',
      checkIn: 'Giờ vào',
      checkOut: 'Giờ ra',
      shiftName: 'Tên ca',
    };

    const result = await parser.parse(Buffer.from(await workbook.xlsx.writeBuffer()), defaultMapping);
    expect(result.sheets).toEqual(['Xuất lưới']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      employeeCode: 'NV0005',
      employeeName: 'Nguyễn Văn Đông',
      departmentName: 'AKO',
      attendanceDate: '2026-09-01',
      checkIn: '05:01',
      shiftName: 'Ca1',
    });
    expect(result.issues.some((issue) => issue.blocking)).toBe(false);
  });
});
