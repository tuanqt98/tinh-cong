import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';

export function useApiQuery<T>(key: readonly unknown[], path: string) {
  return useQuery({ queryKey: key, queryFn: () => api<T>(path), retry: 1 });
}
