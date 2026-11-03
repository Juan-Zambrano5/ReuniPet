import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { MisReportesController } from './mis-reportes.controller';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { FotosService } from './fotos.service';

@Module({
  imports: [MatchingModule],
  controllers: [ReportesController, MisReportesController],
  providers: [ReportesService, FotosService],
  exports: [ReportesService],
})
export class ReportesModule {}
