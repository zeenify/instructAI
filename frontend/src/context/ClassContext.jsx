import { createContext, useContext, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTeacherOverview, TEACHER_OVERVIEW_KEY } from '../queries/teacherClasses';
import { useAuth } from './AuthContext';

/**
 * Single source of truth for the teacher's classes.
 *
 * Thin shell over the `useTeacherOverview()` TanStack Query — the data lives
 * in the shared query cache above the routes, so it survives navigation and
 * every surface (sidebar, overview cards, future pages) re-renders together.
 * refreshClasses() is a background revalidation: it never blanks a page.
 * See docs/data-layer-plan.md.
 */
const ClassContext = createContext();

export const ClassProvider = ({ children }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const isTeacher = Boolean(user && user.role === 'teacher');

    const { data, isLoading, refetch } = useTeacherOverview({ enabled: isTeacher });

    const classes = isTeacher ? data?.classes ?? [] : [];
    const totals = isTeacher
        ? data?.totals ?? { classes_count: 0, students_count: 0 }
        : { classes_count: 0, students_count: 0 };

    // True only for the genuine first load — background refetches never
    // flip this, so pages never flash a spinner over existing content.
    const loading = isTeacher && isLoading && classes.length === 0;

    const refreshClasses = useCallback(async () => {
        await refetch();
    }, [refetch]);

    // Instant, local-only update for one class (e.g. optimistic color changes).
    // Updates every surface at once; callers roll it back on API failure.
    const patchClass = useCallback(
        (id, patch) => {
            queryClient.setQueryData(TEACHER_OVERVIEW_KEY, (prev) =>
                prev
                    ? { ...prev, classes: prev.classes.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
                    : prev,
            );
        },
        [queryClient],
    );

    const value = useMemo(
        () => ({ classes, totals, loading, refreshClasses, patchClass }),
        [classes, totals, loading, refreshClasses, patchClass],
    );

    return <ClassContext.Provider value={value}>{children}</ClassContext.Provider>;
};

export const useClasses = () => useContext(ClassContext);
