import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import {
  FotografiaResponse,
  ListReportesResponse,
  ReporteResponse,
} from '@reunipet/shared';
import { CurrentUserProvider } from '../usuarios/current-user.provider';
import { MulterExceptionFilter } from '../common/multer-exception.filter';
import { CreateReporteDto } from './dto/create-reporte.dto';
import { ListReportesDto } from './dto/list-reportes.dto';
import { UpdateUbicacionDto } from './dto/update-ubicacion.dto';
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

  @Get()
  async list(
    @Query() dto: ListReportesDto,
    @Req() req: Request,
  ): Promise<ListReportesResponse> {
    const user = await this.currentUser.getUser(req);
    return this.reportesService.list(dto, user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<ReporteResponse> {
    // HU9 AC3: las coords se sirven según quién consulta (dueño o tercero).
    const user = await this.currentUser.getUser(req);
    const reporte = await this.reportesService.findById(id, user.id);
    if (!reporte) {
      throw new NotFoundException('Reporte no encontrado');
    }
    return reporte;
  }

  // HU9: actualizar el punto del reporte (solo su propietario).
  @Patch(':id/ubicacion')
  async updateUbicacion(
    @Param('id') id: string,
    @Body() dto: UpdateUbicacionDto,
    @Req() req: Request,
  ): Promise<ReporteResponse> {
    const user = await this.currentUser.getUser(req);
    return this.reportesService.updateUbicacion(id, dto, user);
  }
}
