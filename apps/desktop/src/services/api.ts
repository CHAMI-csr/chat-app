export interface ApiUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: 'online' | 'offline';
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  createdAt: string;
  sender: ApiUser;
  attachments?: Array<{ id: string; fileName: string; mimeType: string | null; fileSize: string }>;
}

export interface ApiConversation {
  id: string;
  type: 'private' | 'group';
  name: string | null;
  members: ApiUser[];
  lastMessage: { content: string | null; createdAt: string; sender: { username: string; displayName: string } } | null;
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function apiRequest<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(`Cannot reach Chaty server at ${API_BASE}. Start the server and try again.`, 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiFile(path: string, token: string): Promise<Blob> {
  let response: Response;
  try { response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } }); }
  catch { throw new ApiError(`Cannot reach Chaty server at ${API_BASE}. Start the server and try again.`, 0); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ApiError(body.error ?? `File request failed (${response.status})`, response.status);
  }
  return response.blob();
}
