'use client';

import * as React from 'react';
import { AdminUsuarioItem, RolUsuario } from '@reunipet/shared';
import { MENSAJE_SOLO_ADMIN } from '@/components/admin/AdminReportes';
import { ErrorText } from '@/components/ErrorText';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { ApiError, cambiarActivoUsuario, getAdminUsuarios } from '@/lib/api';

const MENSAJE_ERROR = 'No se pudo completar la acción. Intenta de nuevo.';

function mensajeDeError(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) return MENSAJE_SOLO_ADMIN;
  // 400 del API: "No se puede suspender a un administrador", etc.
  const message = err instanceof ApiError
    ? (err.body as { message?: unknown } | undefined)?.message
    : undefined;
  return err instanceof ApiError && err.status === 400 && typeof message === 'string'
    ? message
    : MENSAJE_ERROR;
}

// HU19: el administrador suspende y reactiva cuentas.
export function AdminUsuarios(): React.JSX.Element {
  const [usuarios, setUsuarios] = React.useState<AdminUsuarioItem[] | null>(
    null,
  );
  const [errorCarga, setErrorCarga] = React.useState<string | null>(null);
  // Fila con la confirmación de "Suspender" abierta.
  const [confirmando, setConfirmando] = React.useState<string | null>(null);
  const [enCurso, setEnCurso] = React.useState<string | null>(null);
  const [errorAccion, setErrorAccion] = React.useState<{
    id: string;
    texto: string;
  } | null>(null);

  React.useEffect(() => {
    let cancelado = false;
    getAdminUsuarios()
      .then((datos) => {
        if (!cancelado) setUsuarios(datos);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        setErrorCarga(
          err instanceof ApiError && err.status === 403
            ? MENSAJE_SOLO_ADMIN
            : 'No se pudieron cargar los usuarios. Intenta de nuevo.',
        );
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function cambiar(id: string, activo: boolean): Promise<void> {
    setEnCurso(id);
    setErrorAccion(null);
    try {
      const actualizado = await cambiarActivoUsuario(id, { activo });
      setUsuarios((prev) =>
        (prev ?? []).map((u) => (u.id === id ? actualizado : u)),
      );
      setConfirmando(null);
    } catch (err) {
      setErrorAccion({ id, texto: mensajeDeError(err) });
    } finally {
      setEnCurso(null);
    }
  }

  if (errorCarga) {
    return (
      <p
        role="alert"
        className="rounded-card bg-surface px-4 py-6 text-center text-sm text-destructive"
        data-testid="admin-error"
      >
        {errorCarga}
      </p>
    );
  }

  if (!usuarios) {
    return (
      <p className="py-12 text-center text-sm text-muted">Cargando usuarios...</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Usuarios registrados</caption>
        <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Nombre</th>
            <th scope="col" className="px-4 py-3 font-semibold">Correo</th>
            <th scope="col" className="px-4 py-3 font-semibold">Rol</th>
            <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Reportes</th>
            <th scope="col" className="px-4 py-3 font-semibold">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => {
            const esAdmin = u.rol === RolUsuario.ADMIN;
            return (
              <tr
                key={u.id}
                className="border-b border-border last:border-0 align-top"
                data-testid={`admin-usuario-${u.id}`}
              >
                <td className="px-4 py-3 font-medium text-text">{u.nombre}</td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3 text-text">
                  {esAdmin ? 'Administrador' : 'Usuario'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge variant={u.activo ? 'success' : 'danger'}>
                    {u.activo ? 'Activo' : 'Suspendido'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-text">
                  {u.totalReportes}
                </td>
                <td className="px-4 py-3">
                  {/* Un administrador no se suspende (el API responde 400). */}
                  {esAdmin ? null : confirmando === u.id ? (
                    <div
                      className="flex flex-col gap-2"
                      role="group"
                      aria-label={`Confirmar suspensión de ${u.nombre}`}
                    >
                      <p className="text-sm text-text">
                        ¿Suspender a {u.nombre}? No podrá iniciar sesión.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={enCurso === u.id}
                          onClick={() => void cambiar(u.id, false)}
                        >
                          {enCurso === u.id ? 'Suspendiendo...' : 'Confirmar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setConfirmando(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : u.activo ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setConfirmando(u.id);
                        setErrorAccion(null);
                      }}
                    >
                      Suspender
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={enCurso === u.id}
                      onClick={() => void cambiar(u.id, true)}
                    >
                      {enCurso === u.id ? 'Reactivando...' : 'Reactivar'}
                    </Button>
                  )}
                  {errorAccion?.id === u.id && (
                    <ErrorText>{errorAccion.texto}</ErrorText>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
