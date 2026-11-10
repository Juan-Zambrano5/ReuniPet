import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminReporteItem } from '@reunipet/shared';
import { AdminGuard, AdminRequest } from '../auth/admin.guard';
import { ReportesService } from '../reportes/reportes.service';
import { ModeracionDto } from './dto/moderacion.dto';

// HU18: todo /admin exige rol ADMIN (AC3). HU19 sumará /admin/usuarios.
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('reportes')
  listReportes(
    @Query('moderados') moderados: string | undefined,
    @Req() req: AdminRequest,
  ): Promise<AdminReporteItem[]> {
    return this.reportesService.listAdmin(moderados === 'true', req.admin);
  }

  @Patch('reportes/:id/moderacion')
  moderar(
    @Param('id') id: string,
    @Body() dto: ModeracionDto,
    @Req() req: AdminRequest,
  ): Promise<AdminReporteItem> {
    return this.reportesService.moderar(id, dto.moderado, dto.motivo, req.admin);
  }
}
