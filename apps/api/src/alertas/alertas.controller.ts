import {
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AlertaResponse } from '@reunipet/shared';
import { CurrentUserProvider } from '../usuarios/current-user.provider';
import { AlertasService } from './alertas.service';

@Controller()
export class AlertasController {
  constructor(
    private readonly alertasService: AlertasService,
    @Inject(CurrentUserProvider)
    private readonly currentUser: CurrentUserProvider,
  ) {}

  @Get('usuarios/me/alertas')
  async getMisAlertas(@Req() req: Request): Promise<AlertaResponse[]> {
    const user = await this.currentUser.getUser(req);
    return this.alertasService.getAlertasDeUsuario(user.id);
  }

  // HU4: solo el dueño del reporte perdido puede gestionar su alerta.
  @Patch('alertas/:id/visto')
  async marcarVista(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<AlertaResponse> {
    const user = await this.currentUser.getUser(req);
    return this.alertasService.marcarVista(id, user.id);
  }

  @Patch('alertas/:id/descartar')
  async descartar(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<AlertaResponse> {
    const user = await this.currentUser.getUser(req);
    return this.alertasService.descartar(id, user.id);
  }
}
