import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { UsuarioPublicoResponse } from '@reunipet/shared';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

// HU12. HU16 (Sprint 4) agregará POST /auth/login aquí.
// No registrar nunca el body de estas rutas (contiene la contraseña).
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterDto): Promise<UsuarioPublicoResponse> {
    return this.authService.register(dto);
  }
}
