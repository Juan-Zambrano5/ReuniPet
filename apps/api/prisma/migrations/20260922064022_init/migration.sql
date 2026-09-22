-- CreateEnum
CREATE TYPE "TipoReporte" AS ENUM ('PERDIDA', 'ENCONTRADA');

-- CreateEnum
CREATE TYPE "EstadoReporte" AS ENUM ('PERDIDA', 'ENCONTRADA', 'RECUPERADA');

-- CreateEnum
CREATE TYPE "EstadoCoincidencia" AS ENUM ('PENDIENTE', 'VISTA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reporte" (
    "id" TEXT NOT NULL,
    "tipo" "TipoReporte" NOT NULL,
    "especie" TEXT NOT NULL,
    "raza" TEXT,
    "color" TEXT NOT NULL,
    "caracteristicasDistintivas" TEXT,
    "ubicacion" TEXT,
    "estado" "EstadoReporte" NOT NULL,
    "propietarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fotografia" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fotografia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coincidencia" (
    "id" TEXT NOT NULL,
    "reportePerdidaId" TEXT NOT NULL,
    "reporteEncontradaId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoCoincidencia" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coincidencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fotografia" ADD CONSTRAINT "Fotografia_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coincidencia" ADD CONSTRAINT "Coincidencia_reportePerdidaId_fkey" FOREIGN KEY ("reportePerdidaId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coincidencia" ADD CONSTRAINT "Coincidencia_reporteEncontradaId_fkey" FOREIGN KEY ("reporteEncontradaId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
