import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Class Progress tab (replaces the old Analytics + Monitor pages) —
 * class-scoped via the 1:1 course. See docs/data-layer-plan.md.
 */

export const monitorStatsKey = (classId, courseId) => ['pulse', Number(classId), Number(courseId), 'stats'];
export const monitorStudentsKey = (classId, courseId) => ['pulse', Number(classId), Number(courseId), 'students'];
export const studentProgressKey = (classId, courseId, studentId) => ['pulse', Number(classId), Number(courseId), 'student', Number(studentId)];

/** Class-wide content stats: completion %, avg quiz score, not-started/stuck counts. */
export function useMonitorStats(classId, courseId, options = {}) {
    return useQuery({
        queryKey: monitorStatsKey(classId, courseId),
        enabled: Boolean(classId) && Boolean(courseId),
        staleTime: 30 * 1000,
        queryFn: async () => {
            const res = await api.get(`/teacher/classes/${classId}/courses/${courseId}/monitor/stats`);
            return res.data;
        },
        ...options,
    });
}

/** Roster with completion %, last active, and flags per student. */
export function useMonitorStudents(classId, courseId, options = {}) {
    return useQuery({
        queryKey: monitorStudentsKey(classId, courseId),
        enabled: Boolean(classId) && Boolean(courseId),
        staleTime: 15 * 1000,
        queryFn: async () => {
            const res = await api.get(`/teacher/classes/${classId}/courses/${courseId}/monitor/students`);
            return res.data?.students || [];
        },
        ...options,
    });
}

/** One student's per-module lesson/quiz standing — fetched when a row expands. */
export function useStudentProgress(classId, courseId, studentId, options = {}) {
    return useQuery({
        queryKey: studentProgressKey(classId, courseId, studentId),
        enabled: Boolean(classId) && Boolean(courseId) && Boolean(studentId),
        staleTime: 30 * 1000,
        queryFn: async () => {
            const res = await api.get(`/teacher/classes/${classId}/courses/${courseId}/monitor/student/${studentId}`);
            return res.data;
        },
        ...options,
    });
}
