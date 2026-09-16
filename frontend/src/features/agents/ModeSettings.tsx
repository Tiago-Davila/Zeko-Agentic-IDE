import { useEffect, useState } from 'react';
import { request } from '../../app/api/httpClient';
import { cn } from '../../design/cn';
import { Panel } from '../../design/Panel';
import { Select } from '../../design/Select';
import { autonomyMode as getAutonomyMode, permissionMode as getPermissionMode } from './agentApi';

export type PermissionMode = 'ASK_APPROVAL' | 'AUTO_APPROVE' | 'FULL_ACCESS';
export type AutonomyMode = 'MANUAL' | 'ASSISTED' | 'AUTONOMOUS';

// Distingue no haber elegido instancia, estar guardando, haber confirmado y haber fallado.
type Feedback = 'guidance' | 'loading' | 'loaded' | 'saving' | 'saved' | 'error';

interface ModeSettingsProps {
  readonly instanceId: string | null;
  readonly initialPermissionMode?: PermissionMode;
  readonly initialAutonomyMode?: AutonomyMode;
}

const feedbackStyles: Record<Feedback, string> = {
  guidance: 'border-state-waiting/40 bg-state-waiting/10 text-state-waiting',
  loading: 'border-ink-600 bg-ink-850 text-chalk-400',
  loaded: 'border-ink-600 bg-ink-850 text-chalk-400',
  saving: 'border-state-running/40 bg-state-running/10 text-state-running',
  saved: 'border-state-completed/40 bg-state-completed/10 text-state-completed',
  error: 'border-state-failed/40 bg-state-failed/10 text-state-failed',
};

export function ModeSettings({
  instanceId,
  initialPermissionMode = 'ASK_APPROVAL',
  initialAutonomyMode = 'MANUAL',
}: ModeSettingsProps) {
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(initialPermissionMode);
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>(initialAutonomyMode);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<Feedback>('guidance');
  const [loadedInstanceId, setLoadedInstanceId] = useState<string | null>(null);

  useEffect(() => {
    if (instanceId === null) return undefined;
    let active = true;
    void Promise.all([getPermissionMode(instanceId), getAutonomyMode(instanceId)]).then(([permission, autonomy]) => {
      if (!active) return;
      setPermissionMode(permission.permissionMode);
      setAutonomyMode(autonomy.autonomyMode);
      setLoadedInstanceId(instanceId);
      setFeedback('loaded');
      setMessage('Configuración cargada desde la base local.');
    }).catch(() => {
      if (!active) return;
      setFeedback('error');
      setMessage('No se pudo cargar la configuración local de esta instancia.');
    });
    return () => {
      active = false;
    };
  }, [instanceId]);

  async function updatePermission(value: PermissionMode) {
    if (instanceId === null) {
      setFeedback('guidance');
      setMessage('Seleccioná una instancia; sin cambiar iniciativa ni guardar el permiso.');
      return;
    }
    setFeedback('saving');
    setMessage('Guardando permiso…');
    try {
      await request('/api/session/bootstrap', { method: 'POST' });
      await request(`/api/agent-instances/${instanceId}/permission-mode`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionMode: value, autoApproveRules: [] }),
      });
      setPermissionMode(value);
      setLoadedInstanceId(instanceId);
      setFeedback('saved');
      setMessage('Permiso guardado sin cambiar iniciativa.');
    } catch {
      setFeedback('error');
      setMessage('No se pudo actualizar el permiso local.');
    }
  }

  async function updateAutonomy(value: AutonomyMode) {
    if (instanceId === null) {
      setFeedback('guidance');
      setMessage('Seleccioná una instancia; sin cambiar permisos ni guardar la iniciativa.');
      return;
    }
    setFeedback('saving');
    setMessage('Guardando iniciativa…');
    try {
      await request('/api/session/bootstrap', { method: 'POST' });
      await request(`/api/agent-instances/${instanceId}/autonomy-mode`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autonomyMode: value }),
      });
      setAutonomyMode(value);
      setLoadedInstanceId(instanceId);
      setFeedback('saved');
      setMessage('Iniciativa guardada sin cambiar permisos.');
    } catch {
      setFeedback('error');
      setMessage('No se pudo actualizar la iniciativa local.');
    }
  }

  /*
   * El estado de carga se deriva en vez de fijarse dentro del efecto: mientras la
   * instancia elegida no coincida con la cargada, y no haya fallado, se está cargando.
   */
  const loading = instanceId !== null && loadedInstanceId !== instanceId && feedback !== 'error';
  const shownFeedback: Feedback = loading ? 'loading' : feedback;
  const shownMessage = loading ? 'Cargando configuración…' : message;

  return (
    <Panel heading="Permiso e iniciativa" aria-label="Configuración independiente de modos">
      <p className="text-[11px] leading-relaxed text-chalk-400">
        Permiso controla acciones y aprobación; iniciativa controla follow-ups. Son dimensiones
        independientes.
      </p>

      {instanceId === null ? (
        <p className="mt-3 rounded-[var(--radius-control)] border border-ink-600 bg-ink-850 px-2 py-1.5 text-[11px] text-chalk-400">
          Sin instancia seleccionada: los cambios no se guardan.
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3">
        <Select
          label="Permiso"

          value={permissionMode}
          onChange={(event) => void updatePermission(event.target.value as PermissionMode)}
        >
          <option value="ASK_APPROVAL">Ask Approval</option>
          <option value="AUTO_APPROVE">Auto Approve</option>
          <option value="FULL_ACCESS">Full Access</option>
        </Select>
        <Select
          label="Iniciativa"

          value={autonomyMode}
          onChange={(event) => void updateAutonomy(event.target.value as AutonomyMode)}
        >
          <option value="MANUAL">Manual</option>
          <option value="ASSISTED">Assisted</option>
          <option value="AUTONOMOUS">Autonomous</option>
        </Select>
      </div>

      {shownMessage ? (
        <p
          role="status"
          className={cn(
            'mt-3 rounded-[var(--radius-control)] border px-2 py-1.5 text-[11px]',
            feedbackStyles[shownFeedback],
          )}
        >
          {shownMessage}
        </p>
      ) : null}
    </Panel>
  );
}
