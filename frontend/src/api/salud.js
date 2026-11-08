import { useQuery } from '@tanstack/react-query';
import { pedir } from './cliente.js';

export function useSalud() {
  return useQuery({
    queryKey: ['salud'],
    queryFn: () => pedir('/salud'),
    refetchInterval: 30_000,
  });
}
