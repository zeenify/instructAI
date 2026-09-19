import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Quiz editor data — same pattern as useLesson (see queries/classDetails.js).
 */

export const quizKey = (quizId) => ['quiz', Number(quizId)];

export function useQuiz(quizId, options = {}) {
    return useQuery({
        queryKey: quizKey(quizId),
        enabled: Boolean(quizId),
        staleTime: 0,
        queryFn: async () => {
            // bypassCache: an editor must never start from the legacy layer's
            // 5-minute-old copy (same rule as useLesson / CourseBuilder).
            const res = await api.get(`/teacher/quizzes/${quizId}`, { bypassCache: true });
            return res.data;
        },
        ...options,
    });
}
