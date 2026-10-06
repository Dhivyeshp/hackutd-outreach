interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Call a SPARK API route and unwrap the {success,data,error} envelope. Throws on failure. */
export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body ? 'POST' : 'GET'),
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }
  if (!res.ok || !json.success) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json.data as T;
}
