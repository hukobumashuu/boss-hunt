import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBosses,
  fetchTracker,
  logKill,
  logMaintenanceReset,
  voidKill,
} from "./api";

const POLL_INTERVAL_MS = 20_000;

export function useTracker() {
  return useQuery({
    queryKey: ["tracker"],
    queryFn: fetchTracker,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useBosses() {
  return useQuery({
    queryKey: ["bosses"],
    queryFn: fetchBosses,
    staleTime: Infinity,
  });
}

export function useLogKill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logKill,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tracker"] });
    },
  });
}

export function useVoidKill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: voidKill,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tracker"] });
    },
  });
}

export function useLogMaintenanceReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logMaintenanceReset,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tracker"] });
    },
  });
}
