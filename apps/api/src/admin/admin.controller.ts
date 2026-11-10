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
import { AdminReporteItem, AdminUsuarioItem } from '@reunipet/shared';
import { AdminGuard, AdminRequest } from '../auth/admin.guard';
import { ReportesService } from '../reportes/reportes.service';
import { AdminUsuariosService } from './admin-usuarios.service';
import { ActivoDto } from './dto/activo.dto';
import { ModeracionDto } from './dto/moderacion.dto';

// HU18/HU19: todo /admin exige rol ADMIN (AC3 de ambas).
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly reportesService: ReportesService,
    private readonly usuariosService: AdminUsuariosService,
  ) {}

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

  @Get('usuarios')
  listUsuarios(): Promise<AdminUsuarioItem[]> {
    return this.usuariosService.listar();
  }

  @Patch('usuarios/:id/activo')
  cambiarActivo(
    @Param('id') id: string,
    @Body() dto: ActivoDto,
    @Req() req: AdminRequest,
  ): Promise<AdminUsuarioItem> {
    return this.usuariosService.cambiarActivo(id, dto.activo, req.admin);
  }
}
