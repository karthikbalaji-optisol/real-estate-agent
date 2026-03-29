interface ImapProviderConfig {
  host: string;
  sentFolder: string;
}

const PROVIDERS: Record<string, ImapProviderConfig> = {
  google:  { host: 'imap.gmail.com',          sentFolder: '[Gmail]/Sent Mail' },
  outlook: { host: 'imap-mail.outlook.com',   sentFolder: 'Sent' },
  yahoo:   { host: 'imap.mail.yahoo.com',     sentFolder: 'Sent' },
};

export function getImapHost(provider: string): string | undefined {
  return PROVIDERS[provider]?.host;
}

export function getSentFolder(provider: string): string {
  return PROVIDERS[provider]?.sentFolder ?? 'Sent';
}

export function getMailboxes(provider: string): string[] {
  return ['INBOX', getSentFolder(provider)];
}
