import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProgram, type Program } from "./api/program";
import { activeLists, activeSchedule, decodeToken, getToken, readAll } from "./api/cloud";
import type { CloudReadAllResponse, Id } from "./api/types";

type Async<T> = { data?: T; error?: string; loading: boolean };

export function useProgram(shortName: string, year: number): Async<Program> {
  const [state, setState] = useState<Async<Program>>({ loading: true });
  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });
    fetchProgram(shortName, year)
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((e) => !cancelled && setState({ error: String(e), loading: false }));
    return () => {
      cancelled = true;
    };
  }, [shortName, year]);
  return state;
}

/** Token + données cloud (mon programme / mes listes) si l'utilisateur est connecté. */
export function useCloud(conferenceId?: number) {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [state, setState] = useState<Async<CloudReadAllResponse>>({ loading: false });

  useEffect(() => {
    if (!token) {
      setState({ loading: false });
      return;
    }
    let cancelled = false;
    setState({ loading: true });
    readAll(token)
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((e) => !cancelled && setState({ error: String(e), loading: false }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const user = useMemo(() => (token ? decodeToken(token) : null), [token]);
  const schedule = useMemo(
    () => (state.data ? activeSchedule(state.data, conferenceId) : []),
    [state.data, conferenceId],
  );
  const lists = useMemo(() => (state.data ? activeLists(state.data) : []), [state.data]);
  /** sessionId -> nombre de contenus ajoutés au programme */
  const addedBySession = useMemo(
    () => new Map(schedule.map((s) => [s.sessionId, s.myScheduleContents.length])),
    [schedule],
  );

  return { token, setToken, user, ...state, schedule, lists, addedBySession };
}

export type Cloud = ReturnType<typeof useCloud>;

/** "Mon programme" local : les ajouts faits dans ce prototype sont gardés dans le navigateur. */
export function useLocalSchedule(conferenceId: number) {
  const key = `my-schedule-${conferenceId}`;
  const [ids, setIds] = useState<Set<Id>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      return new Set();
    }
  });
  const toggle = useCallback(
    (id: Id) =>
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(key, JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
        return next;
      }),
    [key],
  );
  return { ids, toggle };
}
