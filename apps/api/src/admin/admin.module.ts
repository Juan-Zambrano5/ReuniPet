import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { ReportesModule } from '../reportes/reportes.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [ReportesModule],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
