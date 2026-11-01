import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBosses,
  fetchTracker,
  logKill,
  logMaintenanceReset,
  voidKill,
} from "./api";
import { killAgeMs } from "./killIntent";
import type { KillIntent } from "./killIntent";
import { retryDelayMs, shouldRetryWrite } from "./retry";
import { loadCachedTracker, saveCachedTracker } from "./trackerCache";

const POLL_INTERVAL_MS = 20_000;

export function useTracker() {
  // The last saved tracker (if recent) shows instantly on refresh while the
  // real request runs, instead of a blank "Loading tracker..." screen.
  const [cached] = useState(() => loadCachedTracker());

  const query = useQuery({
    queryKey: ["tracker"],
    queryFn: fetchTracker,
    refetchInterval: POLL_INTERVAL_MS,
    ...(cached
      ? { initialData: cached.entries, initialDataUpdatedAt: cached.savedAt }
      : {}),
  });

  const { data, dataUpdatedAt } = query;
  useEffect(() => {
    if (data && dataUpdatedAt > 0) saveCachedTracker(data, dataUpdatedAt);
  }, [data, dataUpdatedAt]);

  return query;
}

export function useBosses() {
  return useQuery({
    queryKey: ["bosses"],
    queryFn: fetchBosses,
    staleTime: Infinity,
  });
}

export interface LogKillVariables {
  intent: KillIntent;
  force: boolean;
}

export function useLogKill() {
  const queryClient = useQueryClient();
  return useMutation({
    // The age is computed on every attempt, so a retry or a late confirmation
    // still reports how long ago the user really tapped.
    mutationFn: ({ intent, force }: LogKillVariables) =>
      logKill({
        bossId: intent.bossId,
        channel: intent.channel,
        force,
        requestId: intent.requestId,
        killedAgoMs: killAgeMs(intent),
      }),
    retry: shouldRetryWrite,
    retryDelay: retryDelayMs,
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
