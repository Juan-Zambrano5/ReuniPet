import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { FotosService } from './fotos.service';

@Module({
  imports: [MatchingModule],
  controllers: [ReportesController],
  providers: [ReportesService, FotosService],
  exports: [ReportesService],
})
export class ReportesModule {}
