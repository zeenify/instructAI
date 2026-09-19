import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { classDetailsKey } from './classDetails';

/**
 * Classwork tab data (activities list + gradebook) — see docs/data-layer-plan.md.
 * The list polls while the tab is mounted so LIVE / Closed states stay fresh
 * (this replaces the old hand-rolled 15s setInterval).
 */

export const classActivitiesKey = (classId) => ['class', Number(classId), 'activities'];
export const classGradebookKey = (classId) => ['class', Number(classId), 'gradebook'];

export function invalidateClasswork(queryClient, classId) {
    queryClient.invalidateQueries({ queryKey: classActivitiesKey(classId) });
    // the class hero shows a classwork count — keep it honest too
    queryClient.invalidateQueries({ queryKey: classDetailsKey(classId) });
}

/** All classwork items (activities + quizzes) of one class. */
export function useClassActivities(classId, options = {}) {
    return useQuery({
        queryKey: classActivitiesKey(classId),
        enabled: Boolean(classId),
        staleTime: 10 * 1000,
        refetchInterval: 15 * 1000,
        queryFn: async () => {
            // bypassCache: this list exists to show live states — the legacy
            // axios layer's 5-minute copy would make every poll a no-op
            const res = await api.get(`/teacher/classes/${classId}/activities`, { bypassCache: true });
            return res.data;
        },
        ...options,
    });
}

/** Gradebook — only fetched while the Gradebook sub-tab is open. */
export function useClassGradebook(classId, options = {}) {
    return useQuery({
        queryKey: classGradebookKey(classId),
        enabled: Boolean(classId),
        staleTime: 30 * 1000,
        queryFn: async () => {
            const res = await api.get(`/teacher/classes/${classId}/gradebook`, { bypassCache: true });
            return res.data;
        },
        ...options,
    });
}

export function useCreateActivity(classId) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload) => {
            const res = await api.post(`/teacher/classes/${classId}/activities`, payload);
            return res.data;
        },
        onSuccess: () => invalidateClasswork(queryClient, classId),
    });
}

export function useDeleteActivity(classId) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
            await api.delete(`/teacher/activities/${id}`);
        },
        onSuccess: () => invalidateClasswork(queryClient, classId),
    });
}
