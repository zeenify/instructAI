import axios from 'axios';
import cache from '../utils/cache';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://instructai.test/api',
    headers: {
        'Accept': 'application/json',
        //'Content-Type': 'application/json',
    }
});

// Automatically attach Bearer Token if it exists in localStorage
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Check cache for GET requests only
    // Don't cache specific endpoints that change frequently
    const noCachePatterns = [
        /\/teacher\/classes\/\d+/,  // Don't cache individual class details
    ];
    const shouldNotCache = noCachePatterns.some(pattern => pattern.test(config.url));

    if (config.method === 'get' && !config.bypassCache && !shouldNotCache) {
        const cacheKey = `${config.method}:${config.url}`;
        const cachedData = cache.get(cacheKey);

        if (cachedData) {
            // Return cached data wrapped in a resolved promise
            // This makes it behave like a real axios response
            config.adapter = () => {
                return Promise.resolve({
                    data: cachedData,
                    status: 200,
                    statusText: 'OK (Cached)',
                    headers: {},
                    config: config,
                    request: {}
                });
            };
        }
    }

    return config;
});

// Cache successful GET responses
api.interceptors.response.use(
    (response) => {
        // Don't cache specific endpoints that change frequently
        const noCachePatterns = [
            /\/teacher\/classes\/\d+/,  // Don't cache individual class details
        ];
        const shouldNotCache = noCachePatterns.some(pattern => pattern.test(response.config.url));

        // Only cache GET requests that aren't in the no-cache list
        if (response.config.method === 'get' && !response.config.bypassCache && !shouldNotCache) {
            const cacheKey = `${response.config.method}:${response.config.url}`;
            cache.set(cacheKey, response.data);
        }
        return response;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Helper to invalidate cache when data is modified
export const invalidateCache = (pattern) => {
    cache.invalidatePattern(pattern);
};

export default api;