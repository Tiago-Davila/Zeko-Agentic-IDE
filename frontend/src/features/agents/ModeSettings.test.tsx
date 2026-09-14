import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModeSettings } from './ModeSettings';

describe('ModeSettings', () => {
  it('keeps permission and initiative as separate controls', () => {
    render(<ModeSettings instanceId={null} />);
    fireEvent.change(screen.getByLabelText('Permiso'), { target: { value: 'FULL_ACCESS' } });
    expect((screen.getByLabelText('Iniciativa') as HTMLSelectElement).value).toBe('MANUAL');
    expect(screen.getByRole('status').textContent).toContain('sin cambiar iniciativa');
  });
});
