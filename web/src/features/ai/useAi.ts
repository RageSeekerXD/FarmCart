import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { AiStatus } from '../../api/types';

/** Чи ввімкнено на сервері підказки ШІ: без ключа API їх не видно, а застосунок працює як звичайно. */
export function useAiAvailable(): boolean {
  const status = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api<AiStatus>('/ai/status'),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return status.data?.available === true;
}
