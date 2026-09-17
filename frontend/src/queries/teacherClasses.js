import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Teacher classes + dashboard totals. The single source of truth consumed by
 * ClassContext — see docs/data-layer-plan.md. 5-min freshness: class lists
 * change rarely, and mutations invalidate by key.
 */
export const TEACHER_OVERVIEW_KEY = ['teacher', 'overview'];

export function useTeacherOverview(options = {}) {
    return useQuery({
        queryKey: TEACHER_OVERVIEW_KEY,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const res = await api.get('/teacher/overview');
            return res.data; // { classes: [...], totals: {...} }
        },
        ...options,
    });
}
