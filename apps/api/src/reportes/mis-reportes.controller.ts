import { Controller, Get, Inject, Req } from '@nestjs/common';
import { Request } from 'express';
import { MiReporteItem } from '@reunipet/shared';
import { CurrentUserProvider } from '../usuarios/current-user.provider';
import { ReportesService } from './reportes.service';

// HU15: "mis reportes" del usuario de la sesión (simulada hasta HU16).
@Controller('usuarios/me')
export class MisReportesController {
  constructor(
    private readonly reportesService: ReportesService,
    @Inject(CurrentUserProvider)
    private readonly currentUser: CurrentUserProvider,
  ) {}

  @Get('reportes')
  async getMisReportes(@Req() req: Request): Promise<MiReporteItem[]> {
    const user = await this.currentUser.getUser(req);
    return this.reportesService.listMine(user);
  }
}
