import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { FotografiaResponse, ReporteResponse } from '@reunipet/shared';
import { CurrentUserProvider } from '../usuarios/current-user.provider';
import { MulterExceptionFilter } from '../common/multer-exception.filter';
import { CreateReporteDto } from './dto/create-reporte.dto';
import { FotosService } from './fotos.service';
import { ReportesService } from './reportes.service';

@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly reportesService: ReportesService,
    private readonly fotosService: FotosService,
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

  @Post(':id/fotos')
  @UseInterceptors(
    FilesInterceptor('fotos', 10, {
      storage: memoryStorage(),
    }),
  )
  @UseFilters(MulterExceptionFilter)
  async uploadFotos(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<FotografiaResponse[]> {
    const creadas = await this.fotosService.addFotos(id, files ?? []);
    return creadas.map((f) => ({
      id: f.id,
      reporteId: f.reporteId,
      url: f.url,
      orden: f.orden,
      createdAt: f.createdAt.toISOString(),
    }));
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
