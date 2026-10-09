/** Minimal Dataverse Web API client (OAuth2 client-credentials, no SDK). */
export interface DataverseCreds {
  url: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export class DataverseError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

type FetchLike = typeof fetch;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class DataverseClient {
  private token?: { value: string; expiresAt: number };
  private tokenInflight?: Promise<string>;

  constructor(
    private creds: DataverseCreds,
    private fetchImpl: FetchLike = fetch,
  ) {}

  private get api() {
    return `${this.creds.url}/api/data/v9.2`;
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt - 60_000 > Date.now()) return this.token.value;
    this.tokenInflight ??= this.fetchToken().finally(() => (this.tokenInflight = undefined));
    return this.tokenInflight;
  }

  private async fetchToken(): Promise<string> {
    const res = await this.fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(this.creds.tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.creds.clientId,
        client_secret: this.creds.clientSecret,
        scope: `${this.creds.url}/.default`,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !json.access_token) {
      throw new DataverseError(res.status, `Azure AD token request failed: ${json.error_description ?? res.statusText}`);
    }
    this.token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return json.access_token;
  }

  private async send(method: string, url: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${await this.getToken()}`,
          Accept: 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          ...(body !== undefined ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
          ...extraHeaders,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if ((res.status === 429 || res.status === 503) && attempt < 3) {
        const retryAfter = Number(res.headers.get('Retry-After')) || 2 ** attempt;
        await sleep(Math.min(retryAfter, 30) * 1000);
        continue;
      }
      if (res.status === 401 && attempt === 0) {
        this.token = undefined; // force refresh once
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let parsed: unknown = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          /* keep text */
        }
        const msg = (parsed as { error?: { message?: string } })?.error?.message ?? res.statusText;
        throw new DataverseError(res.status, `Dataverse ${method} failed (${res.status}): ${msg}`, parsed);
      }
      return res;
    }
  }

  /** GET a collection, following @odata.nextLink. `query` is a raw OData query string without the leading '?'. */
  async list<T>(entitySet: string, query: string): Promise<T[]> {
    const out: T[] = [];
    let url: string | undefined = `${this.api}/${entitySet}?${query}`;
    while (url) {
      const res: Response = await this.send('GET', url);
      const json = (await res.json()) as { value: T[]; '@odata.nextLink'?: string };
      out.push(...json.value);
      url = json['@odata.nextLink'];
    }
    return out;
  }

  async get<T>(entitySet: string, id: string, query = ''): Promise<T | null> {
    try {
      const res = await this.send('GET', `${this.api}/${entitySet}(${id})${query ? `?${query}` : ''}`);
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof DataverseError && e.status === 404) return null;
      throw e;
    }
  }

  async create<T>(entitySet: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.send('POST', `${this.api}/${entitySet}`, body, { Prefer: 'return=representation' });
    return (await res.json()) as T;
  }

  async update<T>(entitySet: string, id: string, body: Record<string, unknown>, ifMatch = '*'): Promise<T> {
    const res = await this.send('PATCH', `${this.api}/${entitySet}(${id})`, body, {
      Prefer: 'return=representation',
      'If-Match': ifMatch, // '*' = update only, never upsert; an etag = optimistic concurrency
    });
    return (await res.json()) as T;
  }

  async remove(entitySet: string, id: string): Promise<void> {
    try {
      await this.send('DELETE', `${this.api}/${entitySet}(${id})`);
    } catch (e) {
      if (e instanceof DataverseError && e.status === 404) return;
      throw e;
    }
  }
}
