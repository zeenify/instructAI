// Admin panel hooks — one key factory per surface; mutations invalidate the
// whole ['admin'] tree (small shared payloads, no fine-graining needed).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api, { invalidateCache } from '../services/api';

// Admin actions must never fail silently — surface the backend's message.
const reportError = (err, fallback) => toast.error(err?.response?.data?.message || fallback);

export const adminOverviewKey = ['admin', 'overview'];
export const adminUsersKey = (role, q) => ['admin', 'users', role || 'all', (q || '').trim()];
export const adminClassesKey = ['admin', 'classes'];
export const adminSystemKey = ['admin', 'system'];
export const adminWhitelistKey = (kind) => ['admin', 'whitelist', kind];

// bypassCache: the legacy axios 5-min GET cache must be skipped or admin
// panels show yesterday's school. The .data unwrap mirrors the other query
// files (api.get returns a response envelope, pages want the payload).
const get = (url) => api.get(url, { bypassCache: true }).then((res) => res.data);

export function useAdminOverview() {
    return useQuery({
        queryKey: adminOverviewKey,
        queryFn: () => get('/admin/overview'),
        staleTime: 15 * 1000,
    });
}

export function useAdminUsers(role, q) {
    const search = (q || '').trim();
    const params = new URLSearchParams();
    if (role && role !== 'all') params.set('role', role);
    if (search) params.set('q', search);
    return useQuery({
        queryKey: adminUsersKey(role, search),
        queryFn: () => get(`/admin/users${params.toString() ? `?${params}` : ''}`),
        staleTime: 20 * 1000,
        placeholderData: (prev) => prev, // keep the rows while typing
    });
}

export function useAdminClasses() {
    return useQuery({
        queryKey: adminClassesKey,
        queryFn: () => get('/admin/classes'),
        staleTime: 30 * 1000,
    });
}

export function useAdminSystem() {
    return useQuery({
        queryKey: adminSystemKey,
        queryFn: () => get('/admin/system'),
        staleTime: 30 * 1000,
        refetchInterval: 60 * 1000,
    });
}

export function useAdminWhitelist(kind) {
    return useQuery({
        queryKey: adminWhitelistKey(kind),
        queryFn: () => get(`/admin/${kind === 'students' ? 'student-whitelist' : 'teacher-whitelist'}`),
        staleTime: 60 * 1000,
    });
}

export function useSetUserActive() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, active }) => api.post(`/admin/users/${id}/${active ? 'enable' : 'disable'}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
        onError: (e) => reportError(e, 'Could not update the account.'),
    });
}

export function useResetPassword() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.post(`/admin/users/${id}/reset-password`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
        onError: (e) => reportError(e, 'Could not reset the password.'),
    });
}

export function useDeleteUser() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.delete(`/admin/users/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
        onError: (e) => reportError(e, 'Could not delete the account.'),
    });
}

const whitelistUrl = (kind) => `/admin/${kind === 'students' ? 'student-whitelist' : 'teacher-whitelist'}`;

export function useAddWhitelistEntries(kind) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (entries) => api.post(whitelistUrl(kind), { entries }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin'] });
            invalidateCache(`get:${whitelistUrl(kind)}`);
        },
        onError: (e) => reportError(e, 'Could not save the whitelist.'),
    });
}

export function useRemoveWhitelistEntry(kind) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.delete(`${whitelistUrl(kind)}/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminWhitelistKey(kind) });
            invalidateCache(`get:${whitelistUrl(kind)}`);
        },
        onError: (e) => reportError(e, 'Could not remove the entry.'),
    });
}
