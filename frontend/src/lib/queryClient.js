import { QueryClient } from '@tanstack/react-query';

/**
 * The app's shared query cache — in its own module so anything can import it
 * without circular dependency risk (main.jsx, contexts, pages, query hooks).
 * See docs/data-layer-plan.md.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});
