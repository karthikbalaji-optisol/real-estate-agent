interface ImapProviderConfig {
  host: string;
  oauthHost?: string; // Different host for OAuth-authenticated connections
  sentFolder: string;
}

const PROVIDERS: Record<string, ImapProviderConfig> = {
  google:  { host: 'imap.gmail.com',          sentFolder: '[Gmail]/Sent Mail' },
  outlook: { host: 'imap-mail.outlook.com',   oauthHost: 'outlook.office365.com', sentFolder: 'Sent' },
  yahoo:   { host: 'imap.mail.yahoo.com',     sentFolder: 'Sent' },
};

export function getImapHost(provider: string, authMethod = 'password'): string | undefined {
  const cfg = PROVIDERS[provider];
  if (!cfg) return undefined;
  return authMethod === 'oauth' && cfg.oauthHost ? cfg.oauthHost : cfg.host;
}

export function getSentFolder(provider: string): string {
  return PROVIDERS[provider]?.sentFolder ?? 'Sent';
}

export function getMailboxes(provider: string): string[] {
  return ['INBOX', getSentFolder(provider)];
}
