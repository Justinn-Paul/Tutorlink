export async function authedFetch(
  getIdToken: () => Promise<string | null>,
  input: string,
  init?: RequestInit
): Promise<Response> {
  const idToken = await getIdToken();
  if (!idToken) {
    throw new Error("Session expired. Please log in again.");
  }

  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", `Bearer ${idToken}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
