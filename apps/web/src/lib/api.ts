export type User = { id: string; name: string; email: string; role: 'CANDIDATE' | 'RECRUITER'; skills: string[] };
export type Session = { token: string; user: User };
export type Job = { id: string; title: string; description: string; location: string; requiredSkills: string[]; deadline: string };
export type Application = { id: string; status: 'APPLIED' | 'SHORTLISTED' | 'REJECTED'; matchScore: number; coverNote: string; createdAt: string; job?: Job; candidate?: User };
export type Notification = { id: string; message: string; createdAt: string };
const configured = import.meta.env.VITE_API_URL?.trim();
const base = (!configured || /your-api\.example\.com/i.test(configured) ? (import.meta.env.DEV ? 'http://localhost:4000/api' : '/api') : configured).replace(/\/+$/, '');
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  const body = await response.json().catch(() => null);
  if (response.status === 401 && token) window.dispatchEvent(new Event('kc-session-expired'));
  if (!response.ok) throw new ApiError(body?.error?.message ?? 'Request failed. Please try again.', response.status);
  if (body === null) throw new Error('The server returned an invalid response.');
  return body as T;
}
export const skillsFromText = (text: string) => text.split(',').map(s => s.trim()).filter(Boolean);
