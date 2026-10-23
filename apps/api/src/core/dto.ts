import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EmployeeStatus, PeriodStatus, RoleCode } from '../generated/prisma/index.js';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

export class EmployeeQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsIn(['code', 'name', 'department', 'status'])
  sortBy: 'code' | 'name' | 'department' | 'status' = 'code';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsUUID()
  departmentId: string;

  @IsEnum(EmployeeStatus)
  status: EmployeeStatus;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class EmployeeImportRowDto extends CreateEmployeeDto {}

export class ConfirmEmployeeImportDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => EmployeeImportRowDto)
  rows: EmployeeImportRowDto[];
}

export class DeactivateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class CreatePeriodDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

export class TransitionPeriodDto {
  @IsEnum(PeriodStatus)
  targetStatus: PeriodStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class EvidenceDto {
  @IsString()
  @IsNotEmpty()
  type: 'SOURCE_TIMESTAMP' | 'WORK_SCHEDULE' | 'APPROVED_MAPPING' | 'HR_ADJUSTMENT';

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reference: string;
}

export class CalculatePreviewDto {
  @IsString()
  @MaxLength(50)
  employeeCode: string;

  @IsOptional()
  @IsString()
  shiftCode: string | null;

  @IsOptional()
  @IsString()
  shiftDate: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  checkInAt: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  checkOutAt: string | null;

  @IsOptional()
  @IsObject()
  shiftDateEvidence: EvidenceDto | null;

  @IsOptional()
  @IsObject()
  checkOutDateEvidence: EvidenceDto | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  abnormalDurationThresholdSeconds?: number;
}

export class ResolveExceptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  action: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @IsOptional()
  @IsObject()
  after?: Record<string, unknown>;
}

export class CreateShiftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}

export class AssignRoleDto {
  @IsEnum(RoleCode)
  role: RoleCode;
}

export class FeedbackDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;
}
