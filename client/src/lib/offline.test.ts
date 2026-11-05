import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  MutationObserver,
  QueryClient,
  QueryObserver,
  onlineManager,
} from "@tanstack/react-query";
import { createKillIntent, killAgeMs } from "./killIntent";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("when the browser reports it is offline", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
    client.mount();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    client.unmount();
  });

  it("pauses a kill instead of failing it, then sends it once when back online", async () => {
    let sent = 0;
    const observer = new MutationObserver(client, {
      mutationFn: async () => {
        sent++;
        return "ok";
      },
    });

    onlineManager.setOnline(false);
    const result = observer.mutate();
    await sleep(30);

    expect(observer.getCurrentResult()).toMatchObject({
      status: "pending",
      isPaused: true,
    });
    expect(sent).toBe(0);

    onlineManager.setOnline(true);
    await result;

    expect(observer.getCurrentResult().status).toBe("success");
    expect(sent).toBe(1);
  });

  it("keeps the time of the original tap for a kill that waits", async () => {
    const intent = createKillIntent(1, 5, Date.now() - 120_000);
    let reportedAge = -1;
    const observer = new MutationObserver(client, {
      mutationFn: async () => {
        reportedAge = killAgeMs(intent);
        return "ok";
      },
    });

    onlineManager.setOnline(false);
    const result = observer.mutate();
    await sleep(30);
    onlineManager.setOnline(true);
    await result;

    expect(reportedAge).toBeGreaterThanOrEqual(120_030);
    expect(reportedAge).toBeLessThan(125_000);
  });

  it("pauses the tracker poll without raising an error", async () => {
    let requests = 0;
    const observer = new QueryObserver(client, {
      queryKey: ["tracker"],
      queryFn: async () => {
        requests++;
        return [];
      },
    });

    onlineManager.setOnline(false);
    const unsubscribe = observer.subscribe(() => {});
    await sleep(30);

    expect(observer.getCurrentResult()).toMatchObject({
      fetchStatus: "paused",
      isError: false,
    });
    expect(requests).toBe(0);

    onlineManager.setOnline(true);
    await sleep(50);
    unsubscribe();

    expect(requests).toBe(1);
  });

  it("fails normally when only the server is down and the browser is online", async () => {
    const observer = new MutationObserver(client, {
      retry: false,
      mutationFn: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await observer.mutate().catch(() => undefined);

    expect(observer.getCurrentResult()).toMatchObject({
      status: "error",
      isPaused: false,
    });
  });
});
