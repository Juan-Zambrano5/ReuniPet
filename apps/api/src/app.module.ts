import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { ReportesModule } from './reportes/reportes.module';
import { MatchingModule } from './matching/matching.module';
import { AlertasModule } from './alertas/alertas.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    ReportesModule,
    MatchingModule,
    AlertasModule,
    AuthModule,
    AdminModule,
  ],
})
export class AppModule {}
