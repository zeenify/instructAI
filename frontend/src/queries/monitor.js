import { useQuery } from '@tanstack/react-query';
import { getMonitorStats, getMonitorStudents, getStudentProfile } from '../services/api';

/**
 * Student Monitor data hooks — params are part of every key, so switching
 * class/course/student or sort/filter reads per-combo cache entries instead
 * of refiring the network (fixes the remount waterfall). See
 * docs/data-layer-plan.md.
 */

const monitorKeys = {
    courses: (classId) => ['monitor', 'courses', classId],
    stats: (classId, courseId) => ['monitor', 'stats', classId, courseId],
    students: (classId, courseId, sort, filter) => ['monitor', 'students', classId, courseId, sort, filter],
    profile: (classId, courseId, studentId) => ['monitor', 'profile', classId, courseId, studentId],
};

/** Invalidate every monitor query (call after grading, unenrolling, etc.). */
export const monitorKeysRoot = ['monitor'];

export function useMonitorCourses(classId, options = {}) {
    return useQuery({
        queryKey: monitorKeys.courses(classId),
        enabled: Boolean(classId),
        staleTime: 60 * 1000,
        queryFn: async () => {
            const res = await api.get(`/teacher/classes/${classId}`);
            return res.data?.courses ?? [];
        },
        ...options,
    });
}

export function useMonitorStats(classId, courseId, options = {}) {
    return useQuery({
        queryKey: monitorKeys.stats(classId, courseId),
        enabled: Boolean(classId && courseId),
        staleTime: 30 * 1000,
        queryFn: async () => {
            const res = await getMonitorStats(classId, courseId);
            return res.data;
        },
        ...options,
    });
}

export function useMonitorStudents(classId, courseId, sort = 'progress', filter = 'all', options = {}) {
    return useQuery({
        queryKey: monitorKeys.students(classId, courseId, sort, filter),
        enabled: Boolean(classId && courseId),
        staleTime: 30 * 1000,
        queryFn: async () => {
            const res = await getMonitorStudents(classId, courseId, sort, filter);
            return res.data?.students ?? [];
        },
        ...options,
    });
}

export function useStudentProfile(classId, courseId, studentId, options = {}) {
    return useQuery({
        queryKey: monitorKeys.profile(classId, courseId, studentId),
        enabled: Boolean(classId && courseId && studentId),
        staleTime: 30 * 1000,
        queryFn: async ({ signal }) => {
            const res = await getStudentProfile(classId, courseId, studentId, signal);
            return res.data;
        },
        ...options,
    });
}
