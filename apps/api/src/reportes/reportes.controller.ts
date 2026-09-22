import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ReporteResponse } from '@reunipet/shared';
import {
  CurrentUserProvider,
} from '../usuarios/current-user.provider';
import { CreateReporteDto } from './dto/create-reporte.dto';
import { ReportesService } from './reportes.service';

@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly reportesService: ReportesService,
    @Inject(CurrentUserProvider)
    private readonly currentUser: CurrentUserProvider,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateReporteDto,
    @Req() req: Request,
  ): Promise<ReporteResponse> {
    const user = await this.currentUser.getUser(req);
    return this.reportesService.create(dto, user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ReporteResponse> {
    const reporte = await this.reportesService.findById(id);
    if (!reporte) {
      throw new NotFoundException('Reporte no encontrado');
    }
    return reporte;
  }
}
