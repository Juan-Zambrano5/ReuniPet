import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  CurrentUserProvider,
  JwtCurrentUserProvider,
} from '../usuarios/current-user.provider';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRateLimiter } from './login-rate-limiter';
import { TOKEN_DURACION, TokenService, leerJwtSecret } from './token.service';

// Global: CurrentUserProvider lo usan los controllers de reportes y alertas.
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: leerJwtSecret(),
        // Algoritmo fijo al firmar y al verificar (evita confusión de algoritmo).
        signOptions: { expiresIn: TOKEN_DURACION, algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    { provide: LoginRateLimiter, useFactory: () => new LoginRateLimiter() },
    { provide: CurrentUserProvider, useClass: JwtCurrentUserProvider },
  ],
  exports: [CurrentUserProvider, TokenService],
})
export class AuthModule {}
