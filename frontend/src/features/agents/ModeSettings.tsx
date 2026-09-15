import { useEffect, useState } from 'react';
import { request } from '../../app/api/httpClient';
import { autonomyMode as getAutonomyMode, permissionMode as getPermissionMode } from './agentApi';

export type PermissionMode = 'ASK_APPROVAL' | 'AUTO_APPROVE' | 'FULL_ACCESS';
export type AutonomyMode = 'MANUAL' | 'ASSISTED' | 'AUTONOMOUS';

interface ModeSettingsProps {
  readonly instanceId: string | null;
  readonly initialPermissionMode?: PermissionMode;
  readonly initialAutonomyMode?: AutonomyMode;
}

export function ModeSettings({
  instanceId,
  initialPermissionMode = 'ASK_APPROVAL',
  initialAutonomyMode = 'MANUAL',
}: ModeSettingsProps) {
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(initialPermissionMode);
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>(initialAutonomyMode);
  const [message, setMessage] = useState('');
  const [loadedInstanceId, setLoadedInstanceId] = useState<string | null>(null);

  useEffect(() => {
    if (instanceId === null) return undefined;
    let active = true;
    void Promise.all([getPermissionMode(instanceId), getAutonomyMode(instanceId)]).then(([permission, autonomy]) => {
      if (!active) return;
      setPermissionMode(permission.permissionMode);
      setAutonomyMode(autonomy.autonomyMode);
      setLoadedInstanceId(instanceId);
      setMessage('Configuración cargada desde la base local.');
    }).catch(() => {
      if (active) setMessage('No se pudo cargar la configuración local de esta instancia.');
    });
    return () => {
      active = false;
    };
  }, [instanceId]);

  async function updatePermission(value: PermissionMode) {
    if (instanceId === null) {
      setMessage('Seleccioná una instancia; sin cambiar iniciativa ni guardar el permiso.');
      return;
    }
    setMessage('Guardando permiso…');
    try {
      await request('/api/session/bootstrap', { method: 'POST' });
      await request(`/api/agent-instances/${instanceId}/permission-mode`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionMode: value, autoApproveRules: [] }),
      });
      setPermissionMode(value);
      setLoadedInstanceId(instanceId);
      setMessage('Permiso guardado sin cambiar iniciativa.');
    } catch {
      setMessage('No se pudo actualizar el permiso local.');
    }
  }

  async function updateAutonomy(value: AutonomyMode) {
    if (instanceId === null) {
      setMessage('Seleccioná una instancia; sin cambiar permisos ni guardar la iniciativa.');
      return;
    }
    setMessage('Guardando iniciativa…');
    try {
      await request('/api/session/bootstrap', { method: 'POST' });
      await request(`/api/agent-instances/${instanceId}/autonomy-mode`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autonomyMode: value }),
      });
      setAutonomyMode(value);
      setLoadedInstanceId(instanceId);
      setMessage('Iniciativa guardada sin cambiar permisos.');
    } catch {
      setMessage('No se pudo actualizar la iniciativa local.');
    }
  }

  return (
    <section aria-label="Configuración independiente de modos">
      <h3>Permiso e iniciativa</h3>
      <p>Permiso controla acciones y aprobación; iniciativa controla follow-ups. Son dimensiones independientes.</p>
      {instanceId !== null && loadedInstanceId !== instanceId && !message.startsWith('No se pudo') ? <p role="status">Cargando configuración…</p> : null}
      <label>Permiso
        <select aria-label="Permiso" value={permissionMode} onChange={(event) => void updatePermission(event.target.value as PermissionMode)}>
          <option value="ASK_APPROVAL">Ask Approval</option>
          <option value="AUTO_APPROVE">Auto Approve</option>
          <option value="FULL_ACCESS">Full Access</option>
        </select>
      </label>
      <label>Iniciativa
        <select aria-label="Iniciativa" value={autonomyMode} onChange={(event) => void updateAutonomy(event.target.value as AutonomyMode)}>
          <option value="MANUAL">Manual</option>
          <option value="ASSISTED">Assisted</option>
          <option value="AUTONOMOUS">Autonomous</option>
        </select>
      </label>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
