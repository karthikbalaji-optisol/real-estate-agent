import type {
  EmailAccount,
  ManualTrigger,
  PaginatedResponse,
  Property,
  PropertyFilters,
  Report,
} from '../types/property';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json();
}

// --- Properties ---

export function fetchProperties(filters: PropertyFilters = {}): Promise<PaginatedResponse> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.location) params.set('location', filters.location);
  if (filters.bhk) params.set('bhk', String(filters.bhk));
  const qs = params.toString();
  return request<PaginatedResponse>(`/properties${qs ? `?${qs}` : ''}`);
}

export function fetchProperty(id: string): Promise<Property> {
  return request<Property>(`/properties/${id}`);
}

// --- Emails ---

export function fetchEmails(): Promise<EmailAccount[]> {
  return request<EmailAccount[]>('/emails');
}

export function createEmail(email: string, appPassword: string, provider: string): Promise<EmailAccount> {
  return request<EmailAccount>('/emails', {
    method: 'POST',
    body: JSON.stringify({ email, appPassword, provider }),
  });
}

export function toggleEmail(id: string, enabled: boolean): Promise<EmailAccount> {
  return request<EmailAccount>(`/emails/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export function deleteEmail(id: string): Promise<void> {
  return request<void>(`/emails/${id}`, { method: 'DELETE' });
}

// --- Scraper / Manual Trigger ---

export function triggerManualCheck(): Promise<ManualTrigger> {
  return request<ManualTrigger>('/scraper/trigger', { method: 'POST' });
}

export function fetchTriggers(): Promise<ManualTrigger[]> {
  return request<ManualTrigger[]>('/scraper/triggers');
}

export function fetchTriggerDetail(requestId: string): Promise<ManualTrigger> {
  return request<ManualTrigger>(`/scraper/triggers/${requestId}`);
}

// --- Reports ---

export function fetchReports(): Promise<Report[]> {
  return request<Report[]>('/reports');
}

export function fetchReport(id: string): Promise<Report> {
  return request<Report>(`/reports/${id}`);
}

export function generateReport(type?: string): Promise<Report> {
  return request<Report>('/reports', {
    method: 'POST',
    body: JSON.stringify({ type: type ?? 'daily' }),
  });
}

export function downloadReport(id: string): void {
  window.open(`${BASE}/reports/${id}/download`, '_blank');
}
