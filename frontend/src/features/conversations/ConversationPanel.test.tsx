import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConversationPanel } from './ConversationPanel';
describe('ConversationPanel', () => { it('keeps direct instruction visible', () => { render(<ConversationPanel projectId="project" />); expect(screen.getByRole('button', { name: 'Enviar instrucción' })).not.toBeNull(); }); });
