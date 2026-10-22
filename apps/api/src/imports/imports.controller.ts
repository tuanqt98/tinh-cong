import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '../generated/prisma/index.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { PaginationDto } from '../core/dto.js';
import { PreviewImportDto } from './dto.js';
import type { UploadedWorkbook } from './imports.types.js';
import { ImportsService } from './imports.service.js';

@ApiBearerAuth()
@ApiTags('imports')
@Roles(RoleCode.ADMIN, RoleCode.HR)
@Controller('imports')
export class ImportsController {
  constructor(@Inject(ImportsService) private readonly imports: ImportsService) {}

  @Post('preview')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  preview(
    @UploadedFile() file: UploadedWorkbook | undefined,
    @Body() dto: PreviewImportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.imports.preview(file, dto.mapping, user);
  }

  @Post(':id/confirm')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.imports.confirm(id, user);
  }

  @Get()
  list(@Query() query: PaginationDto) {
    return this.imports.list(query);
  }

  @Post(':id/process')
  process(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.imports.process(id, user);
  }

  @Post(':id/approve-source-and-process')
  approveSourceAndProcess(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.imports.approveSourceAndProcess(id, user);
  }

  @Get(':id/rows')
  rows(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationDto) {
    return this.imports.rows(id, query);
  }

  @Get(':id/source')
  async source(@Param('id', ParseUUIDPipe) id: string) {
    const source = await this.imports.source(id);
    return new StreamableFile(source.buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(source.filename)}`,
    });
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.imports.detail(id);
  }
}
