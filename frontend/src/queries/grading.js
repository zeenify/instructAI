import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export const gradingQueueKey = ['grading-queue'];

/** Every submitted-but-ungraded submission across the teacher's classes —
 * powers the sidebar "To grade" badge and the grading inbox page. */
export function useGradingQueue(options = {}) {
    return useQuery({
        queryKey: gradingQueueKey,
        staleTime: 20 * 1000,
        refetchInterval: 60 * 1000,
        queryFn: async () => {
            // bypassCache: the badge must never show a 5-minute-old count
            const res = await api.get('/teacher/grading-queue', { bypassCache: true });
            return res.data;
        },
        ...options,
    });
}
