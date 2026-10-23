-- Employee management is additive: existing attendance/import records are untouched.
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'RESIGNED');

ALTER TABLE "employees"
  ADD COLUMN "currentShiftId" UUID,
  ADD COLUMN "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "birthDate" DATE,
  ADD COLUMN "gender" VARCHAR(20),
  ADD COLUMN "phone" VARCHAR(30),
  ADD COLUMN "email" VARCHAR(255),
  ADD COLUMN "position" VARCHAR(255),
  ADD COLUMN "startDate" DATE,
  ADD COLUMN "endDate" DATE;

UPDATE "employees" SET "status" = 'RESIGNED' WHERE "active" = false;

CREATE TABLE "employee_history" (
  "id" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "actorId" UUID,
  "action" VARCHAR(100) NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "reason" VARCHAR(1000),
  "effectiveFrom" DATE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employees_departmentId_status_idx" ON "employees"("departmentId", "status");
CREATE INDEX "employees_currentShiftId_status_idx" ON "employees"("currentShiftId", "status");
CREATE INDEX "employee_history_employeeId_createdAt_idx" ON "employee_history"("employeeId", "createdAt");
CREATE INDEX "employee_history_actorId_createdAt_idx" ON "employee_history"("actorId", "createdAt");

ALTER TABLE "employees" ADD CONSTRAINT "employees_currentShiftId_fkey"
  FOREIGN KEY ("currentShiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_history" ADD CONSTRAINT "employee_history_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_history" ADD CONSTRAINT "employee_history_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
