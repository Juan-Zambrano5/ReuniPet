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
import { RolUsuario } from '@prisma/client';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import {
  ContactoPropietarioResponse,
  FotografiaResponse,
  ListReportesResponse,
  ReporteResponse,
} from '@reunipet/shared';
import { CurrentUserProvider } from '../usuarios/current-user.provider';
import { MulterExceptionFilter } from '../common/multer-exception.filter';
import { CreateReporteDto } from './dto/create-reporte.dto';
import { ListReportesDto } from './dto/list-reportes.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';
import { UpdateReporteDto } from './dto/update-reporte.dto';
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
    @Req() req: Request,
  ): Promise<FotografiaResponse[]> {
    const user = await this.currentUser.getUser(req);
    const creadas = await this.fotosService.addFotos(id, files ?? [], user.id);
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
    // HU16: ruta pública; sin sesión, coordenadas aproximadas para todos.
    const user = await this.currentUser.getOptionalUser(req);
    return this.reportesService.list(dto, user);
  }

  // HU10: contacto del propietario + registro de trazabilidad.
  @Get(':id/contacto')
  async getContacto(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<ContactoPropietarioResponse> {
    const user = await this.currentUser.getUser(req);
    return this.reportesService.getContacto(id, user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<ReporteResponse> {
    // HU9 AC3: las coords se sirven según quién consulta (dueño o tercero).
    // HU16: ruta pública; sin sesión esPropietario es false.
    const user = await this.currentUser.getOptionalUser(req);
    const reporte = await this.reportesService.findById(
      id,
      user?.id ?? null,
      user?.rol === RolUsuario.ADMIN,
    );
    if (!reporte) {
      throw new NotFoundException('Reporte no encontrado');
    }
    return reporte;
  }

  // HU17: editar especie, raza, color y características (solo su propietario).
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReporteDto,
    @Req() req: Request,
  ): Promise<ReporteResponse> {
    const user = await this.currentUser.getUser(req);
    return this.reportesService.update(id, dto, user);
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

  // HU11/HU14: cambiar el estado del reporte (solo su propietario).
  @Patch(':id/estado')
  async updateEstado(
    @Param('id') id: string,
    @Body() dto: UpdateEstadoDto,
    @Req() req: Request,
  ): Promise<ReporteResponse> {
    const user = await this.currentUser.getUser(req);
    return this.reportesService.updateEstado(id, dto.estado, user);
  }
}
