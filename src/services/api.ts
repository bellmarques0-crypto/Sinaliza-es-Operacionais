import {
  UserSession,
  DashboardMetrics,
  Sinalizacao,
  Usuario,
  Supervisor,
  Operador,
  Produto,
  Motivo,
  ConfiguracaoApi
} from '../types';

const TOKEN_KEY = 'sinalizacoes_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If not FormData, default to JSON
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      if (endpoint !== '/api/auth/login') {
        removeStoredToken();
      }
    }
    throw new Error(data.error || data.message || `Erro HTTP ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: async (login: string, senha: string): Promise<UserSession> => {
    const res = await request<UserSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, senha })
    });
    if (res.token) setStoredToken(res.token);
    return res;
  },

  getMe: async (): Promise<UserSession> => {
    return request<UserSession>('/api/auth/me');
  },

  logout: () => {
    removeStoredToken();
  },

  // Dashboard
  getDashboard: async (filters: Record<string, string>): Promise<DashboardMetrics> => {
    const query = new URLSearchParams(filters).toString();
    return request<DashboardMetrics>(`/api/dashboard?${query}`);
  },

  // Sinalizações
  getSinalizacoes: async (filters: Record<string, string> = {}): Promise<Sinalizacao[]> => {
    const query = new URLSearchParams(filters).toString();
    return request<Sinalizacao[]>(`/api/sinalizacoes?${query}`);
  },

  createSinalizacao: async (formData: FormData): Promise<{ message: string; data: Sinalizacao }> => {
    return request<{ message: string; data: Sinalizacao }>('/api/sinalizacoes', {
      method: 'POST',
      body: formData
    });
  },

  deleteSinalizacao: async (id: number): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>(`/api/sinalizacoes/${id}`, {
      method: 'DELETE'
    });
  },

  confirmarSinalizacao: async (id: number): Promise<{ message: string; data: Sinalizacao }> => {
    return request<{ message: string; data: Sinalizacao }>(`/api/sinalizacoes/${id}/confirmar`, {
      method: 'PUT'
    });
  },

  // Usuários
  getUsuarios: async (): Promise<Usuario[]> => {
    return request<Usuario[]>('/api/usuarios');
  },

  createUsuario: async (data: Partial<Usuario>): Promise<Usuario> => {
    return request<Usuario>('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateUsuario: async (id: number, data: Partial<Usuario>): Promise<Usuario> => {
    return request<Usuario>(`/api/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  resetPasswordUsuario: async (id: number, novaSenha: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/api/usuarios/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ novaSenha })
    });
  },

  deleteUsuario: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/api/usuarios/${id}`, {
      method: 'DELETE'
    });
  },

  // Supervisores
  getSupervisores: async (): Promise<Supervisor[]> => {
    return request<Supervisor[]>('/api/supervisores');
  },

  createSupervisor: async (data: Partial<Supervisor>): Promise<Supervisor> => {
    return request<Supervisor>('/api/supervisores', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateSupervisor: async (id: number, data: Partial<Supervisor>): Promise<Supervisor> => {
    return request<Supervisor>(`/api/supervisores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteSupervisor: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/api/supervisores/${id}`, {
      method: 'DELETE'
    });
  },

  // Operadores
  getOperadores: async (): Promise<Operador[]> => {
    return request<Operador[]>('/api/operadores');
  },

  // Produtos
  getProdutos: async (): Promise<Produto[]> => {
    return request<Produto[]>('/api/produtos');
  },

  createProduto: async (nome: string): Promise<Produto> => {
    return request<Produto>('/api/produtos', {
      method: 'POST',
      body: JSON.stringify({ nome })
    });
  },

  updateProduto: async (id: number, nome: string): Promise<Produto> => {
    return request<Produto>(`/api/produtos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ nome })
    });
  },

  deleteProduto: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/api/produtos/${id}`, {
      method: 'DELETE'
    });
  },

  // Motivos
  getMotivos: async (): Promise<Motivo[]> => {
    return request<Motivo[]>('/api/motivos');
  },

  createMotivo: async (descricao: string): Promise<Motivo> => {
    return request<Motivo>('/api/motivos', {
      method: 'POST',
      body: JSON.stringify({ descricao })
    });
  },

  updateMotivo: async (id: number, descricao: string): Promise<Motivo> => {
    return request<Motivo>(`/api/motivos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ descricao })
    });
  },

  deleteMotivo: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/api/motivos/${id}`, {
      method: 'DELETE'
    });
  },

  // Configuração API
  getConfigApi: async (): Promise<ConfiguracaoApi> => {
    return request<ConfiguracaoApi>('/api/config-api');
  },

  saveConfigApi: async (data: Partial<ConfiguracaoApi>): Promise<{ message: string; data: ConfiguracaoApi }> => {
    return request<{ message: string; data: ConfiguracaoApi }>('/api/config-api', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  testConfigApi: async (url_api: string): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>('/api/config-api/test', {
      method: 'POST',
      body: JSON.stringify({ url_api })
    });
  },

  syncConfigApi: async (): Promise<{ success: boolean; message: string; detalhes: any }> => {
    return request<{ success: boolean; message: string; detalhes: any }>('/api/config-api/sync', {
      method: 'POST'
    });
  }
};
