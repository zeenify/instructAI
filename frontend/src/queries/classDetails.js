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
            // bypassCache: invalidation refetches must not be served by the
            // legacy axios layer — the classwork-count badge stayed 5 minutes
            // stale without this (same rule as every other query hook).
            const res = await api.get(`/teacher/classes/${classId}`, { bypassCache: true });
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
            const res = await api.get(`/teacher/courses/${courseId}`, { bypassCache: true });
            return res.data;
        },
        ...options,
    });
}

export const lessonKey = (lessonId) => ['lesson', Number(lessonId)];

/** One lesson with its full content blocks — the lesson editor's payload. */
export function useLesson(lessonId, options = {}) {
    return useQuery({
        queryKey: lessonKey(lessonId),
        enabled: Boolean(lessonId),
        staleTime: 0,
        queryFn: async () => {
            // bypassCache: the legacy axios layer would otherwise hand back a
            // 5-minute-old copy. An editor must never start from stale content
            // (same rule as CourseBuilder's fetchCourse).
            const res = await api.get(`/teacher/lessons/${lessonId}`, { bypassCache: true });
            return res.data;
        },
        ...options,
    });
}
