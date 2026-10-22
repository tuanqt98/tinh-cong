import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/public.decorator.js';

@ApiTags('system')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check không lộ dữ liệu' })
  health() {
    return {
      status: 'ok',
      service: 'tinh-cong-api',
      timezone: 'Asia/Ho_Chi_Minh',
      timestamp: new Date().toISOString(),
    };
  }
}
