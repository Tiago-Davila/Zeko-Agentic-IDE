import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModeSettings } from './ModeSettings';

vi.mock('./agentApi', () => ({
  permissionMode: vi.fn().mockResolvedValue({ instanceId: 'instance-1', permissionMode: 'FULL_ACCESS', autoApproveRules: [] }),
  autonomyMode: vi.fn().mockResolvedValue({ instanceId: 'instance-1', autonomyMode: 'ASSISTED' }),
}));

afterEach(cleanup);

describe('ModeSettings', () => {
  it('keeps permission and initiative as separate controls', () => {
    render(<ModeSettings instanceId={null} />);
    fireEvent.change(screen.getByLabelText('Permiso'), { target: { value: 'FULL_ACCESS' } });
    expect((screen.getByLabelText('Iniciativa') as HTMLSelectElement).value).toBe('MANUAL');
    expect(screen.getByRole('status').textContent).toContain('sin cambiar iniciativa');
  });

  it('loads persisted values for the selected instance', async () => {
    render(<ModeSettings instanceId="instance-1" />);
    await waitFor(() => {
      expect((screen.getByLabelText('Permiso') as HTMLSelectElement).value).toBe('FULL_ACCESS');
      expect((screen.getByLabelText('Iniciativa') as HTMLSelectElement).value).toBe('ASSISTED');
    });
    expect(screen.getByRole('status').textContent).toContain('cargada');
  });
});
