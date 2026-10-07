interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/** Error from a SPARK API call. `code` is a stable identifier like E_VALIDATION; it is also appended to the message shown on screen. */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(`${message} [${code}]`);
  }
}

/** Call a SPARK API route and unwrap the {success,data,error} envelope. Throws ApiError on failure. */
export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? (init?.body ? 'POST' : 'GET'),
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    // fetch only throws when the request never got an answer (server down, offline, blocked).
    throw new ApiError("Can't reach the server. Check your connection or that the app is running", 'E_NETWORK', 0);
  }
  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(`Unexpected response from the server (HTTP ${res.status})`, 'E_BAD_RESPONSE', res.status);
  }
  if (!res.ok || !json.success) {
    throw new ApiError(json.error ?? `Request failed (HTTP ${res.status})`, json.code ?? `E_HTTP_${res.status}`, res.status);
  }
  return json.data as T;
}
