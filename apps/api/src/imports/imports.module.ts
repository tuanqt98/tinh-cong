import { Module } from '@nestjs/common';
import { ExcelParserService } from './excel-parser.service.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

@Module({
  controllers: [ImportsController],
  providers: [ExcelParserService, ImportsService],
  exports: [ExcelParserService],
})
export class ImportsModule {}
