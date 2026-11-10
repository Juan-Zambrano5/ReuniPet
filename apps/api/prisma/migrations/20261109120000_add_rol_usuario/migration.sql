-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('USUARIO', 'ADMIN');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "rol" "RolUsuario" NOT NULL DEFAULT 'USUARIO';
