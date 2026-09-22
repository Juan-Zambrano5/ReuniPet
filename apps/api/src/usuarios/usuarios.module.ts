import { Global, Module } from '@nestjs/common';
import {
  CurrentUserProvider,
  HeaderCurrentUserProvider,
} from './current-user.provider';

@Global()
@Module({
  providers: [
    {
      provide: CurrentUserProvider,
      useClass: HeaderCurrentUserProvider,
    },
  ],
  exports: [CurrentUserProvider],
})
export class UsuariosModule {}
