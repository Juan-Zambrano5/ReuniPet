import { join } from 'path';

// HU16: entorno de las pruebas e2e. Si no hay JWT_SECRET (clon limpio, CI) se
// usa uno SOLO para pruebas. AUTH_MODE se borra para que las pruebas corran
// como producción (sin X-User-Id) salvo las que lo activan explícitamente.
process.env.JWT_SECRET ??= 'secreto-solo-para-pruebas-e2e-no-usar-en-produccion';
delete process.env.AUTH_MODE;
// Las fotos de las pruebas van a su propia carpeta: nunca a la del desarrollo.
process.env.UPLOADS_DIR = join(__dirname, '..', 'uploads-test');
