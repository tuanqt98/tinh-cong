import { performance } from 'node:perf_hooks';
import { calculateAttendance } from '@tinh-cong/attendance-engine';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();
const rollbackMarker = 'SYNTHETIC_PERFORMANCE_ROLLBACK';

async function main() {
  const started = performance.now();
  try {
    await prisma.$transaction(async (tx) => {
      const department = await tx.department.upsert({
        where: { code: 'SYN-PERF' },
        update: { name: 'Synthetic performance only' },
        create: { code: 'SYN-PERF', name: 'Synthetic performance only' },
      });
      await tx.employee.createMany({
        data: Array.from({ length: 1_000 }, (_, index) => ({
          code: `SYN-PERF-${String(index + 1).padStart(4, '0')}`,
          name: `Synthetic performance employee ${index + 1}`,
          departmentId: department.id,
        })),
      });

      const queryStarted = performance.now();
      const employees = await tx.employee.findMany({
        where: { departmentId: department.id },
        orderBy: { code: 'asc' },
        take: 1_000,
      });
      const queryMilliseconds = performance.now() - queryStarted;

      const engineStarted = performance.now();
      const calculations = employees.map((employee) => calculateAttendance({
        employeeCode: employee.code,
        shiftCode: 'CA1',
        shiftDate: '2026-10-20',
        checkInAt: '2026-10-20T08:00:00+07:00',
        checkOutAt: '2026-10-20T17:00:00+07:00',
        checkOutDateEvidence: { type: 'SOURCE_TIMESTAMP', reference: 'synthetic:performance' },
        shiftDateEvidence: { type: 'WORK_SCHEDULE', reference: 'synthetic:performance' },
      }));
      const engineMilliseconds = performance.now() - engineStarted;

      if (calculations.some((result) => result.status !== 'VALID' || result.calculation?.workedSeconds !== 28_800)) {
        throw new Error('Synthetic performance calculation produced an invalid result.');
      }

      process.stdout.write(`${JSON.stringify({
        label: 'SYNTHETIC_DATA_ONLY',
        employees: employees.length,
        queryMilliseconds: Math.round(queryMilliseconds * 100) / 100,
        engineMilliseconds: Math.round(engineMilliseconds * 100) / 100,
        totalMilliseconds: Math.round((performance.now() - started) * 100) / 100,
      })}\n`);
      throw new Error(rollbackMarker);
    }, { timeout: 30_000 });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMarker) throw error;
  }
}

main().finally(async () => prisma.$disconnect());
