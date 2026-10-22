-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'LOCKED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CalculationStatus" AS ENUM ('VALID', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "departmentId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "employeeId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "refreshTokenHash" VARCHAR(128),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "manager_scopes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "departmentId" UUID,
    "employeeId" UUID,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMPTZ(3),

    CONSTRAINT "manager_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_rules" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "scheduledStartSeconds" INTEGER NOT NULL,
    "scheduledCompletionSeconds" INTEGER NOT NULL,
    "breakStartSeconds" INTEGER NOT NULL,
    "breakEndSeconds" INTEGER NOT NULL,
    "abnormalDurationThresholdSeconds" INTEGER NOT NULL DEFAULT 57600,
    "tiers" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "shiftDate" DATE NOT NULL,
    "sourceType" VARCHAR(50) NOT NULL,
    "sourceRef" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_periods" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "lockedAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_imports" (
    "id" UUID NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "storageKey" VARCHAR(500),
    "sha256" CHAR(64) NOT NULL,
    "mappingVersion" VARCHAR(100) NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PREVIEW',
    "attemptedById" UUID NOT NULL,
    "attemptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMPTZ(3),
    "rejectionReason" VARCHAR(1000),
    "metadata" JSONB,

    CONSTRAINT "attendance_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_import_issues" (
    "id" UUID NOT NULL,
    "importId" UUID NOT NULL,
    "sheet" VARCHAR(255) NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "issueCode" VARCHAR(100) NOT NULL,
    "matchScope" VARCHAR(50),
    "evidence" JSONB,

    CONSTRAINT "attendance_import_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_raw" (
    "id" UUID NOT NULL,
    "importId" UUID NOT NULL,
    "employeeId" UUID,
    "sheet" VARCHAR(255) NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "employeeCode" VARCHAR(50) NOT NULL,
    "employeeName" VARCHAR(255) NOT NULL,
    "departmentName" VARCHAR(255) NOT NULL,
    "attendanceDateRaw" VARCHAR(255),
    "checkInRaw" VARCHAR(255),
    "checkOutRaw" VARCHAR(255),
    "shiftNameRaw" VARCHAR(255),
    "rawCells" JSONB NOT NULL,
    "sourceIdentityHash" CHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_raw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_normalizations" (
    "id" UUID NOT NULL,
    "rawId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "shiftDate" DATE,
    "checkInAt" TIMESTAMPTZ(3),
    "checkOutAt" TIMESTAMPTZ(3),
    "shiftCode" VARCHAR(50),
    "shiftDateEvidence" JSONB,
    "checkOutDateEvidence" JSONB,
    "ruleVersion" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_normalizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_adjustments" (
    "id" UUID NOT NULL,
    "rawId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_calculations" (
    "id" UUID NOT NULL,
    "rawId" UUID NOT NULL,
    "normalizationId" UUID NOT NULL,
    "adjustmentId" UUID,
    "periodId" UUID NOT NULL,
    "shiftRuleId" UUID NOT NULL,
    "engineVersion" VARCHAR(100) NOT NULL,
    "revision" INTEGER NOT NULL,
    "inputHash" CHAR(64) NOT NULL,
    "status" "CalculationStatus" NOT NULL,
    "presenceSeconds" INTEGER,
    "breakSeconds" INTEGER,
    "workedSeconds" INTEGER,
    "lateSeconds" INTEGER,
    "earlySeconds" INTEGER,
    "tier100Seconds" INTEGER,
    "tier130Seconds" INTEGER,
    "tier150Seconds" INTEGER,
    "tier210Seconds" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_exceptions" (
    "id" UUID NOT NULL,
    "rawId" UUID,
    "importIssueId" UUID,
    "calculationId" UUID,
    "code" VARCHAR(100) NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exception_resolutions" (
    "id" UUID NOT NULL,
    "exceptionId" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" VARCHAR(1000) NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exception_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_approvals" (
    "id" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "fromStatus" "PeriodStatus" NOT NULL,
    "toStatus" "PeriodStatus" NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" VARCHAR(1000),
    "periodVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "totalSeconds" INTEGER NOT NULL,
    "lockedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_lines" (
    "id" UUID NOT NULL,
    "timesheetId" UUID NOT NULL,
    "calculationId" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "timesheet_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_publications" (
    "id" UUID NOT NULL,
    "timesheetId" UUID NOT NULL,
    "artifactKey" VARCHAR(500) NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'PENDING',
    "publishedById" UUID NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "viewedAt" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),

    CONSTRAINT "timesheet_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_feedback" (
    "id" UUID NOT NULL,
    "publicationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(100),
    "before" JSONB,
    "after" JSONB,
    "reason" VARCHAR(1000),
    "requestId" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_active_idx" ON "departments"("active");

-- CreateIndex
CREATE UNIQUE INDEX "employees_code_key" ON "employees"("code");

-- CreateIndex
CREATE INDEX "employees_departmentId_active_idx" ON "employees"("departmentId", "active");

-- CreateIndex
CREATE INDEX "employees_name_idx" ON "employees"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE INDEX "users_active_lockedUntil_idx" ON "users"("active", "lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "manager_scopes_userId_effectiveFrom_effectiveTo_idx" ON "manager_scopes"("userId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "manager_scopes_departmentId_idx" ON "manager_scopes"("departmentId");

-- CreateIndex
CREATE INDEX "manager_scopes_employeeId_idx" ON "manager_scopes"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_code_key" ON "shifts"("code");

-- CreateIndex
CREATE INDEX "shifts_active_idx" ON "shifts"("active");

-- CreateIndex
CREATE INDEX "shift_rules_shiftId_effectiveFrom_effectiveTo_idx" ON "shift_rules"("shiftId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "shift_rules_shiftId_version_key" ON "shift_rules"("shiftId", "version");

-- CreateIndex
CREATE INDEX "work_schedules_shiftId_shiftDate_idx" ON "work_schedules"("shiftId", "shiftDate");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_employeeId_shiftDate_version_key" ON "work_schedules"("employeeId", "shiftDate", "version");

-- CreateIndex
CREATE INDEX "attendance_periods_status_idx" ON "attendance_periods"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_periods_year_month_key" ON "attendance_periods"("year", "month");

-- CreateIndex
CREATE INDEX "attendance_imports_sha256_status_idx" ON "attendance_imports"("sha256", "status");

-- CreateIndex
CREATE INDEX "attendance_imports_attemptedById_attemptedAt_idx" ON "attendance_imports"("attemptedById", "attemptedAt");

-- CreateIndex
CREATE INDEX "attendance_import_issues_importId_issueCode_idx" ON "attendance_import_issues"("importId", "issueCode");

-- CreateIndex
CREATE INDEX "attendance_raw_employeeId_idx" ON "attendance_raw"("employeeId");

-- CreateIndex
CREATE INDEX "attendance_raw_employeeCode_idx" ON "attendance_raw"("employeeCode");

-- CreateIndex
CREATE INDEX "attendance_raw_sourceIdentityHash_idx" ON "attendance_raw"("sourceIdentityHash");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_raw_importId_sheet_rowNo_key" ON "attendance_raw"("importId", "sheet", "rowNo");

-- CreateIndex
CREATE INDEX "attendance_normalizations_shiftDate_shiftCode_idx" ON "attendance_normalizations"("shiftDate", "shiftCode");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_normalizations_rawId_revision_key" ON "attendance_normalizations"("rawId", "revision");

-- CreateIndex
CREATE INDEX "attendance_adjustments_actorId_createdAt_idx" ON "attendance_adjustments"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_adjustments_rawId_revision_key" ON "attendance_adjustments"("rawId", "revision");

-- CreateIndex
CREATE INDEX "attendance_calculations_periodId_status_idx" ON "attendance_calculations"("periodId", "status");

-- CreateIndex
CREATE INDEX "attendance_calculations_normalizationId_idx" ON "attendance_calculations"("normalizationId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_calculations_rawId_revision_key" ON "attendance_calculations"("rawId", "revision");

-- CreateIndex
CREATE INDEX "attendance_exceptions_status_blocking_code_idx" ON "attendance_exceptions"("status", "blocking", "code");

-- CreateIndex
CREATE INDEX "attendance_exceptions_rawId_idx" ON "attendance_exceptions"("rawId");

-- CreateIndex
CREATE INDEX "exception_resolutions_exceptionId_createdAt_idx" ON "exception_resolutions"("exceptionId", "createdAt");

-- CreateIndex
CREATE INDEX "attendance_approvals_periodId_createdAt_idx" ON "attendance_approvals"("periodId", "createdAt");

-- CreateIndex
CREATE INDEX "timesheets_employeeId_periodId_idx" ON "timesheets"("employeeId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_periodId_employeeId_revision_key" ON "timesheets"("periodId", "employeeId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_lines_timesheetId_calculationId_key" ON "timesheet_lines"("timesheetId", "calculationId");

-- CreateIndex
CREATE INDEX "timesheet_publications_status_publishedAt_idx" ON "timesheet_publications"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_publications_timesheetId_sha256_key" ON "timesheet_publications"("timesheetId", "sha256");

-- CreateIndex
CREATE INDEX "employee_feedback_employeeId_status_idx" ON "employee_feedback"("employeeId", "status");

-- CreateIndex
CREATE INDEX "employee_feedback_publicationId_idx" ON "employee_feedback"("publicationId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_createdAt_idx" ON "audit_logs"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_scopes" ADD CONSTRAINT "manager_scopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_scopes" ADD CONSTRAINT "manager_scopes_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_scopes" ADD CONSTRAINT "manager_scopes_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_rules" ADD CONSTRAINT "shift_rules_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_imports" ADD CONSTRAINT "attendance_imports_attemptedById_fkey" FOREIGN KEY ("attemptedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_import_issues" ADD CONSTRAINT "attendance_import_issues_importId_fkey" FOREIGN KEY ("importId") REFERENCES "attendance_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_raw" ADD CONSTRAINT "attendance_raw_importId_fkey" FOREIGN KEY ("importId") REFERENCES "attendance_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_raw" ADD CONSTRAINT "attendance_raw_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_normalizations" ADD CONSTRAINT "attendance_normalizations_rawId_fkey" FOREIGN KEY ("rawId") REFERENCES "attendance_raw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_rawId_fkey" FOREIGN KEY ("rawId") REFERENCES "attendance_raw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_calculations" ADD CONSTRAINT "attendance_calculations_rawId_fkey" FOREIGN KEY ("rawId") REFERENCES "attendance_raw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_calculations" ADD CONSTRAINT "attendance_calculations_normalizationId_fkey" FOREIGN KEY ("normalizationId") REFERENCES "attendance_normalizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_calculations" ADD CONSTRAINT "attendance_calculations_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "attendance_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_calculations" ADD CONSTRAINT "attendance_calculations_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "attendance_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_calculations" ADD CONSTRAINT "attendance_calculations_shiftRuleId_fkey" FOREIGN KEY ("shiftRuleId") REFERENCES "shift_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_rawId_fkey" FOREIGN KEY ("rawId") REFERENCES "attendance_raw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_importIssueId_fkey" FOREIGN KEY ("importIssueId") REFERENCES "attendance_import_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "attendance_calculations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_resolutions" ADD CONSTRAINT "exception_resolutions_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "attendance_exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_resolutions" ADD CONSTRAINT "exception_resolutions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_approvals" ADD CONSTRAINT "attendance_approvals_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "attendance_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_approvals" ADD CONSTRAINT "attendance_approvals_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "attendance_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_lines" ADD CONSTRAINT "timesheet_lines_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "timesheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_lines" ADD CONSTRAINT "timesheet_lines_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "attendance_calculations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_publications" ADD CONSTRAINT "timesheet_publications_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "timesheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_publications" ADD CONSTRAINT "timesheet_publications_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_feedback" ADD CONSTRAINT "employee_feedback_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "timesheet_publications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_feedback" ADD CONSTRAINT "employee_feedback_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
