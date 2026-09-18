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
        queryFn: async () => {
            const res = await api.get(`/student/classes/${id}`);
            return res.data;
        },
        ...options,
    });
}

/** Classwork for the class. Polls while mounted so live quizzes appear promptly. */
export function useStudentActivities(id, { poll = false } = {}, options = {}) {
    return useQuery({
        queryKey: studentActivitiesKey(id),
        enabled: Boolean(id),
        staleTime: 15 * 1000,
        refetchInterval: poll ? 15_000 : false,
        queryFn: async () => {
            const res = await api.get(`/student/classes/${id}/activities`);
            return res.data;
        },
        ...options,
    });
}
