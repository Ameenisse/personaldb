import type { Person } from "./person";
import type { ParsedPerson } from "./parsePersonText";

// Public deployment URL only. No PIN, Google credentials, or tokens belong here.
export const GOOGLE_APPS_SCRIPT_URL = (import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || "").trim();
export const isApiConfigured = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(GOOGLE_APPS_SCRIPT_URL);
export const SESSION_KEY = "person-registry-session";
export const SESSION_EXPIRED_EVENT = "registry-session-expired";
export interface RegistrySession { token: string; expiresAt: number }
export class ApiError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

export function storedSession(): RegistrySession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    return value && typeof value.token === "string" && value.expiresAt > Date.now() ? value : null;
  } catch { return null; }
}

export async function request<T>(action: string, payload: Record<string, unknown> = {}, token?: string): Promise<T> {
  if (!isApiConfigured) throw new ApiError("Complete the Google Apps Script setup first.", "SETUP_REQUIRED");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90000);
  try {
    // text/plain is a CORS-safelisted content type: Apps Script has no OPTIONS handler.
    // ContentService redirects are followed; never use no-cors (it hides the response).
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload, token: token ?? storedSession()?.token }),
      redirect: "follow", credentials: "omit", signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(`Google Apps Script returned ${response.status}. Check the deployment access.`, "HTTP_ERROR");
    let result;
    try { result = await response.json(); }
    catch { throw new ApiError("The API did not return JSON. Deploy as owner with access set to Anyone and use the /exec URL.", "INVALID_RESPONSE"); }
    if (!result.ok) {
      if (result.error?.code === "UNAUTHORIZED") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      throw new ApiError(result.error?.message || "The request could not be completed.", result.error?.code || "API_ERROR");
    }
    return result.data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError("The request timed out. A save may have completed; retry with the same ID to update safely.", "TIMEOUT");
    throw new ApiError("Could not reach Google Apps Script. Check your connection and Web App deployment access.", "NETWORK_ERROR");
  } finally { window.clearTimeout(timeout); }
}

export const api = {
  login: (pin: string) => request<RegistrySession>("login", { pin }),
  logout: (token: string) => request("logout", {}, token),
  list: () => request<Person[]>("listPersons"),
  get: (idNo: string) => request<Person | null>("getPerson", { idNo }),
  save: (person: ParsedPerson, recordId?: string, photo?: string) => request<{ person: Person; created: boolean; warning?: string }>("savePerson", { person, recordId, photo }),
  photo: (recordId: string) => request<{ dataUrl: string }>("getPhoto", { recordId }),
};