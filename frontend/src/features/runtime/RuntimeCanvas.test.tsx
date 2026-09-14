import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeCanvas } from './RuntimeCanvas';

vi.mock('./runtimeApi', () => ({ runtimeSnapshot: vi.fn(async () => []) }));

describe('RuntimeCanvas', () => {
  afterEach(cleanup);
  it('keeps the runtime canvas observational', () => {
    render(<RuntimeCanvas />);
    expect(screen.getByLabelText('Runtime Canvas').textContent).toContain('observacional');
  });
});
