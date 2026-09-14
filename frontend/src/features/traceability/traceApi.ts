import {request} from '../../app/api/httpClient';

export interface TraceDto {
  readonly sourceId: string;
  readonly targetId: string;
  readonly relation: string;
  readonly detail: Record<string, string>;
}

export async function traces(resourceId: string): Promise<readonly TraceDto[]> {
  return request(`/api/traces/${resourceId}`);
}
