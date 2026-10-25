
import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

const baseURL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

let refreshPromise: Promise<string> | null = null;

function clearSessionAndRedirect() {
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('refresh_token');

  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Attach the current access token to API requests.
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('access_token');

      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Refresh expired access tokens and retry the original request.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest =
      error.config as InternalAxiosRequestConfig | undefined;

    const requestUrl = originalRequest?.url ?? '';

    // Do not refresh for login or refresh endpoint failures.
    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    if (typeof window === 'undefined') {
      return Promise.reject(error);
    }

    const refreshToken = sessionStorage.getItem('refresh_token');

    if (!refreshToken) {
      clearSessionAndRedirect();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      // Share one refresh request if multiple API calls fail together.
      if (!refreshPromise) {
        refreshPromise = axios
          .post<RefreshResponse>(
            `${baseURL}/auth/refresh`,
            { refreshToken },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
          .then(({ data }) => {
            if (!data.access_token || !data.refresh_token) {
              throw new Error('Invalid refresh response');
            }

            sessionStorage.setItem(
              'access_token',
              data.access_token,
            );

            sessionStorage.setItem(
              'refresh_token',
              data.refresh_token,
            );

            return data.access_token;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newAccessToken = await refreshPromise;

      originalRequest.headers.set(
        'Authorization',
        `Bearer ${newAccessToken}`,
      );

      // Retry the original request with the new access token.
      return api(originalRequest);
    } catch (refreshError) {
      clearSessionAndRedirect();
      return Promise.reject(refreshError);
    }
  },
);

export default api;
