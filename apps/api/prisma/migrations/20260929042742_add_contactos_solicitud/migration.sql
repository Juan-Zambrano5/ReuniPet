-- CreateTable
CREATE TABLE "ContactoSolicitud" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactoSolicitud_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactoSolicitud_reporteId_idx" ON "ContactoSolicitud"("reporteId");

-- AddForeignKey
ALTER TABLE "ContactoSolicitud" ADD CONSTRAINT "ContactoSolicitud_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoSolicitud" ADD CONSTRAINT "ContactoSolicitud_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
