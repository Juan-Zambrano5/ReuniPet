import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { LoginResponse, UsuarioPublicoResponse } from '@reunipet/shared';
import { CurrentUserProvider } from '../usuarios/current-user.provider';
import { AuthService, aUsuarioPublico } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// HU12 (registro) y HU16 (login). No registrar nunca el body de estas rutas
// (contiene la contraseña).
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(CurrentUserProvider)
    private readonly currentUser: CurrentUserProvider,
  ) {}

  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterDto): Promise<UsuarioPublicoResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  // HU16: datos públicos del usuario del token (401 sin sesión válida).
  @Get('me')
  async me(@Req() req: Request): Promise<UsuarioPublicoResponse> {
    return aUsuarioPublico(await this.currentUser.getUser(req));
  }
}
