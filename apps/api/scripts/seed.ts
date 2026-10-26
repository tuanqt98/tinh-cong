import { hash } from 'bcryptjs';
import { PrismaClient, RoleCode } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

function required(name: string, minimum = 1) {
  const value = process.env[name];
  if (!value || value.length < minimum || value.startsWith('replace-')) {
    throw new Error(`${name} chưa được cấu hình an toàn.`);
  }
  return value;
}

async function upsertUser(
  username: string,
  password: string,
  roleCode: RoleCode,
  employeeId?: string,
) {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
  const user = await prisma.user.upsert({
    where: { username },
    update: {
      passwordHash: await hash(password, 12),
      active: true,
      ...(employeeId ? { employeeId } : {}),
    },
    create: {
      username,
      passwordHash: await hash(password, 12),
      ...(employeeId ? { employeeId } : {}),
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
  return user;
}

async function main() {
  const credentials = {
    admin: {
      username: required('SEED_ADMIN_USERNAME'),
      password: required('SEED_ADMIN_PASSWORD', 14),
    },
    hr: { username: required('SEED_HR_USERNAME'), password: required('SEED_HR_PASSWORD', 14) },
    employee: {
      username: required('SEED_EMPLOYEE_USERNAME'),
      password: required('SEED_EMPLOYEE_PASSWORD', 14),
    },
  };
  for (const code of Object.values(RoleCode)) {
    await prisma.role.upsert({ where: { code }, update: {}, create: { code } });
  }
  const department = await prisma.department.upsert({
    where: { code: 'SYN-FACTORY' },
    update: { name: 'Phòng sản xuất mẫu', active: true },
    create: { code: 'SYN-FACTORY', name: 'Phòng sản xuất mẫu' },
  });
  const employee = await prisma.employee.upsert({
    where: { code: 'SYN-001' },
    update: { name: 'Nhân viên synthetic 001', departmentId: department.id, active: true },
    create: { code: 'SYN-001', name: 'Nhân viên synthetic 001', departmentId: department.id },
  });
  const admin = await upsertUser(
    credentials.admin.username,
    credentials.admin.password,
    RoleCode.ADMIN,
  );
  const hr = await upsertUser(credentials.hr.username, credentials.hr.password, RoleCode.HR);
  await upsertUser(
    credentials.employee.username,
    credentials.employee.password,
    RoleCode.EMPLOYEE,
    employee.id,
  );
  await prisma.managerScope.deleteMany({ where: { userId: hr.id, departmentId: department.id } });
  await prisma.managerScope.create({ data: { userId: hr.id, departmentId: department.id } });

  const ca1 = await prisma.shift.upsert({
    where: { code: 'CA1' },
    update: { name: 'Ca 1', active: true },
    create: { code: 'CA1', name: 'Ca 1' },
  });
  const ca3 = await prisma.shift.upsert({
    where: { code: 'CA3' },
    update: { name: 'Ca 3', active: true },
    create: { code: 'CA3', name: 'Ca 3' },
  });
  await prisma.shiftRule.upsert({
    where: { shiftId_version: { shiftId: ca1.id, version: 1 } },
    update: {},
    create: {
      shiftId: ca1.id,
      version: 1,
      effectiveFrom: new Date('2026-10-09T00:00:00Z'),
      scheduledStartSeconds: 28_800,
      scheduledCompletionSeconds: 61_200,
      breakStartSeconds: 43_200,
      breakEndSeconds: 46_800,
      tiers: { tier100: 28_800, tier150After: 28_800 },
    },
  });
  await prisma.shiftRule.upsert({
    where: { shiftId_version: { shiftId: ca1.id, version: 2 } },
    update: {},
    create: {
      shiftId: ca1.id,
      version: 2,
      effectiveFrom: new Date('2026-09-01T00:00:00Z'),
      scheduledStartSeconds: 25_200,
      scheduledCompletionSeconds: 68_400,
      breakStartSeconds: 43_200,
      breakEndSeconds: 46_800,
      tiers: {
        tier100: 28_800,
        tier150After: 28_800,
        targetWorkedSeconds: 39_600,
        countEarlyArrivalSeconds: false,
        postCompletionBlockSeconds: 1_800,
      },
    },
  });
  await prisma.shiftRule.upsert({
    where: { shiftId_version: { shiftId: ca1.id, version: 3 } },
    update: {},
    create: {
      shiftId: ca1.id,
      version: 3,
      effectiveFrom: new Date('2026-09-01T00:00:00Z'),
      scheduledStartSeconds: 25_200,
      scheduledCompletionSeconds: 68_400,
      breakStartSeconds: 43_200,
      breakEndSeconds: 46_800,
      tiers: {
        tier100: 28_800,
        tier150After: 28_800,
        targetWorkedSeconds: 39_600,
        countEarlyArrivalSeconds: false,
        postCompletionBlockSeconds: 1_800,
        sundayTierPercentage: 200,
      },
    },
  });
  await prisma.shiftRule.upsert({
    where: { shiftId_version: { shiftId: ca1.id, version: 4 } },
    update: {},
    create: {
      shiftId: ca1.id,
      version: 4,
      effectiveFrom: new Date('2026-09-01T00:00:00Z'),
      scheduledStartSeconds: 25_200,
      scheduledCompletionSeconds: 68_400,
      breakStartSeconds: 43_200,
      breakEndSeconds: 46_800,
      tiers: {
        tier100: 28_800,
        tier150After: 28_800,
        targetWorkedSeconds: 39_600,
        countEarlyArrivalSeconds: false,
        checkOutBlockSeconds: 1_800,
        postCompletionBlockSeconds: 1_800,
        sundayTierPercentage: 200,
      },
    },
  });
  await prisma.shiftRule.upsert({
    where: { shiftId_version: { shiftId: ca3.id, version: 1 } },
    update: {},
    create: {
      shiftId: ca3.id,
      version: 1,
      effectiveFrom: new Date('2026-10-09T00:00:00Z'),
      scheduledStartSeconds: 79_200,
      scheduledCompletionSeconds: 111_600,
      breakStartSeconds: 86_400,
      breakEndSeconds: 90_000,
      tiers: { tier100: 14_400, tier130: 14_400, tier210After: 28_800 },
    },
  });
  await prisma.shiftRule.upsert({
    where: { shiftId_version: { shiftId: ca3.id, version: 2 } },
    update: {},
    create: {
      shiftId: ca3.id,
      version: 2,
      effectiveFrom: new Date('2026-09-01T00:00:00Z'),
      scheduledStartSeconds: 68_400,
      scheduledCompletionSeconds: 111_600,
      breakStartSeconds: 86_400,
      breakEndSeconds: 90_000,
      tiers: {
        tier100: 14_400,
        tier130: 14_400,
        tier210After: 28_800,
        targetWorkedSeconds: 39_600,
        countEarlyArrivalSeconds: false,
        postCompletionBlockSeconds: 1_800,
      },
    },
  });
  await prisma.shiftRule.upsert({
    where: { shiftId_version: { shiftId: ca3.id, version: 3 } },
    update: {},
    create: {
      shiftId: ca3.id,
      version: 3,
      effectiveFrom: new Date('2026-09-01T00:00:00Z'),
      scheduledStartSeconds: 68_400,
      scheduledCompletionSeconds: 111_600,
      breakStartSeconds: 86_400,
      breakEndSeconds: 90_000,
      tiers: {
        tier100: 14_400,
        tier130: 14_400,
        tier210After: 28_800,
        targetWorkedSeconds: 39_600,
        countEarlyArrivalSeconds: false,
        postCompletionBlockSeconds: 1_800,
        sundayTierPercentage: 230,
      },
    },
  });
  await prisma.shiftRule.upsert({
    where: { shiftId_version: { shiftId: ca1.id, version: 5 } },
    update: {},
    create: {
      shiftId: ca1.id,
      version: 5,
      effectiveFrom: new Date('2026-09-01T00:00:00Z'),
      scheduledStartSeconds: 25_200,
      scheduledCompletionSeconds: 68_400,
      breakStartSeconds: 43_200,
      breakEndSeconds: 46_800,
      tiers: {
        tier100: 28_800,
        tier150After: 28_800,
        targetWorkedSeconds: 39_600,
        countEarlyArrivalSeconds: false,
        checkOutBlockSeconds: 1_800,
        postCompletionBlockSeconds: 1_800,
        sundayTierPercentage: 200,
        lateAfterSeconds: 28_860,
      },
    },
  });
  await prisma.shiftRule.upsert({
    where: { shiftId_version: { shiftId: ca3.id, version: 4 } },
    update: {},
    create: {
      shiftId: ca3.id,
      version: 4,
      effectiveFrom: new Date('2026-09-01T00:00:00Z'),
      scheduledStartSeconds: 68_400,
      scheduledCompletionSeconds: 111_600,
      breakStartSeconds: 86_400,
      breakEndSeconds: 90_000,
      tiers: {
        tier100: 14_400,
        tier130: 14_400,
        tier210After: 28_800,
        targetWorkedSeconds: 39_600,
        countEarlyArrivalSeconds: false,
        postCompletionBlockSeconds: 1_800,
        sundayTierPercentage: 230,
        lateAfterSeconds: 79_260,
      },
    },
  });
  await prisma.attendancePeriod.upsert({
    where: { year_month: { year: 2026, month: 10 } },
    update: {},
    create: { year: 2026, month: 10 },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'SYNTHETIC_SEED',
      entity: 'System',
      reason: 'Development-only synthetic dataset',
    },
  });
  console.log(
    'Synthetic seed completed for users:',
    credentials.admin.username,
    credentials.hr.username,
    credentials.employee.username,
  );
}

main().finally(async () => prisma.$disconnect());
