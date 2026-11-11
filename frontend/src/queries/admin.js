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
        mutationFn: ({ id, password }) => api.post(`/admin/users/${id}/reset-password`, password ? { password } : {}),
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

// ── Backup & restore ──────────────────────────────────────────────
// Download is an imperative action (blob + anchor); restore is a mutation
// that invalidates the whole admin tree — the entire database may have
// changed underneath every panel.

export async function downloadBackup() {
    const res = await api.get('/admin/backup', { bypassCache: true, responseType: 'blob' });
    const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/json' });
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instructai-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function useRestoreBackup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (file) => {
            const form = new FormData();
            form.append('file', file);
            // No manual Content-Type: axios adds the multipart boundary itself.
            return api.post('/admin/restore', form).then((r) => r.data);
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ['admin'] });
            toast.success(data?.message || 'Backup restored.');
        },
        onError: (e) => reportError(e, 'Could not restore the backup.'),
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

export function useClassesForGraduation(enabled = true) {
    return useQuery({
        queryKey: ['admin', 'classes', 'graduation'],
        // get() bypasses the legacy 5-min axios GET cache — admin panels must
        // never serve a stale class/enrollment list.
        queryFn: () => get('/admin/student-whitelist/classes'),
        staleTime: 30 * 1000,
        placeholderData: (prev) => prev,
        enabled,
    });
}

// Names behind a class-graduate action: the UI shows this roster BEFORE the
// action can be confirmed, so a class is never graduated blind. No
// placeholderData — a preview that can briefly show a stale count after your
// own graduate/re-enroll is worse than a one-second spinner.
export function useClassRoster(classId, enabled = true) {
    return useQuery({
        queryKey: ['admin', 'classes', 'graduation', 'roster', Number(classId)],
        queryFn: () => get(`/admin/student-whitelist/classes/${classId}/students`),
        staleTime: 30 * 1000,
        enabled: enabled && !!classId,
    });
}

export function useGraduateWhitelistEntries(kind) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ actions }) => api.post('/admin/student-whitelist/graduate', actions),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin'] });
            invalidateCache(`get:${whitelistUrl(kind)}`);
        },
        onError: (e) => reportError(e, 'Could not update graduation status.'),
    });
}

export function useReEnrollWhitelistEntries(kind) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ actions }) => api.post('/admin/student-whitelist/re-enroll', actions),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin'] });
            invalidateCache(`get:${whitelistUrl(kind)}`);
        },
        onError: (e) => reportError(e, 'Could not update enrollment status.'),
    });
}
