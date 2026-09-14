import { useState } from 'react';
import { request } from '../../app/api/httpClient';

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

  async function updatePermission(value: PermissionMode) {
    try {
      if (instanceId !== null) {
        await request('/api/session/bootstrap', { method: 'POST' });
        await request(`/api/agent-instances/${instanceId}/permission-mode`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissionMode: value, autoApproveRules: [] }),
        });
      }
      setPermissionMode(value);
      setMessage('Permiso actualizado sin cambiar iniciativa.');
    } catch {
      setMessage('No se pudo actualizar el permiso local.');
    }
  }

  async function updateAutonomy(value: AutonomyMode) {
    try {
      if (instanceId !== null) {
        await request('/api/session/bootstrap', { method: 'POST' });
        await request(`/api/agent-instances/${instanceId}/autonomy-mode`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autonomyMode: value }),
        });
      }
      setAutonomyMode(value);
      setMessage('Iniciativa actualizada sin cambiar permisos.');
    } catch {
      setMessage('No se pudo actualizar la iniciativa local.');
    }
  }

  return (
    <section aria-label="Configuración independiente de modos">
      <h3>Permiso e iniciativa</h3>
      <p>Permiso controla acciones y aprobación; iniciativa controla follow-ups. Son dimensiones independientes.</p>
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
