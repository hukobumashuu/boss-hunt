import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchBosses, fetchTracker, logKill } from './api';

/** Polling, not WebSockets - a countdown doesn't need true real-time,
 * and this matches the plan's original call to avoid infra this small
 * a project doesn't need. */
const POLL_INTERVAL_MS = 20_000;

export function useTracker() {
  return useQuery({
    queryKey: ['tracker'],
    queryFn: fetchTracker,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useBosses() {
  return useQuery({
    queryKey: ['bosses'],
    queryFn: fetchBosses,
    staleTime: Infinity, // static reference data, ~5 rows, rarely changes
  });
}

export function useLogKill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logKill,
    onSuccess: () => {
      // Refetch immediately rather than wait for the next poll tick -
      // the person just tapped the button, they expect the row to
      // update now, not in up to 20 more seconds.
      void queryClient.invalidateQueries({ queryKey: ['tracker'] });
    },
  });
}
