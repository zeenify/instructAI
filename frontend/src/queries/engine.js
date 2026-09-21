import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Which languages the execution engine can actually run. The engine probes
 * its own toolchain (g++/javac/python) and answers per language; a dev box
 * without a compiler reports that language unavailable, and the builders
 * disable it instead of letting teachers build exercises that never execute.
 */
export const engineLanguagesKey = ['engine-languages'];

export function useEngineLanguages(options = {}) {
    return useQuery({
        queryKey: engineLanguagesKey,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const res = await api.get('/teacher/engine-languages', { bypassCache: true });
            return res.data;
        },
        ...options,
    });
}

/** id → true when the engine can run it (preview-only languages always can). */
export function availabilityMap(data) {
    const map = {};
    for (const l of data?.languages || []) {
        map[l.id] = l.available || l.preview_only;
    }
    return map;
}
