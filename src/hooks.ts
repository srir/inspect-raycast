import { showFailureToast, useCachedPromise } from "@raycast/utils";
import { useEffect, useMemo } from "react";
import { getMessages, getSession, listModels, listRepositories } from "./api";
import { Repository, Session } from "./types";
import { isActive } from "./utils";

export const DEFAULT_VARIANTS = ["low", "medium", "high", "xhigh", "max"];

/** Repositories split into Inspect's suggestions (first) and everything else (alphabetical). */
export function useRepositories() {
  const { data, isLoading } = useCachedPromise(listRepositories, [], {
    onError: (e) => {
      showFailureToast(e, { title: "Couldn't load repositories" });
    },
  });
  const grouped = useMemo(() => {
    const all = data?.data ?? [];
    const suggestedIds = data?.meta?.suggested ?? [];
    const byId = new Map(all.map((r) => [r.id, r]));
    const suggested = suggestedIds.map((id) => byId.get(id)).filter((r): r is Repository => !!r);
    const others = all.filter((r) => !suggestedIds.includes(r.id)).sort((a, b) => a.name.localeCompare(b.name));
    return { all, suggested, others, loaded: !!data };
  }, [data]);
  return { ...grouped, isLoading };
}

export function useModels() {
  const { data, isLoading } = useCachedPromise(listModels, [], {
    onError: () => undefined, // optional: the server default model is fine
  });
  return { models: (data ?? []).filter((m) => m.visibility !== "hidden"), isLoading };
}

export function repoLabel(r: Repository) {
  return r.organization ? `${r.organization}/${r.name}` : r.name;
}

/** A session plus its transcript, polled while the agent is working. */
export function useLiveSession(initial: Session, pollMs = 5000) {
  const { data, isLoading, revalidate } = useCachedPromise(
    async (id: string) => {
      const [session, messages] = await Promise.all([getSession(id), getMessages(id)]);
      return { session, messages };
    },
    [initial.id],
    { keepPreviousData: true },
  );
  const session = data?.session ?? initial;
  const active = isActive(session);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(revalidate, pollMs);
    return () => clearInterval(t);
  }, [active, revalidate, pollMs]);

  return { session, messages: data?.messages, isLoading, revalidate };
}
