import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '../generated/prisma/index.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import {
  CalculatePreviewDto,
  CreateDepartmentDto,
  CreateEmployeeDto,
  CreatePeriodDto,
  CreateShiftDto,
  FeedbackDto,
  PaginationDto,
  ResolveExceptionDto,
  TransitionPeriodDto,
  UpdateEmployeeDto,
} from './dto.js';
import { CoreService } from './core.service.js';

@ApiBearerAuth()
@ApiTags('core')
@Controller()
export class CoreController {
  constructor(@Inject(CoreService) private readonly core: CoreService) {}

  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER)
  @Get('dashboard')
  dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.core.dashboard(
      user,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER)
  @Get('employees')
  listEmployees(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    return this.core.listEmployees(user, query);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER, RoleCode.EMPLOYEE)
  @Get('employees/:id')
  getEmployee(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.core.getEmployee(user, id);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @Post('employees')
  createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.core.createEmployee(dto);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @Patch('employees/:id')
  updateEmployee(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.core.updateEmployee(id, dto);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER)
  @Get('departments')
  listDepartments() {
    return this.core.listDepartments();
  }

  @Roles(RoleCode.ADMIN)
  @Post('departments')
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.core.createDepartment(dto);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER)
  @Get('periods')
  listPeriods() {
    return this.core.listPeriods();
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @Post('periods')
  createPeriod(@Body() dto: CreatePeriodDto) {
    return this.core.createPeriod(dto);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @Post('periods/:id/transitions')
  transitionPeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionPeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.core.transitionPeriod(id, dto, user);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @Post('attendance/calculate-preview')
  calculatePreview(@Body() dto: CalculatePreviewDto) {
    return this.core.calculatePreview(dto);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @Get('exceptions')
  listExceptions(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    return this.core.listExceptions(user, query);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @Post('exceptions/:id/resolve')
  resolveException(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveExceptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.core.resolveException(id, dto, user);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER)
  @Get('shifts')
  listShifts() {
    return this.core.listShifts();
  }

  @Roles(RoleCode.ADMIN)
  @Post('shifts')
  createShift(@Body() dto: CreateShiftDto) {
    return this.core.createShift(dto);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @Get('audit-logs')
  listAudit(@Query() query: PaginationDto) {
    return this.core.listAudit(query);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER)
  @Get('attendance')
  listAttendance(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    return this.core.listAttendance(user, query);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER, RoleCode.EMPLOYEE)
  @Get('attendance/employee/:id')
  employeeAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.core.employeeAttendance(user, id);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER)
  @Get('publications')
  listPublications(@CurrentUser() user: AuthenticatedUser) {
    return this.core.listPublications(user);
  }

  @Roles(RoleCode.EMPLOYEE, RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER)
  @Get('me/timesheets')
  myTimesheets(@CurrentUser() user: AuthenticatedUser) {
    return this.core.myTimesheets(user);
  }

  @Roles(RoleCode.EMPLOYEE)
  @Post('me/publications/:id/view')
  viewPublication(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.core.markPublication(user, id, 'view');
  }

  @Roles(RoleCode.EMPLOYEE)
  @Post('me/publications/:id/confirm')
  confirmPublication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.core.markPublication(user, id, 'confirm');
  }

  @Roles(RoleCode.EMPLOYEE)
  @Post('me/publications/:id/feedback')
  feedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FeedbackDto,
  ) {
    return this.core.createFeedback(user, id, dto);
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER)
  @Get('attendance/export')
  async exportAttendance(@CurrentUser() user: AuthenticatedUser) {
    const buffer = await this.core.exportAttendanceExcel(user);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="bang-cong-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    });
  }

  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER, RoleCode.EMPLOYEE)
  @Get('timesheets/:id/pdf')
  async timesheetPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const buffer = await this.core.timesheetPdf(user, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="bang-cong-${id}.pdf"`,
    });
  }
}
