import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Student data hooks — see docs/data-layer-plan.md.
 * Rules: pages consume these instead of private useEffect fetches; loading UI
 * only when no cached data exists; the classwork poll keeps live quizzes fresh.
 */

export const studentClassKey = (id) => ['student', 'class', Number(id)];
export const studentActivitiesKey = (id) => ['student', 'activities', Number(id)];

/** Class + the single course's full published content (1:1) + per-lesson completion. */
export function useStudentClass(id, options = {}) {
    return useQuery({
        queryKey: studentClassKey(id),
        enabled: Boolean(id),
        staleTime: 60 * 1000,
        // Returning students paint the last-known class instantly; the fetch confirms.
        initialData: readCache(`sv:class:${id}`) ?? undefined,
        // The seed MUST be born stale — otherwise it counts as fresh data and
        // the real fetch never runs, freezing a just-published class on the
        // seed's (possibly empty) snapshot indefinitely.
        initialDataUpdatedAt: readCache(`sv:class:${id}`) ? 0 : undefined,
        queryFn: async () => {
            // bypassCache: the seed paints yesterday's snapshot, and the legacy
            // axios cache then re-served it — a just-published class stayed
            // "No lessons yet" across reloads for 5+ minutes. The refetch must
            // always hit the network; the seed is only the instant paint.
            const res = await api.get(`/student/classes/${id}`, { bypassCache: true });
            writeCache(`sv:class:${id}`, res.data);
            return res.data;
        },
        ...options,
    });
}

function readCache(key) {
    try {
        const raw = sessionStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && parsed.courses ? parsed : null;
    } catch { return null; }
}

function writeCache(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify(data)); } catch {}
}

/** Classwork for the class. Polls while mounted so live quizzes appear promptly. */
export function useStudentActivities(id, { poll = false } = {}, options = {}) {
    return useQuery({
        queryKey: studentActivitiesKey(id),
        enabled: Boolean(id),
        staleTime: 15 * 1000,
        refetchInterval: poll ? 15_000 : false,
        initialData: readCache(`sv:activities:${id}`) ?? undefined,
        queryFn: async () => {
            // bypassCache: polls must never be served a 5-minute-old copy
            // (same rule as queries/classwork.js).
            const res = await api.get(`/student/classes/${id}/activities`, { bypassCache: true });
            writeCache(`sv:activities:${id}`, res.data);
            return res.data;
        },
        ...options,
    });
}
