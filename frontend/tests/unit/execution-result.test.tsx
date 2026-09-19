import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DiffViewer } from '../../src/features/runtime/DiffViewer';

describe('execution result', () => {
  afterEach(cleanup);
  it('separates attributable changes from preserved previous changes', () => {
    render(<DiffViewer attributableDiff="task change" previousChanges="previous change" />);
    expect(screen.getByText('task change')).not.toBeNull();
    expect(screen.getByText('previous change')).not.toBeNull();
  });
});
