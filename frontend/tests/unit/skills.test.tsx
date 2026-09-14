import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkillPanel } from '../../src/features/skills/SkillPanel';
vi.mock('../../src/features/skills/skillApi', () => ({ skills: vi.fn().mockResolvedValue([]) }));
afterEach(cleanup);
describe('SkillPanel', () => { it('does not present a skill as permission authority', () => { render(<SkillPanel projectId="p" />); expect(screen.getByText(/no concede permisos/i)).not.toBeNull(); }); });
