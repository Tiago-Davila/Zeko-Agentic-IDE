import { request } from '../../app/api/httpClient';

export interface RepositoryDto {
  readonly id: string;
  readonly projectId: string;
  readonly path: string;
  readonly accessState: 'AVAILABLE' | 'UNAVAILABLE' | 'INVALID';
}

export interface ProjectDto {
  readonly id: string;
  readonly name: string;
  readonly rootPath: string;
  readonly repositories: readonly RepositoryDto[];
}

export interface CreateProjectInput {
  readonly name: string;
  readonly rootPath: string;
}

async function ensureLocalSession(): Promise<void> {
  await request('/api/session/bootstrap', { method: 'POST' });
}

export async function listProjects(): Promise<readonly ProjectDto[]> {
  await ensureLocalSession();
  return request<readonly ProjectDto[]>('/api/projects');
}

export async function createProject(input: CreateProjectInput): Promise<ProjectDto> {
  await ensureLocalSession();
  return request<ProjectDto>('/api/projects', jsonRequest('POST', input));
}

export async function addRepository(projectId: string, path: string): Promise<RepositoryDto> {
  await ensureLocalSession();
  return request<RepositoryDto>(`/api/projects/${projectId}/repositories`, jsonRequest('POST', { path }));
}

function jsonRequest(method: string, body: object): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
