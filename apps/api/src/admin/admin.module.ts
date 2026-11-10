import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { ReportesModule } from '../reportes/reportes.module';
import { AdminController } from './admin.controller';
import { AdminUsuariosService } from './admin-usuarios.service';

@Module({
  imports: [ReportesModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminUsuariosService],
})
export class AdminModule {}
