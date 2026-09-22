import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('AppModule', () => {
  it('debe compilar el módulo raíz', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
