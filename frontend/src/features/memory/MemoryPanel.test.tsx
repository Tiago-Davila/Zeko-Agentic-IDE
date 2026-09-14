import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryPanel } from './MemoryPanel';
describe('MemoryPanel', () => { afterEach(cleanup); it('shows local context search', () => { render(<MemoryPanel projectId={null} ownerId={null} />); expect(screen.getByText('Contexto local')).not.toBeNull(); }); });
