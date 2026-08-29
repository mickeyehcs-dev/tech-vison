export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: any;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('auth_token');
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; meta?: any }> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    const currentToken = this.getToken();
    if (currentToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include'
      });

      // Handle CSV or text responses
      const contentType = response.headers.get('content-type');
      if (contentType && (contentType.includes('text/csv') || contentType.includes('text/plain'))) {
        const textData = await response.text();
        return { data: textData as any };
      }

      let resJson: ApiResponse<T>;
      try {
        resJson = await response.json();
      } catch {
        throw new Error(`Server returned status ${response.status}: ${response.statusText}`);
      }

      if (!response.ok || !resJson.success) {
        // If 401 Unauthorized, clear stored token
        if (response.status === 401) {
          this.setToken(null);
        }
        throw new Error(resJson.error || `HTTP error ${response.status}`);
      }

      return {
        data: resJson.data as T,
        meta: resJson.meta
      };
    } catch (err: any) {
      console.error(`API Request Error [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  }

  get<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: any, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  put<T>(endpoint: string, body?: any, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  patch<T>(endpoint: string, body?: any, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  delete<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
