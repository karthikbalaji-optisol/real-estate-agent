export interface Property {
  id: string;
  url: string;
  bhk?: number;
  bathrooms?: number;
  price?: string;
  plotArea?: string;
  builtUpArea?: string;
  location?: string;
  facing?: string;
  floors?: number;
  sourceEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse {
  data: Property[];
  total: number;
  page: number;
  limit: number;
}

export interface PropertyFilters {
  page?: number;
  limit?: number;
  location?: string;
  bhk?: number;
}

export type EmailProvider = 'google' | 'outlook' | 'yahoo';

export interface EmailAccount {
  id: string;
  email: string;
  maskedPassword: string;
  provider: EmailProvider;
  authMethod: 'password' | 'oauth';
  enabled: boolean;
  isValid: boolean | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface Report {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  content?: string;
}

export interface DashboardStats {
  total: number;
  today: number;
  by_location: { location: string; count: number }[];
  by_bhk: { bhk: number; count: number }[];
}

export interface ManualTriggerLog {
  id: string;
  requestId: string;
  level: string;
  message: string;
  createdAt: string;
}

export interface ManualTrigger {
  requestId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  endedAt: string | null;
  accountsChecked: number;
  emailsFound: number;
  urlsExtracted: number;
  logs?: ManualTriggerLog[];
}
