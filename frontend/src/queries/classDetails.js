import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Class page data — see docs/data-layer-plan.md.
 * Strict 1 class = 1 course: the page treats the first course (order_index)
 * as THE class content; the course itself is fetched separately for modules.
 */

export const classDetailsKey = (classId) => ['class', Number(classId)];
export const courseContentKey = (courseId) => ['course', Number(courseId), 'content'];

/** Class info: name, code, color, courses, students (with profiles), counts. */
export function useClassDetails(classId, options = {}) {
    return useQuery({
        queryKey: classDetailsKey(classId),
        enabled: Boolean(classId),
        staleTime: 60 * 1000,
        queryFn: async () => {
            const res = await api.get(`/teacher/classes/${classId}`);
            return res.data;
        },
        ...options,
    });
}

/** The single course's modules with their lessons and quizzes. */
export function useCourseContent(courseId, options = {}) {
    return useQuery({
        queryKey: courseContentKey(courseId),
        enabled: Boolean(courseId),
        staleTime: 30 * 1000,
        queryFn: async () => {
            const res = await api.get(`/teacher/courses/${courseId}`);
            return res.data;
        },
        ...options,
    });
}
