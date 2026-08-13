const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Endpoint auth sendiri dikecualikan supaya gagal login/logout tidak memicu redirect loop.
const isAuthPath = (path: string) => path.startsWith('/auth/');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include', // wajib supaya cookie httpOnly ikut terkirim
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401 && typeof window !== 'undefined' && !isAuthPath(path)) {
    // Sesi kadaluarsa/tidak valid: bersihkan cookie di server lalu balik ke login
    // otomatis, biar tidak nyangkut di halaman yang gagal fetch selamanya.
    fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).finally(() => {
      window.location.href = '/login';
    });
    throw new ApiError('Sesi berakhir, mengarahkan ke login...', 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message || `Request gagal (${res.status})`, res.status);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { API_URL, ApiError };
