import { DEFAULT_CURRENCY } from "@uniqbd/types";
import { dedupeKey, dedupeRequest } from "@/lib/request-dedupe";
import {
  DEFAULT_BLOG_PAGE_SETTINGS,
  normalizeBlogPageSettings,
  type BlogPageFeatures,
  type BlogPageSettings,
} from "@/lib/blog-page-settings";
import {
  DEFAULT_WEBSITE_PAGE_SETTINGS,
  normalizeWebsitePageSettings,
  type WebsitePageSettings,
  type WebsitePricingPackage,
} from "@/lib/website-page-settings";
import type { AccentColor, ThemePreference } from "@/lib/theme";
import {
  clearBrowserSession,
  getAccessExpiresAt,
  getAccessToken,
  getSessionMeta,
  hasAuthSession,
  persistBrowserSession,
  setAccessToken,
} from "@/lib/access-token";

export type { BlogPageFeatures, BlogPageSettings };
export type { WebsitePageSettings, WebsitePricingPackage };

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

/** Store upload paths as same-origin `/api/uploads/...` (no remote host). */
function normalizeUploadUrl(url: string): string {
  const trimmed = url.trim().replace(/\/api\/api\//i, "/api/");
  if (!trimmed) return "";
  if (trimmed.startsWith("/api/uploads/")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith("/api/uploads/")) {
        return `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

async function parseUploadUrlJson<T extends { url: string }>(
  res: Response,
): Promise<T> {
  const data = (await res.json()) as T;
  return { ...data, url: normalizeUploadUrl(data.url) };
}

/** Server-side fetches prefer loopback when API runs on the same host. */
function serverApiBase(): string {
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return internal.replace(/\/$/, "");
  return API_BASE.replace(/\/$/, "");
}

function customerPanelConfigUrl(): string {
  const base =
    typeof window === "undefined" ? serverApiBase() : API_BASE.replace(/\/$/, "");
  return `${base}/customer-panel/config`;
}

export interface ProductMedia {
  url: string;
  alt?: string;
}

export interface ProductPricing {
  currency: string;
  basePrice: number;
  compareAt?: number;
}

export interface ProductListItem {
  _id: string;
  title: string;
  slug: string;
  type: string;
  pricing: ProductPricing;
  media: ProductMedia[];
  ratings?: { avg: number; count: number };
  stock?: { available: number };
  deliveryType?: string;
  attributes?: Record<string, unknown>;
  /** Computed by API — true when any package can be purchased. */
  inStock?: boolean;
}

export type ProductPackageInventory = {
  valueId: string;
  available: number;
};

export interface ProductDetail extends ProductListItem {
  description?: string;
  availableRegions?: string[];
  deliveryType?: string;
  inventoryAvailable?: number;
  packageInventory?: ProductPackageInventory[];
  attributes?: Record<string, unknown>;
  categoryId?: string;
  categoryIds?: string[];
  /** SEO fields returned by the API (used for metadata + structured data). */
  sku?: string;
  brandId?: string;
  categoryPath?: string[];
  seo?: Seo;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  parentId?: string;
  isActive?: boolean;
  order?: number;
  productCount?: number;
  seo?: Seo;
  children?: Category[];
}

interface ProductListResponse {
  items: ProductListItem[];
  nextCursor: string | null;
  limit: number;
}

async function safeJsonRaw<T>(url: string, fallback: T, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, options ?? { cache: "no-store" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/** Cached public fetch — revalidates every 60s (Next.js server components only). */
async function safeJsonCached<T>(
  url: string,
  fallback: T,
  revalidate = 60,
  tags?: string[],
): Promise<T> {
  return dedupeRequest(dedupeKey("GET", url), () =>
    safeJsonRaw(url, fallback, {
      next: { revalidate, tags },
    } as RequestInit),
  );
}

async function safeJson<T>(url: string, fallback: T): Promise<T> {
  return dedupeRequest(dedupeKey("GET", url), () => safeJsonRaw(url, fallback));
}

export async function getProducts(
  query: {
    limit?: number;
    search?: string;
    categoryId?: string;
    brandId?: string;
    type?: string;
    sort?: string;
    cursor?: string;
  } = {},
  opts?: { cached?: boolean; revalidate?: number },
): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(query.limit ?? 12));
  if (query.search) params.set("search", query.search);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.brandId) params.set("brandId", query.brandId);
  if (query.type) params.set("type", query.type);
  if (query.sort) params.set("sort", query.sort);
  if (query.cursor) params.set("cursor", query.cursor);
  const url = `${API_BASE}/products?${params.toString()}`;
  const fallback: ProductListResponse = { items: [], nextCursor: null, limit: query.limit ?? 12 };
  if (opts?.cached) return safeJsonCached(url, fallback, opts.revalidate ?? 60);
  return safeJson<ProductListResponse>(url, fallback);
}

export async function getProduct(
  slug: string,
  opts?: { cached?: boolean; revalidate?: number },
): Promise<ProductDetail | null> {
  const url = `${API_BASE}/products/${encodeURIComponent(slug)}`;
  if (opts?.cached) return safeJsonCached<ProductDetail | null>(url, null, opts.revalidate ?? 120);
  return safeJson<ProductDetail | null>(url, null);
}

export interface HomepageSection {
  category: { _id: string; name: string; slug: string; order: number };
  products: ProductListItem[];
}

/**
 * Fetches all homepage category-product sections in a SINGLE request.
 * Replaces the N+1 pattern (1 categories fetch + N product fetches).
 */
export async function getHomepageSections(opts?: {
  limitPerCategory?: number;
  featuredOnly?: boolean;
  cached?: boolean;
  revalidate?: number;
}): Promise<HomepageSection[]> {
  const params = new URLSearchParams();
  if (opts?.limitPerCategory) params.set("limit", String(opts.limitPerCategory));
  if (opts?.featuredOnly === true) params.set("featuredOnly", "true");
  const url = `${API_BASE}/products/homepage-sections?${params.toString()}`;
  const fallback: HomepageSection[] = [];
  if (opts?.cached) return safeJsonCached<HomepageSection[]>(url, fallback, opts.revalidate ?? 60);
  return safeJson<HomepageSection[]>(url, fallback);
}

function normalizeCategoryTree(nodes: Category[]): Category[] {
  return nodes.map((node) => {
    const raw = node as Category & { id?: string };
    const _id = raw._id ?? raw.id ?? "";
    return {
      ...raw,
      _id,
      children: raw.children?.length
        ? normalizeCategoryTree(raw.children)
        : undefined,
    };
  });
}

export async function getCategories(opts?: { cached?: boolean; revalidate?: number }): Promise<Category[]> {
  const url = `${API_BASE}/categories`;
  const data = opts?.cached
    ? await safeJsonCached<Category[]>(url, [], opts.revalidate ?? 300)
    : await safeJson<Category[]>(url, []);
  return normalizeCategoryTree(data);
}

export function adminGetCategories(): Promise<Category[]> {
  return authRequest<Category[]>("/categories/admin/list").then(
    normalizeCategoryTree,
  );
}

/** Flatten a category tree into a single depth-first list of full nodes. */
export function flattenCategoryTree(nodes: Category[]): Category[] {
  const out: Category[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) out.push(...flattenCategoryTree(node.children));
  }
  return out;
}

/**
 * Ordered root → leaf category trail for breadcrumbs (e.g. Games > Steam).
 * Walks `parentId` upwards through an already-flattened category list.
 */
export function categoryTrail(
  category: Category,
  flatCategories: Category[],
): Category[] {
  const byId = new Map(flatCategories.map((c) => [c._id, c]));
  const trail: Category[] = [category];
  const seen = new Set<string>([category._id]);
  let parentId = category.parentId;
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    trail.unshift(parent);
    seen.add(parent._id);
    parentId = parent.parentId;
  }
  return trail;
}

/** Public lookup of a single category by slug (used by SEO landing pages). */
export async function getCategoryBySlug(
  slug: string,
  opts?: { cached?: boolean; revalidate?: number },
): Promise<Category | null> {
  const tree = await getCategories(opts);
  const match = flattenCategoryTree(tree).find(
    (c) => c.slug?.toLowerCase() === slug.toLowerCase(),
  );
  return match ?? null;
}

/** Public brands list (the `/brands` endpoint is public). */
export async function getBrands(opts?: {
  cached?: boolean;
  revalidate?: number;
}): Promise<Brand[]> {
  const url = `${API_BASE}/brands`;
  return opts?.cached
    ? safeJsonCached<Brand[]>(url, [], opts.revalidate ?? 300)
    : safeJson<Brand[]>(url, []);
}

/** Public lookup of a single brand by slug. */
export async function getBrand(
  slug: string,
  opts?: { cached?: boolean; revalidate?: number },
): Promise<Brand | null> {
  const url = `${API_BASE}/brands/${encodeURIComponent(slug)}`;
  return opts?.cached
    ? safeJsonCached<Brand | null>(url, null, opts.revalidate ?? 300)
    : safeJson<Brand | null>(url, null);
}

export interface SearchParams {
  q?: string;
  categoryId?: string;
  categoryIds?: string[];
  brandId?: string;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export interface SearchResponse {
  items: ProductListItem[];
  total: number;
  page: number;
  limit: number;
}

function searchQuery(params: SearchParams): string {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.categoryId) q.set("categoryId", params.categoryId);
  if (params.brandId) q.set("brandId", params.brandId);
  if (params.region) q.set("region", params.region);
  if (params.minPrice != null) q.set("minPrice", String(params.minPrice));
  if (params.maxPrice != null) q.set("maxPrice", String(params.maxPrice));
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  return q.toString();
}

export function searchProducts(params: SearchParams): Promise<SearchResponse> {
  return safeJson<SearchResponse>(`${API_BASE}/search?${searchQuery(params)}`, {
    items: [],
    total: 0,
    page: 1,
    limit: params.limit ?? 20,
  });
}

export interface Autocomplete {
  products: Array<{
    id: string;
    title: string;
    slug: string;
    price: number;
    currency: string;
    thumbnail?: string;
  }>;
  categories: Array<{ id: string; name: string; slug: string }>;
  brands: Array<{ id: string; name: string; slug: string }>;
}

export function autocomplete(q: string, limit = 8): Promise<Autocomplete> {
  return safeJson<Autocomplete>(
    `${API_BASE}/search/autocomplete?q=${encodeURIComponent(q)}&limit=${limit}`,
    { products: [], categories: [], brands: [] },
  );
}

export interface Facets {
  total: number;
  brands: Array<{ id: string; name: string; count: number }>;
  categories: Array<{ id: string; name: string; count: number }>;
  regions: Array<{ region: string; count: number }>;
  price: { min: number; max: number };
}

export function getFacets(params: SearchParams): Promise<Facets> {
  return safeJson<Facets>(`${API_BASE}/search/facets?${searchQuery(params)}`, {
    total: 0,
    brands: [],
    categories: [],
    regions: [],
    price: { min: 0, max: 0 },
  });
}

export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  roles: string[];
  status: string;
  emailVerified: boolean;
  /** Role permission — instant-delivery catalog access. */
  autoDelivery?: boolean;
  kycStatus?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
    country?: string;
    locale?: string;
    timezone?: string;
    bio?: string;
  };
  createdAt?: string;
}

export interface Wallet {
  balance: number;
  pendingBalance: number;
  currency: string;
}

export interface OrderItem {
  _id: string;
  orderNumber?: string;
  status: string;
  total?: number;
  currency?: string;
  createdAt?: string;
}

export class ApiError extends Error {
  public retryAfterSeconds?: number;
  public accountExists?: boolean;
  public invalidPassword?: boolean;
  constructor(
    message: string,
    public status: number,
    extra?: {
      retryAfterSeconds?: number;
      accountExists?: boolean;
      invalidPassword?: boolean;
    },
  ) {
    super(message);
    this.name = "ApiError";
    if (extra?.retryAfterSeconds) this.retryAfterSeconds = extra.retryAfterSeconds;
    if (extra?.accountExists !== undefined) {
      this.accountExists = extra.accountExists;
    }
    if (extra?.invalidPassword !== undefined) {
      this.invalidPassword = extra.invalidPassword;
    }
  }
}

/** Normalize thrown values from fetch helpers into ApiError when possible. */
export function toApiError(err: unknown): ApiError | null {
  if (err instanceof ApiError) return err;
  if (
    err instanceof Error &&
    "status" in err &&
    typeof (err as ApiError).status === "number"
  ) {
    return err as ApiError;
  }
  if (err && typeof err === "object") {
    const candidate = err as {
      message?: unknown;
      status?: unknown;
      statusCode?: unknown;
      accountExists?: unknown;
      invalidPassword?: unknown;
      retryAfterSeconds?: unknown;
    };
    const message =
      typeof candidate.message === "string" ? candidate.message : null;
    const status =
      typeof candidate.status === "number"
        ? candidate.status
        : typeof candidate.statusCode === "number"
          ? candidate.statusCode
          : null;
    if (message && status !== null) {
      return new ApiError(message, status, {
        accountExists:
          typeof candidate.accountExists === "boolean"
            ? candidate.accountExists
            : undefined,
        invalidPassword:
          typeof candidate.invalidPassword === "boolean"
            ? candidate.invalidPassword
            : undefined,
        retryAfterSeconds:
          typeof candidate.retryAfterSeconds === "number"
            ? candidate.retryAfterSeconds
            : undefined,
      });
    }
  }
  return null;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    roles: string[];
    emailVerified: boolean;
    status: string;
    isGuest?: boolean;
  };
  accessToken?: string;
  /** Browser sessions use this CSRF value with an HttpOnly refresh cookie. */
  csrfToken?: string;
  /** Legacy non-browser clients may still receive an opaque refresh token. */
  refreshToken?: string;
  expiresIn: number;
}

function getStored(key: "accessToken" | "refreshToken"): string | null {
  if (typeof window === "undefined") return null;
  return key === "refreshToken"
    ? localStorage.getItem("authSession")
    : getAccessToken();
}

// ── Proactive token refresh ──────────────────────────────────────────────────
// Reads the `exp` claim from the JWT access token so we can schedule a silent
// refresh ~90 s before expiry, ensuring long-lived tabs never hit a 401 on the
// next request or a WebSocket disconnect due to an expired token.

function getAccessTokenExpiry(): number | null {
  return getAccessExpiresAt();
}

let _proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshPromise: Promise<boolean> | null = null;

const PROACTIVE_REFRESH_RETRY_MS = 30_000;
const REFRESH_LOCK_KEY = "authRefreshLock";
const REFRESH_LOCK_TTL_MS = 15_000;
const REFRESH_GRACE_RETRY_MS = 500;
const MAX_CSRF_RECOVERY_ATTEMPTS = 3;
let refreshCsrfFailStreak = 0;
const TAB_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random()}`;

function readRefreshLock(): { tabId: string; until: number } | null {
  try {
    const raw = localStorage.getItem(REFRESH_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tabId?: string; until?: number };
    if (!parsed.tabId || typeof parsed.until !== "number") return null;
    return { tabId: parsed.tabId, until: parsed.until };
  } catch {
    return null;
  }
}

function acquireRefreshLock(tabId: string): boolean {
  const now = Date.now();
  const current = readRefreshLock();
  if (current && current.until > now && current.tabId !== tabId) {
    return false;
  }
  localStorage.setItem(
    REFRESH_LOCK_KEY,
    JSON.stringify({ tabId, until: now + REFRESH_LOCK_TTL_MS }),
  );
  return true;
}

function releaseRefreshLock(tabId: string): void {
  const current = readRefreshLock();
  if (current?.tabId === tabId) {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  }
}

async function waitForPeerRefresh(
  originalToken: string,
  timeoutMs = 12_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const currentToken = getStored("refreshToken");
    if (currentToken && currentToken !== originalToken) {
      return true;
    }
    if (!getStored("refreshToken")) return false;
    const lock = readRefreshLock();
    if (!lock || lock.until <= Date.now()) break;
  }
  return false;
}

async function resyncCsrfFromCookie(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/browser-session/resync`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      csrfToken: string;
      user?: { roles?: string[]; isGuest?: boolean };
      expiresIn?: number;
    };
    const prior = getSessionMeta();
    persistBrowserSession({
      csrfToken: data.csrfToken,
      roles: data.user?.roles ?? prior?.roles,
      isGuest: data.user?.isGuest ?? prior?.isGuest,
      expiresIn: data.expiresIn,
    });
    window.dispatchEvent(new Event("auth-change"));
    return true;
  } catch {
    return false;
  }
}

function applyRefreshResponse(data: {
  csrfToken: string;
  user?: { roles?: string[]; isGuest?: boolean };
  expiresIn?: number;
}): void {
  refreshCsrfFailStreak = 0;
  persistBrowserSession({
    csrfToken: data.csrfToken,
    roles: data.user?.roles,
    isGuest: data.user?.isGuest,
    expiresIn: data.expiresIn,
  });
  window.dispatchEvent(new Event("auth-change"));
  scheduleProactiveRefresh();
}

async function handleRefreshAuthFailure(
  csrfToken: string,
  primaryStatus: number,
  retryStatus: number,
): Promise<boolean> {
  if (primaryStatus !== 403 && retryStatus !== 403) {
    clearTokens();
    return false;
  }
  if (refreshCsrfFailStreak < MAX_CSRF_RECOVERY_ATTEMPTS && (await resyncCsrfFromCookie())) {
    refreshCsrfFailStreak += 1;
    const nextCsrf = getStored("refreshToken");
    if (nextCsrf) return performRefreshOnce(nextCsrf);
  }
  refreshCsrfFailStreak += 1;
  if (refreshCsrfFailStreak >= MAX_CSRF_RECOVERY_ATTEMPTS) {
    clearTokens();
    return false;
  }
  scheduleProactiveRefreshRetry(20_000);
  return false;
}

async function performRefreshOnce(csrfToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: "{}",
    });
    if (!res.ok) {
      const currentToken = getStored("refreshToken");
      if (currentToken && currentToken !== csrfToken) {
        refreshCsrfFailStreak = 0;
        return true;
      }
      if (res.status === 401 || res.status === 403) {
        await new Promise((resolve) => setTimeout(resolve, REFRESH_GRACE_RETRY_MS));
        const tokenAfterWait = getStored("refreshToken");
        if (tokenAfterWait && tokenAfterWait !== csrfToken) {
          refreshCsrfFailStreak = 0;
          return true;
        }
        const retryRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": tokenAfterWait ?? csrfToken,
          },
          body: "{}",
        });
        if (retryRes.ok) {
          applyRefreshResponse(
            (await retryRes.json()) as {
              csrfToken: string;
              user?: { roles?: string[]; isGuest?: boolean };
              expiresIn?: number;
            },
          );
          return true;
        }
        const tokenAfterRetry = getStored("refreshToken");
        if (tokenAfterRetry && tokenAfterRetry !== csrfToken) {
          refreshCsrfFailStreak = 0;
          return true;
        }
        return handleRefreshAuthFailure(csrfToken, res.status, retryRes.status);
      }
      return false;
    }
    applyRefreshResponse(
      (await res.json()) as {
        csrfToken: string;
        user?: { roles?: string[]; isGuest?: boolean };
        expiresIn?: number;
      },
    );
    return true;
  } catch {
    return false;
  }
}

async function migrateLegacyRefreshToken(
  legacyRefreshToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: legacyRefreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      accessToken?: string;
      csrfToken: string;
      user?: { roles?: string[]; isGuest?: boolean };
      expiresIn?: number;
    };
    persistBrowserSession({
      csrfToken: data.csrfToken,
      roles: data.user?.roles,
      isGuest: data.user?.isGuest,
      expiresIn: data.expiresIn,
    });
    window.dispatchEvent(new Event("auth-change"));
    scheduleProactiveRefresh();
    return true;
  } catch {
    return false;
  }
}

function scheduleProactiveRefreshRetry(delayMs = PROACTIVE_REFRESH_RETRY_MS): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("guestCheckout") === "1") return;
  if (!getStored("refreshToken")) return;
  if (_proactiveRefreshTimer !== null) {
    clearTimeout(_proactiveRefreshTimer);
  }
  _proactiveRefreshTimer = setTimeout(() => {
    _proactiveRefreshTimer = null;
    void tryRefresh().then((ok) => {
      if (ok) scheduleProactiveRefresh();
      else if (getStored("refreshToken")) scheduleProactiveRefreshRetry();
    });
  }, delayMs);
}

function scheduleProactiveRefresh(): void {
  if (typeof window === "undefined") return;
  if (_proactiveRefreshTimer !== null) {
    clearTimeout(_proactiveRefreshTimer);
    _proactiveRefreshTimer = null;
  }
  // Guest checkout sessions should not be silently renewed.
  if (localStorage.getItem("guestCheckout") === "1") return;

  const expiresAt = getAccessTokenExpiry();
  if (!expiresAt) return;

  // Aim to refresh 90 s before expiry.
  const delay = expiresAt - Date.now() - 90_000;
  if (delay <= 0) {
    // Already expired or about to — refresh immediately.
    void tryRefresh().then((ok) => {
      if (ok) scheduleProactiveRefresh();
      else if (getStored("refreshToken")) scheduleProactiveRefreshRetry();
    });
    return;
  }
  _proactiveRefreshTimer = setTimeout(() => {
    _proactiveRefreshTimer = null;
    void tryRefresh().then((ok) => {
      if (ok) scheduleProactiveRefresh();
      else if (getStored("refreshToken")) scheduleProactiveRefreshRetry();
    });
  }, delay);
}

export function setTokens(
  _accessToken: string | undefined,
  sessionToken?: string,
  options?: { guest?: boolean; roles?: string[]; expiresIn?: number },
): void {
  setAccessToken(null);
  if (sessionToken) {
    persistBrowserSession({
      csrfToken: sessionToken,
      roles: options?.roles,
      isGuest: options?.guest,
      expiresIn: options?.expiresIn,
    });
  }
  if (options?.guest) {
    localStorage.setItem("guestCheckout", "1");
  } else {
    localStorage.removeItem("guestCheckout");
  }
  window.dispatchEvent(new Event("auth-change"));
  scheduleProactiveRefresh();
}

export function clearTokens(): void {
  // Cancel any pending proactive refresh.
  if (_proactiveRefreshTimer !== null) {
    clearTimeout(_proactiveRefreshTimer);
    _proactiveRefreshTimer = null;
  }
  clearBrowserSession();
  localStorage.removeItem("guestCheckout");
  window.dispatchEvent(new Event("auth-change"));
}

async function throwApiError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  let retryAfterSeconds: number | undefined;
  let accountExists: boolean | undefined;
  let invalidPassword: boolean | undefined;
  try {
    const data = await res.json();
    message = Array.isArray(data.message)
      ? data.message.join(", ")
      : (data.message ?? message);
    if (typeof data.retryAfterSeconds === "number") {
      retryAfterSeconds = data.retryAfterSeconds;
    }
    if (typeof data.accountExists === "boolean") {
      accountExists = data.accountExists;
    }
    if (typeof data.invalidPassword === "boolean") {
      invalidPassword = data.invalidPassword;
    }
  } catch {
    /* ignore */
  }
  throw new ApiError(message, res.status, {
    retryAfterSeconds,
    accountExists,
    invalidPassword,
  });
}

export async function postJson<T>(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res);
  return (await res.json()) as T;
}

function recaptchaHeaders(token?: string): Record<string, string> | undefined {
  return token ? { "x-recaptcha-token": token } : undefined;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getStored("refreshToken");
  if (!refreshToken) {
    const legacy =
      typeof window !== "undefined"
        ? localStorage.getItem("refreshToken")
        : null;
    return legacy ? migrateLegacyRefreshToken(legacy) : false;
  }
  if (!refreshPromise) {
    refreshPromise = (async () => {
      if (!acquireRefreshLock(TAB_ID)) {
        const peerOk = await waitForPeerRefresh(refreshToken);
        if (peerOk) {
          scheduleProactiveRefresh();
          return true;
        }
        if (!acquireRefreshLock(TAB_ID)) {
          return performRefreshOnce(getStored("refreshToken") ?? refreshToken);
        }
      }
      try {
        return await performRefreshOnce(refreshToken);
      } finally {
        releaseRefreshLock(TAB_ID);
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** True when a refresh token is stored (session may still be renewable). */
export function hasRefreshToken(): boolean {
  return !!getStored("refreshToken");
}

/** Silently renew the access token when possible. */
export async function refreshSession(): Promise<boolean> {
  return tryRefresh();
}

const SESSION_REFRESH_FAILED_MSG =
  "Could not refresh your session. The server may be restarting — please try again.";

/** Run an authenticated fetch; refresh once on 401; keep session on transient failure. */
async function fetchWithAuthRetry(
  run: () => Promise<Response>,
): Promise<Response> {
  let res = await run();
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await run();
    } else if (getStored("refreshToken")) {
      throw new ApiError(SESSION_REFRESH_FAILED_MSG, 503);
    }
  }
  return res;
}

// Kick off proactive refresh on page load if a valid token is already stored.
if (typeof window !== "undefined") {
  void (async () => {
    if (!getStored("refreshToken") && !hasAuthSession()) {
      await resyncCsrfFromCookie();
    }
    if (getStored("refreshToken") || hasAuthSession()) {
      const ok = await tryRefresh();
      if (ok) scheduleProactiveRefresh();
      else if (getStored("refreshToken")) scheduleProactiveRefresh();
    }
  })();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (!getStored("refreshToken")) return;
    const expiresAt = getAccessTokenExpiry();
    if (!expiresAt || expiresAt - Date.now() < 120_000) {
      void tryRefresh().then((ok) => {
        if (ok) scheduleProactiveRefresh();
        else if (getStored("refreshToken")) scheduleProactiveRefreshRetry(5_000);
      });
    } else {
      scheduleProactiveRefresh();
    }
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || !getStored("refreshToken")) return;
    void tryRefresh().then((ok) => {
      if (ok) scheduleProactiveRefresh();
    });
  });

  window.addEventListener("storage", (event) => {
    if (
      event.key === "accessToken" ||
      event.key === "authSession" ||
      event.key === "refreshToken"
    ) {
      refreshCsrfFailStreak = 0;
      scheduleProactiveRefresh();
    }
  });
}

async function authRequestRaw<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const run = () => {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      credentials: "include",
    });
  };
  const res = await fetchWithAuthRetry(run);
  if (!res.ok) await throwApiError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function authRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method === "GET" && init.body == null) {
    return dedupeRequest(
      dedupeKey(method, `${API_BASE}${path}`, true),
      () => authRequestRaw<T>(path, init),
    );
  }
  return authRequestRaw<T>(path, init);
}

/** Cloudflare proxied orange-cloud uploads are capped near 100MB regardless of nginx. */
export const CLOUDFLARE_PROXY_UPLOAD_BYTES = 100 * 1024 * 1024;

function largeUploadOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_LARGE_UPLOAD_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/** Samba upload URL: grey-cloud host → Nest directly; main site → Next stream route (Movie-Server pattern). */
export function resolveSmbMediaUploadProxyUrl(serverId: string): string {
  const direct = largeUploadOrigin();
  if (direct) {
    return `${direct}/api/admin/media-shares/${serverId}/upload`;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin.replace(/\/$/, "")}/api/smb-media-upload/${serverId}`;
}

function resolveAuthUploadUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (typeof window !== "undefined" && path.startsWith("/api/")) {
    return `${window.location.origin}${path}`;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export type AuthFormDataProgress = {
  loaded: number;
  total: number;
  phase: "upload" | "processing";
};

export type AuthFormDataRequestOptions = {
  onProgress?: (progress: AuthFormDataProgress) => void;
};

function xhrFormDataPost(
  url: string,
  form: FormData,
  headers: Record<string, string> | undefined,
  onProgress?: (progress: AuthFormDataProgress) => void,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }
    }
    xhr.upload.addEventListener("progress", (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress({ loaded: event.loaded, total: event.total, phase: "upload" });
    });
    xhr.upload.addEventListener("loadend", () => {
      onProgress?.({ loaded: 1, total: 1, phase: "processing" });
    });
    xhr.addEventListener("load", () => {
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: { "Content-Type": xhr.getResponseHeader("Content-Type") ?? "application/json" },
        }),
      );
    });
    xhr.addEventListener("error", () =>
      reject(
        new ApiError(
          url.includes("upload.") && typeof window !== "undefined" && !url.startsWith(window.location.origin)
            ? "Upload network error. Check upload.uniqbd.com SSL and nginx (/api/smb-media-upload/ → port 3000, CORS from uniqbd.com)."
            : "Upload network error. Keep this page open and ensure nginx allows large POSTs to /api/smb-media-upload/.",
          0,
        ),
      ),
    );
    xhr.addEventListener("abort", () => reject(new ApiError("Upload cancelled.", 0)));
    xhr.timeout = 0;
    xhr.send(form);
  });
}

async function formDataWithAuthRetry(
  url: string,
  form: FormData,
  headers: Record<string, string> | undefined,
  onProgress?: (progress: AuthFormDataProgress) => void,
): Promise<Response> {
  const run = () =>
    onProgress
      ? xhrFormDataPost(url, form, headers, onProgress)
      : fetch(url, {
          method: "POST",
          body: form,
          cache: "no-store",
          credentials: "include",
          headers,
        });
  let res = await run();
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await run();
    } else if (getStored("refreshToken")) {
      throw new ApiError(SESSION_REFRESH_FAILED_MSG, 503);
    }
  }
  return res;
}

/** Multipart upload with cookie session + 401 refresh (do not set Content-Type). */
export async function authFormDataRequest<T>(
  path: string,
  form: FormData,
  options?: AuthFormDataRequestOptions,
): Promise<T> {
  const url = path.startsWith("http://") || path.startsWith("https://") ? path : resolveAuthUploadUrl(path);
  const sameOrigin = typeof window !== "undefined" && url.startsWith(window.location.origin);
  const csrf = getStored("refreshToken");
  const headers = !sameOrigin && csrf ? { "X-CSRF-Token": csrf } : undefined;
  let res: Response;
  try {
    res = await formDataWithAuthRetry(url, form, headers, options?.onProgress);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      sameOrigin
        ? "Upload failed before the server responded. If the file is very large, wait and try again, or use Samba on the storage server directly."
        : "Upload could not reach the API. Log out and log in again, or ask ops to set AUTH_COOKIE_DOMAIN=.uniqbd.com on the API.",
      0,
    );
  }
  if (!res.ok) {
    if (res.status === 413) {
      const cfHint = largeUploadOrigin()
        ? ""
        : " If the file is over ~100MB and Cloudflare is proxied (orange cloud), set NEXT_PUBLIC_LARGE_UPLOAD_ORIGIN to a grey-cloud host (see deploy docs) and rebuild web, or copy files via Samba on the storage LAN.";
      throw new ApiError(
        `Upload rejected (413 — body too large). On the VPS, merge repo nginx for uniqbd.com (client_max_body_size 25g and /api/admin/media-shares/ → port 4000), then nginx -t && reload.${cfHint}`,
        413,
      );
    }
    await throwApiError(res);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Samba video upload via Next streaming route (avoids API rewrite / CORS to Nest). */
export async function authSmbMediaUpload<T>(
  serverId: string,
  form: FormData,
  options?: AuthFormDataRequestOptions,
): Promise<T> {
  const url = resolveSmbMediaUploadProxyUrl(serverId);
  // HttpOnly access cookie + credentials; avoid custom headers on upload host (fewer CORS preflights).
  let res: Response;
  try {
    res = await formDataWithAuthRetry(url, form, undefined, options?.onProgress);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Upload failed before the server responded. If the file is very large, use upload.uniqbd.com (grey cloud) or copy via Samba on the storage LAN.",
      0,
    );
  }
  if (!res.ok) {
    if (res.status === 413) {
      throw new ApiError(
        "File too large for the web proxy or Cloudflare. Use grey-cloud upload.uniqbd.com or Samba on the storage LAN.",
        413,
      );
    }
    await throwApiError(res);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function authFetch<T>(path: string): Promise<T> {
  return authRequest<T>(path);
}

export interface RegisterResult {
  requiresVerification: true;
  email: string;
}

export function registerUser(
  email: string,
  password: string,
  recaptchaToken?: string,
): Promise<RegisterResult> {
  return postJson<RegisterResult>(
    "/auth/register",
    { email, password },
    recaptchaHeaders(recaptchaToken),
  );
}

export function loginUser(
  email: string,
  password: string,
  recaptchaToken?: string,
): Promise<AuthResult> {
  return postJson<AuthResult>(
    "/auth/login",
    { email, password },
    recaptchaHeaders(recaptchaToken),
  );
}

export function requestOtp(
  email: string,
  recaptchaToken?: string,
): Promise<{ message: string }> {
  return postJson(
    "/auth/otp/request",
    { email },
    recaptchaHeaders(recaptchaToken),
  );
}

export function verifyOtp(email: string, code: string): Promise<AuthResult> {
  return postJson<AuthResult>("/auth/otp/verify", { email, code });
}

export function startGuestCheckoutSession(): Promise<AuthResult> {
  return postJson<AuthResult>("/auth/guest", {});
}

export function verifyEmail(
  email: string,
  code: string,
): Promise<AuthResult> {
  return postJson<AuthResult>("/auth/verify-email", { email, code });
}

export function resendVerification(
  email: string,
  recaptchaToken?: string,
): Promise<{ message: string }> {
  return postJson(
    "/auth/resend-verification",
    { email },
    recaptchaHeaders(recaptchaToken),
  );
}

export function requestPasswordReset(
  email: string,
  recaptchaToken?: string,
): Promise<{ message: string }> {
  return postJson(
    "/auth/password-reset/request",
    { email },
    recaptchaHeaders(recaptchaToken),
  );
}

export function resetPasswordWithCode(
  email: string,
  code: string,
  password: string,
): Promise<{ message: string }> {
  return postJson("/auth/password-reset/confirm", { email, code, password });
}

export async function logoutUser(): Promise<void> {
  const csrfToken = getStored("refreshToken");
  if (csrfToken) {
    try {
      await postJson(
        "/auth/logout",
        {},
        { "X-CSRF-Token": csrfToken },
      );
    } catch {
      /* best effort */
    }
  }
  clearTokens();
}

export interface AdminRevenue {
  currency: string;
  total: number;
  today: number;
  last7Days: number;
  last30Days: number;
  refunded: number;
  net: number;
}

export interface AdminOrdersStats {
  total: number;
  today: number;
  byStatus: Record<string, number>;
  pending: number;
  delivered: number;
  refunded: number;
  averageOrderValue: number;
  recent: Array<{
    orderNumber?: string;
    status: string;
    total?: number;
    currency?: string;
    paymentStatus?: string;
    createdAt?: string;
  }>;
}

export interface AdminUsersStats {
  total: number;
  newToday: number;
  newLast7Days: number;
  newLast30Days: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
  recent: Array<{
    id: string;
    email: string;
    displayName?: string;
    roles: string[];
    status: string;
    emailVerified: boolean;
    createdAt?: string;
  }>;
}

export interface AdminWalletStats {
  currency: string;
  total: number;
  withBalance: number;
}

export interface AdminSuppliersStats {
  list: Array<{
    code: string;
    name: string;
    status: string;
    priority: number;
    balance?: number;
    balanceCurrency?: string;
    lastHealthyAt?: string;
    lastError?: string;
  }>;
  procurement: {
    success: number;
    failed: number;
    pending: number;
    successRate: number;
  };
}

export interface AdminReports {
  range: { from: string; to: string };
  timeseries: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{
    productId: string;
    title: string;
    quantity: number;
    revenue: number;
  }>;
  paymentBreakdown: Array<{
    method: string;
    count: number;
    total: number;
  }>;
  productSell?: {
    netSales: number;
    itemsSold: number;
    productsSold: number;
  };
}

export interface AdminOverview {
  revenue: AdminRevenue;
  orders: AdminOrdersStats;
  users: AdminUsersStats;
  suppliers: AdminSuppliersStats;
  wallet: AdminWalletStats;
}

export function getAdminOverview(): Promise<AdminOverview> {
  return authFetch<AdminOverview>("/admin/dashboard/overview");
}

export function getAdminRevenue(): Promise<AdminRevenue> {
  return authFetch<AdminRevenue>("/admin/dashboard/revenue");
}

export function getAdminOrdersStats(): Promise<AdminOrdersStats> {
  return authFetch<AdminOrdersStats>("/admin/dashboard/orders");
}

export function getAdminUsersStats(): Promise<AdminUsersStats> {
  return authFetch<AdminUsersStats>("/admin/dashboard/users");
}

export function getAdminSuppliersStats(): Promise<AdminSuppliersStats> {
  return authFetch<AdminSuppliersStats>("/admin/dashboard/suppliers");
}

export function getAdminReports(params?: {
  from?: string;
  to?: string;
}): Promise<AdminReports> {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const qs = q.toString();
  return authFetch<AdminReports>(
    `/admin/dashboard/reports${qs ? `?${qs}` : ""}`,
  );
}

/** Flush all public Redis caches, emit site.published, return the publish timestamp. */
export function adminPublishSite(): Promise<{ at: string }> {
  return authRequest<{ at: string }>("/admin/dashboard/publish", {
    method: "POST",
  });
}

/** Return the ISO timestamp of the last manual publish, or null if never published. */
export function adminGetLastPublish(): Promise<{ at: string | null }> {
  return authFetch<{ at: string | null }>("/admin/dashboard/last-publish");
}

export function getMe(): Promise<UserProfile> {
  return authFetch<UserProfile>("/users/me");
}

export function getWallet(): Promise<Wallet> {
  return authFetch<Wallet>("/wallet");
}

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  country?: string;
  locale?: string;
  timezone?: string;
  bio?: string;
  phone?: string;
}

export function updateProfile(dto: ProfileUpdate): Promise<UserProfile> {
  return authRequest<UserProfile>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

const AVATAR_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function avatarMimeFromName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return ext ? (map[ext] ?? null) : null;
}

export async function uploadProfileAvatar(file: File): Promise<UserProfile> {
  if (file.size > AVATAR_UPLOAD_MAX_BYTES) {
    throw new ApiError("Profile photo must be 2 MB or smaller.", 400);
  }
  const mime = file.type || avatarMimeFromName(file.name) || "";
  if (!AVATAR_UPLOAD_MIME.has(mime)) {
    throw new ApiError("Profile photo must be JPG, PNG, WebP, or GIF.", 400);
  }

  const form = new FormData();
  form.append("file", file);

  const run = () =>
    fetch(`${API_BASE}/users/me/avatar-upload`, {
      method: "POST",
      body: form,
      cache: "no-store",
      credentials: "include",
    });

  const res = await fetchWithAuthRetry(run);
  if (!res.ok) await throwApiError(res);
  const profile = (await res.json()) as UserProfile;
  if (profile.profile?.avatarUrl) {
    return {
      ...profile,
      profile: {
        ...profile.profile,
        avatarUrl: normalizeUploadUrl(profile.profile.avatarUrl),
      },
    };
  }
  return profile;
}

export function removeProfileAvatar(): Promise<UserProfile> {
  return authRequest<UserProfile>("/users/me/avatar", { method: "DELETE" });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  return authRequest("/users/me/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// ---- Admin: customers ----

export type CustomerStatus = "pending" | "active" | "suspended" | "banned";
export type CustomerRole =
  | "shop_manager"
  | "customer"
  | "vip"
  | "reseller"
  | "affiliate"
  | "supplier"
  | "subscriber"
  | "contributor"
  | "author"
  | "blogger"
  | "editor"
  | "administrator";

/** All assignable roles — keep in sync with `ADMIN_ROLE_IDS` in the API. */
export const CUSTOMER_ROLE_OPTIONS: ReadonlyArray<{
  value: CustomerRole;
  label: string;
  description: string;
}> = [
  {
    value: "shop_manager",
    label: "Shop manager",
    description: "Shop ops without site settings",
  },
  { value: "customer", label: "Customer", description: "Browse & purchase" },
  { value: "vip", label: "VIP", description: "Premium storefront" },
  { value: "reseller", label: "Reseller", description: "API & bulk orders" },
  { value: "affiliate", label: "Affiliate", description: "Referral earnings" },
  { value: "supplier", label: "Supplier", description: "Supply inventory" },
  {
    value: "subscriber",
    label: "Subscriber",
    description: "Newsletter & account",
  },
  {
    value: "contributor",
    label: "Contributor",
    description: "Submit product drafts",
  },
  { value: "author", label: "Author", description: "Own product listings" },
  { value: "blogger", label: "Blogger", description: "Write blog posts" },
  { value: "editor", label: "Editor", description: "Catalog & moderation" },
  {
    value: "administrator",
    label: "Administrator",
    description: "Full admin access",
  },
];

export const CUSTOMER_ROLES: CustomerRole[] = CUSTOMER_ROLE_OPTIONS.map(
  (option) => option.value,
);

export function normalizeCustomerRoles(roles: string[]): CustomerRole[] {
  const normalized = roles.map((role) => {
    if (role === "admin") return "administrator";
    if (role === "support") return "editor";
    return role;
  });
  const assignable = normalized.filter((role): role is CustomerRole =>
    CUSTOMER_ROLES.includes(role as CustomerRole),
  );
  return assignable.length ? assignable : ["customer"];
}

export const CUSTOMER_ROLE_LABELS: Record<CustomerRole, string> =
  Object.fromEntries(
    CUSTOMER_ROLE_OPTIONS.map((option) => [option.value, option.label]),
  ) as Record<CustomerRole, string>;

export interface AdminCustomerOverview {
  total: number;
  active: number;
  pending: number;
  banned: number;
  today: number;
  customers: number;
  walletTotal: number;
  withBalance: number;
}

export interface AdminCustomerRow extends UserProfile {
  wallet?: { balance: number; currency: string };
  adminNote?: string;
}

export interface AdminCustomerPage {
  items: AdminCustomerRow[];
  total: number;
  page: number;
  limit: number;
}

export function getAdminCustomerOverview(): Promise<AdminCustomerOverview> {
  return authRequest<AdminCustomerOverview>("/users/admin/overview");
}

export function adminListCustomers(params?: {
  q?: string;
  status?: CustomerStatus;
  role?: CustomerRole;
  hasBalance?: boolean;
  page?: number;
  limit?: number;
}): Promise<AdminCustomerPage> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 30));
  if (params?.q) q.set("q", params.q);
  if (params?.status) q.set("status", params.status);
  if (params?.role) q.set("role", params.role);
  if (params?.hasBalance === true) q.set("hasBalance", "true");
  if (params?.hasBalance === false) q.set("hasBalance", "false");
  return authRequest<AdminCustomerPage>(`/users/admin?${q.toString()}`);
}

export function adminGetCustomer(id: string): Promise<AdminCustomerRow> {
  return authRequest<AdminCustomerRow>(`/users/admin/${id}`);
}

export function adminCreateCustomer(input: {
  email: string;
  password?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  status?: CustomerStatus;
  emailVerified?: boolean;
  roles?: CustomerRole[];
}): Promise<AdminCustomerRow> {
  return authRequest<AdminCustomerRow>("/users/admin", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      roles: input.roles ? normalizeCustomerRoles(input.roles) : undefined,
    }),
  });
}

export function adminUpdateCustomer(
  id: string,
  input: Partial<{
    email: string;
    password: string;
    phone: string;
    firstName: string;
    lastName: string;
    displayName: string;
    status: CustomerStatus;
    emailVerified: boolean;
    kycStatus: string;
    roles: CustomerRole[];
  }>,
): Promise<AdminCustomerRow> {
  return authRequest<AdminCustomerRow>(`/users/admin/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...input,
      roles: input.roles ? normalizeCustomerRoles(input.roles) : undefined,
    }),
  });
}

export function adminDeleteCustomer(
  id: string,
): Promise<{ deleted: boolean; soft: boolean }> {
  return authRequest(`/users/admin/${id}`, { method: "DELETE" });
}

export interface AdminBulkDeleteCustomersResult {
  requested: number;
  hardDeleted: number;
  softDeleted: number;
  failed: number;
  errors: Array<{ id: string; message: string }>;
}

export function adminBulkDeleteCustomers(
  ids: string[],
): Promise<AdminBulkDeleteCustomersResult> {
  return authRequest<AdminBulkDeleteCustomersResult>("/users/admin/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function adminCreditCustomer(
  userId: string,
  amount: number,
  description?: string,
): Promise<unknown> {
  return authRequest("/wallet/credit", {
    method: "POST",
    body: JSON.stringify({
      userId,
      amount,
      type: "adjustment",
      description: description || "Admin wallet credit",
      idempotencyKey: `admin-credit-${userId}-${Date.now()}`,
    }),
  });
}

export function adminSaveCustomerNote(
  id: string,
  note: string,
): Promise<AdminCustomerRow> {
  return authRequest<AdminCustomerRow>(`/users/admin/${id}/note`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function adminSendCustomerEmail(
  id: string,
  subject: string,
  message: string,
): Promise<{ sent: true }> {
  return authRequest<{ sent: true }>(`/users/admin/${id}/email`, {
    method: "POST",
    body: JSON.stringify({ subject, message }),
  });
}

export function adminResetCustomerPassword(
  id: string,
  newPassword: string,
): Promise<{ success: true }> {
  return authRequest<{ success: true }>(`/users/admin/${id}/password`, {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
}

export interface Device {
  id: string;
  ip?: string;
  userAgent?: string;
  createdAt?: string;
  expiresAt: string;
}

export function getDevices(): Promise<Device[]> {
  return authRequest<Device[]>("/users/me/devices");
}

export function revokeDevice(id: string): Promise<{ success: boolean }> {
  return authRequest(`/users/me/devices/${id}`, { method: "DELETE" });
}

export function revokeAllDevices(): Promise<{ success: boolean }> {
  return authRequest("/users/me/devices", { method: "DELETE" });
}

export type NotificationAudience = "customer" | "staff";

export interface NotificationItem {
  _id: string;
  type?: string;
  title: string;
  body?: string;
  read: boolean;
  createdAt?: string;
  data?: Record<string, unknown>;
}

export interface NotificationListPage {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
}

export async function getNotifications(params?: {
  page?: number;
  limit?: number;
  audience?: NotificationAudience;
  excludeChat?: boolean;
}): Promise<NotificationListPage> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const audience = params?.audience ?? "customer";
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    audience,
  });
  if (params?.excludeChat) q.set("excludeChat", "true");
  const data = await authRequest<
    NotificationListPage | { items: NotificationItem[] } | NotificationItem[]
  >(`/notifications?${q.toString()}`);
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page, limit };
  }
  if ("total" in data && typeof data.total === "number") {
    return data as NotificationListPage;
  }
  const items = data.items ?? [];
  return { items, total: items.length, page, limit };
}

export function getUnreadCount(
  audience: NotificationAudience = "customer",
  chatOnly = false,
  excludeChat = false,
): Promise<{ count: number }> {
  const q = new URLSearchParams({ audience });
  if (chatOnly) q.set("chatOnly", "true");
  if (excludeChat) q.set("excludeChat", "true");
  return authRequest(`/notifications/unread-count?${q.toString()}`);
}

export function markChatNotificationsRead(
  audience: NotificationAudience = "customer",
): Promise<{ success: boolean }> {
  return authRequest(`/notifications/read-chat?audience=${audience}`, {
    method: "PATCH",
  }).then((result) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("notification-change"));
    }
    return result as { success: boolean };
  });
}

export function markNotificationRead(id: string): Promise<unknown> {
  return authRequest(`/notifications/${id}/read`, { method: "PATCH" }).then(
    (result) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("notification-change"));
      }
      return result;
    },
  );
}

export function markAllNotificationsRead(
  audience: NotificationAudience = "customer",
): Promise<unknown> {
  return authRequest(`/notifications/read-all?audience=${audience}`, {
    method: "PATCH",
  }).then(
    (result) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("notification-change"));
      }
      return result;
    },
  );
}

export interface NotificationChannels {
  inApp: boolean;
  email: boolean;
  push: boolean;
  telegram: boolean;
}

export interface NotificationPrefs {
  channels: NotificationChannels;
  telegramChatId?: string;
  pushTokens: string[];
  mutedEvents: string[];
}

export function getPreferences(): Promise<NotificationPrefs> {
  return authRequest<NotificationPrefs>("/notifications/preferences");
}

export function updatePreferences(dto: {
  channels?: Partial<NotificationChannels>;
  mutedEvents?: string[];
}): Promise<NotificationPrefs> {
  return authRequest<NotificationPrefs>("/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

export function setTelegram(chatId: string): Promise<NotificationPrefs> {
  return authRequest<NotificationPrefs>("/notifications/preferences/telegram", {
    method: "PUT",
    body: JSON.stringify({ chatId }),
  });
}

export function addPushToken(token: string): Promise<NotificationPrefs> {
  return authRequest<NotificationPrefs>(
    "/notifications/preferences/push-tokens",
    { method: "PUT", body: JSON.stringify({ token }) },
  );
}

export function removePushToken(token: string): Promise<NotificationPrefs> {
  return authRequest<NotificationPrefs>(
    "/notifications/preferences/push-tokens",
    { method: "DELETE", body: JSON.stringify({ token }) },
  );
}

// ---- Notifications admin ----

export interface NotificationChannelConfig {
  email: {
    configured: boolean;
    from: string;
    enabled?: boolean;
    mockMode?: boolean;
    host?: string;
  };
  push: { configured: boolean };
  telegram: {
    configured: boolean;
    enabled?: boolean;
    notifyOnOrderPlaced?: boolean;
    notifyOnCustomerChat?: boolean;
  };
}

export interface NotificationEventInfo {
  event: string;
  type: string;
  defaultChannels: string[];
}

export interface NotificationAdminOverview {
  channels: NotificationChannelConfig;
  queue: { waiting: number; active: number; failed: number };
  deliveries: {
    sent: number;
    failed: number;
    skipped: number;
    pending: number;
  };
  events: NotificationEventInfo[];
}

export interface NotificationDelivery {
  _id: string;
  userId: string;
  event: string;
  channel: string;
  status: string;
  recipient?: string;
  title?: string;
  orderNumber?: string;
  error?: string;
  createdAt?: string;
}

export interface NotificationDeliveryPage {
  items: NotificationDelivery[];
  total: number;
  page: number;
  limit: number;
}

export function getNotificationAdminOverview(): Promise<NotificationAdminOverview> {
  return authRequest<NotificationAdminOverview>(
    "/notifications/admin/overview",
  );
}

export function adminListNotificationDeliveries(params?: {
  channel?: string;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<NotificationDeliveryPage> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 30));
  if (params?.channel) q.set("channel", params.channel);
  if (params?.status) q.set("status", params.status);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.search) q.set("search", params.search);
  return authRequest<NotificationDeliveryPage>(
    `/notifications/admin/deliveries?${q.toString()}`,
  );
}

export function adminDeleteNotificationDelivery(
  id: string,
): Promise<{ deleted: boolean }> {
  return authRequest(`/notifications/admin/deliveries/${id}`, {
    method: "DELETE",
  });
}

export interface EmailDeliveryPreview {
  available: boolean;
  subject?: string;
  html?: string;
  recipient?: string;
  title?: string;
  note?: string;
}

export function adminPreviewNotificationDeliveryEmail(
  id: string,
): Promise<EmailDeliveryPreview> {
  return authRequest<EmailDeliveryPreview>(
    `/notifications/admin/deliveries/${id}/preview`,
  );
}

export function adminBulkDeleteNotificationDeliveries(
  ids: string[],
): Promise<{ deleted: number }> {
  return authRequest("/notifications/admin/deliveries/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function adminDispatchNotification(input: {
  userId: string;
  event: string;
  context?: Record<string, unknown>;
}): Promise<{ dispatched: boolean }> {
  return authRequest("/notifications/admin/dispatch", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface TelegramSettingsView {
  enabled: boolean;
  chatId: string;
  notifyOnOrderPlaced: boolean;
  notifyOnCustomerChat: boolean;
  hasBotToken: boolean;
  botTokenMasked: string;
  botTokenFromEnv: boolean;
  botUsername?: string;
  configured: boolean;
  updatedAt?: string;
}

export function getTelegramSettings(): Promise<TelegramSettingsView> {
  return authRequest<TelegramSettingsView>(
    "/notifications/admin/telegram/settings",
  );
}

export function updateTelegramSettings(
  patch: Partial<
    Pick<
      TelegramSettingsView,
      "enabled" | "chatId" | "notifyOnOrderPlaced" | "notifyOnCustomerChat"
    >
  > & { botToken?: string },
): Promise<TelegramSettingsView> {
  return authRequest<TelegramSettingsView>(
    "/notifications/admin/telegram/settings",
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
}

export function testTelegramSettings(): Promise<{
  success: boolean;
  error?: string;
  botUsername?: string;
}> {
  return authRequest("/notifications/admin/telegram/test", {
    method: "POST",
  });
}

export interface TelegramDiscoveredChat {
  chatId: string;
  title: string;
  type: string;
  username?: string;
}

export function discoverTelegramChats(botToken?: string): Promise<{
  chats: TelegramDiscoveredChat[];
  hint?: string;
  webhookWasCleared?: boolean;
}> {
  return authRequest("/notifications/admin/telegram/discover-chats", {
    method: "POST",
    body: JSON.stringify(botToken?.trim() ? { botToken: botToken.trim() } : {}),
  });
}

// ---- Security admin ----

export interface SecurityAdminOverview {
  rateLimit: {
    enabled: boolean;
    limit: number;
    ttlMs: number;
    storage: string;
  };
  recaptcha: {
    enabled: boolean;
    configured: boolean;
    minScore: number;
  };
  cloudflare: {
    enabled: boolean;
    trustProxyHops: number;
    requireHeaders: boolean;
  };
  helmet: {
    enabled: boolean;
    protections: string[];
  };
  audit: {
    enabled: boolean;
    total: number;
    last24h: number;
    recaptchaFailures24h: number;
  };
  activity: {
    enabled: boolean;
    sampleRate: number;
    total: number;
    last24h: number;
  };
  accessBlocks: {
    ip: number;
    country: number;
    total: number;
  };
  optimization: {
    redisThrottle: boolean;
    estimatedMonthlyVisitors: string;
    recommendation: string;
  };
  encryption?: {
    legacyPlaintext: {
      inventoryItems: number;
      orderDeliveredCodes: number;
      resellerOrderCodes: number;
      total: number;
    };
  };
}

export interface SecuritySettings {
  throttle: {
    enabled: boolean;
    limit: number;
    ttlMs: number;
    blockMs: number;
    registerLimit: number;
    loginLimit: number;
    otpLimit: number;
    authTtlMs: number;
  };
  recaptcha: {
    enabled: boolean;
    siteKey?: string;
    minScore: number;
    configured: boolean;
    hasSecret: boolean;
    secretFromEnv: boolean;
  };
  cloudflare: {
    enabled: boolean;
    trustProxyHops: number;
    requireHeaders: boolean;
  };
  activity: {
    enabled: boolean;
    retentionDays: number;
    sampleRate: number;
  };
  helmet: {
    enabled: boolean;
    hstsMaxAgeSeconds: number;
  };
  audit: {
    enabled: boolean;
  };
  emailDomains: {
    allowlistEnabled: boolean;
    allowlist: string[];
    blocklist: string[];
  };
  updatedAt?: string;
}

export interface RegistrationEmailPolicy {
  allowlistEnabled: boolean;
  allowedDomains?: string[];
}

export interface AuditLogItem {
  _id: string;
  action: string;
  actorType: string;
  entityType?: string;
  entityId?: string;
  status?: string;
  ip?: string;
  createdAt?: string;
}

export interface ActivityLogItem {
  _id: string;
  userId?: string;
  method: string;
  path: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  country?: string;
  cfRay?: string;
  createdAt?: string;
}

export interface SecurityLogPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function getSecurityAdminOverview(): Promise<SecurityAdminOverview> {
  return authRequest<SecurityAdminOverview>("/security/admin/overview");
}

export function getSecuritySettings(): Promise<SecuritySettings> {
  return authRequest<SecuritySettings>("/security/admin/settings");
}

export function getRecommendedEmailDomains(): Promise<{ domains: string[] }> {
  return authRequest<{ domains: string[] }>(
    "/security/admin/recommended-email-domains",
  );
}

export function getRegistrationEmailPolicy(): Promise<RegistrationEmailPolicy> {
  return fetch(`${API_BASE}/security/registration-email-policy`, {
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) {
      return { allowlistEnabled: false };
    }
    return res.json() as Promise<RegistrationEmailPolicy>;
  });
}

export function updateSecuritySettings(
  patch: Partial<{
    throttle: Partial<SecuritySettings["throttle"]>;
    recaptcha: Partial<SecuritySettings["recaptcha"]> & {
      secretKey?: string;
    };
    cloudflare: Partial<SecuritySettings["cloudflare"]>;
    activity: Partial<SecuritySettings["activity"]>;
    helmet: Partial<SecuritySettings["helmet"]>;
    audit: Partial<SecuritySettings["audit"]>;
    emailDomains: Partial<SecuritySettings["emailDomains"]>;
  }>,
): Promise<SecuritySettings> {
  return authRequest<SecuritySettings>("/security/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function listAuditLogs(params?: {
  action?: string;
  entityType?: string;
  page?: number;
  limit?: number;
}): Promise<SecurityLogPage<AuditLogItem>> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 30));
  if (params?.action) q.set("action", params.action);
  if (params?.entityType) q.set("entityType", params.entityType);
  return authRequest<SecurityLogPage<AuditLogItem>>(
    `/security/audit-logs?${q.toString()}`,
  );
}

export function listActivityLogs(params?: {
  userId?: string;
  page?: number;
  limit?: number;
}): Promise<SecurityLogPage<ActivityLogItem>> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 30));
  if (params?.userId) q.set("userId", params.userId);
  return authRequest<SecurityLogPage<ActivityLogItem>>(
    `/security/activity-logs?${q.toString()}`,
  );
}

export type AccessBlockType = "ip" | "country";

export interface AccessBlockItem {
  _id: string;
  type: AccessBlockType;
  value: string;
  active: boolean;
  reason?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function listAccessBlocks(params?: {
  type?: AccessBlockType;
  page?: number;
  limit?: number;
}): Promise<SecurityLogPage<AccessBlockItem>> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 50));
  if (params?.type) q.set("type", params.type);
  return authRequest<SecurityLogPage<AccessBlockItem>>(
    `/security/admin/blocks?${q.toString()}`,
  );
}

export function createAccessBlock(input: {
  type: AccessBlockType;
  value: string;
  reason?: string;
}): Promise<AccessBlockItem> {
  return authRequest<AccessBlockItem>("/security/admin/blocks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function removeAccessBlock(id: string): Promise<AccessBlockItem> {
  return authRequest<AccessBlockItem>(`/security/admin/blocks/${id}`, {
    method: "DELETE",
  });
}

// ---- Customer panel ----

export interface SiteAppearanceConfig {
  defaultTheme: ThemePreference;
  accent: AccentColor;
  brandColor: string;
  dark: { bg: string; elevated: string; muted: string };
  light: { bg: string; elevated: string; muted: string };
  logoUrlLight: string;
  logoUrlDark: string;
  logoUrlAdmin: string;
  logoUrlFooter: string;
  logoUrlFooterLight: string;
  logoUrlFooterDark: string;
  logoAlt: string;
  siteName: string;
  adminFaviconUrl: string;
}

export type LogoUploadVariant =
  | "light"
  | "dark"
  | "admin"
  | "email"
  | "footer-light"
  | "footer-dark"
  | "admin-favicon";

export type SiteMenuLink = {
  label: string;
  href: string;
};

export type SiteFooterColumn = {
  title: string;
  items: SiteMenuLink[];
};

export type SiteMenusConfig = {
  header: SiteMenuLink[];
  headerOthers: SiteMenuLink[];
  footer: SiteFooterColumn[];
};

export type HomepageSlide = {
  imageUrl: string;
  alt: string;
  href: string;
  enabled: boolean;
  sortOrder: number;
};

export interface CustomerPanelConfig {
  storefront: {
    siteName: string;
    defaultCurrency: string;
    maintenanceMode: boolean;
  };
  nav: Record<string, boolean>;
  rewards: {
    enabled: boolean;
    pointsPerCurrency: number;
    redeemThreshold: number;
  };
  checkout: {
    walletEnabled: boolean;
    gatewayEnabled: boolean;
    manualEnabled: boolean;
    gatewayLabel: string;
    gatewaySubtitle: string;
    paymentMethodOrder: Array<"wallet" | "gateway" | "manual">;
    allowGuestCheckout: boolean;
    allowGuestChat: boolean;
  };
  chat: {
    allowImageUpload: boolean;
    averageResponseTime: string;
  };
  appearance: SiteAppearanceConfig;
  siteMenus?: SiteMenusConfig;
  homepageSlides?: HomepageSlide[];
  /** When true, only products marked featured appear in homepage category sections. */
  homepageFeaturedOnly?: boolean;
}

const CUSTOMER_PANEL_NAV_FALLBACK: CustomerPanelConfig["nav"] = {
  home: true,
  categories: true,
  products: true,
  blog_overview: true,
  blog: true,
  blog_create: true,
  blog_categories: true,
  blog_settings: true,
  cart: true,
  checkout: true,
  wallet: true,
  orders: true,
  downloads: false,
  wishlist: true,
  referral: false,
  affiliate: false,
  rewards: false,
  support: true,
  chat: true,
  notifications: true,
  settings: false,
  profile: true,
  reseller: false,
};

const CUSTOMER_PANEL_CONFIG_FALLBACK: CustomerPanelConfig = {
  storefront: { siteName: "UniQbd", defaultCurrency: "BDT", maintenanceMode: false },
  nav: CUSTOMER_PANEL_NAV_FALLBACK,
  rewards: { enabled: true, pointsPerCurrency: 1, redeemThreshold: 100 },
  checkout: {
    walletEnabled: true,
    gatewayEnabled: true,
    manualEnabled: true,
    gatewayLabel: "bKash / Nagad",
    gatewaySubtitle: "Pay Money And Verify With TrxID",
    paymentMethodOrder: ["wallet", "gateway", "manual"],
    allowGuestCheckout: false,
    allowGuestChat: false,
  },
  chat: {
    allowImageUpload: true,
    averageResponseTime: "< 15 minutes",
  },
  appearance: {
    defaultTheme: "system",
    accent: "emerald",
    brandColor: "#2dd4bf",
    dark: { bg: "#01131a", elevated: "#031a22", muted: "#06212a" },
    light: { bg: "#f8fafc", elevated: "#ffffff", muted: "#f1f5f9" },
    logoUrlLight: "",
    logoUrlDark: "",
    logoUrlAdmin: "",
    logoUrlFooter: "",
    logoUrlFooterLight: "",
    logoUrlFooterDark: "",
    logoAlt: "UniQbd",
    siteName: "UniQbd",
    adminFaviconUrl: "",
  },
  siteMenus: undefined,
  homepageSlides: [],
};

export function getCustomerPanelConfig(opts?: {
  cached?: boolean;
  revalidate?: number;
}): Promise<CustomerPanelConfig> {
  const url = customerPanelConfigUrl();
  const tags = ["customer-panel-config"];
  if (opts?.cached) {
    return safeJsonCached(
      url,
      CUSTOMER_PANEL_CONFIG_FALLBACK,
      opts.revalidate ?? 60,
      tags,
    );
  }
  return safeJson<CustomerPanelConfig>(url, CUSTOMER_PANEL_CONFIG_FALLBACK);
}

export async function revalidateStorefront(): Promise<boolean> {
  try {
    const res = await fetch("/api/revalidate-homepage", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function revalidateWebsitePage(): Promise<boolean> {
  try {
    const res = await fetch("/api/revalidate-homepage", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: "website" }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** @deprecated Use revalidateStorefront */
export async function revalidateStorefrontHomepage(): Promise<boolean> {
  return revalidateStorefront();
}

export function getCustomerPanelAdminOverview(): Promise<{
  storefront: CustomerPanelConfig["storefront"];
  nav: { enabledCount: number; total: number; items: Record<string, boolean> };
  rewards: CustomerPanelConfig["rewards"];
  checkout: CustomerPanelConfig["checkout"];
  chat: CustomerPanelConfig["chat"];
  stats: { wishlistItems: number; deliveredOrders: number; activeOrders: number };
}> {
  return authRequest("/customer-panel/admin/overview");
}

export function getCustomerPanelAdminSettings(): Promise<{
  storefront: CustomerPanelConfig["storefront"];
  nav: Record<string, { enabled: boolean }>;
  rewards: CustomerPanelConfig["rewards"];
  checkout: CustomerPanelConfig["checkout"];
  chat: CustomerPanelConfig["chat"];
  appearance: SiteAppearanceConfig;
  siteMenus: SiteMenusConfig;
  homepageSlides: HomepageSlide[];
  homepageFeaturedOnly: boolean;
  effective: CustomerPanelConfig;
  updatedAt?: string;
}> {
  return authRequest("/customer-panel/admin/settings");
}

export function updateCustomerPanelSettings(
  patch: Record<string, unknown>,
): Promise<Awaited<ReturnType<typeof getCustomerPanelAdminSettings>>> {
  return authRequest("/customer-panel/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// --- License (Amarpin) ------------------------------------------------------

export type LicenseFeatureKey =
  | "topup"
  | "giftCard"
  | "reseller"
  | "autoDelivery"
  | "paymentGateway"
  | "api"
  | "liveChat"
  | "customOrder"
  | "reports"
  | "email";

export interface LicenseAdminStatus {
  configured: boolean;
  serverReady?: boolean;
  valid: boolean;
  status: string;
  code: string;
  message: string;
  grace: boolean;
  cached: boolean;
  devBypass?: boolean;
  missingLicenseKey?: boolean;
  licenseKeyMasked: string;
  lastValidatedAt: string | null;
  lastValidAt: string | null;
  features: Record<LicenseFeatureKey, boolean>;
  routeFeatures: Partial<Record<string, LicenseFeatureKey>>;
  featureCatalog: Array<{
    key: LicenseFeatureKey;
    label: string;
    enabled: boolean;
  }>;
}

export function getLicenseAdminStatus(): Promise<LicenseAdminStatus> {
  return authRequest<LicenseAdminStatus>("/license/admin/status");
}

export function activateLicenseKey(licenseKey: string): Promise<LicenseAdminStatus> {
  return authRequest<LicenseAdminStatus>("/license/admin/activate-key", {
    method: "POST",
    body: JSON.stringify({ licenseKey }),
  });
}

/** @deprecated use activateLicenseKey */
export function applyLicense(body: { licenseKey: string }): Promise<LicenseAdminStatus> {
  return activateLicenseKey(body.licenseKey);
}

export function activateLicense(): Promise<LicenseAdminStatus> {
  return authRequest<LicenseAdminStatus>("/license/admin/activate", {
    method: "POST",
  });
}

export function validateLicense(): Promise<LicenseAdminStatus> {
  return authRequest<LicenseAdminStatus>("/license/admin/validate", {
    method: "POST",
  });
}

export function deactivateLicense(): Promise<LicenseAdminStatus> {
  return authRequest<LicenseAdminStatus>("/license/admin/deactivate", {
    method: "POST",
  });
}

// --- Email / SMTP -----------------------------------------------------------

export type EmailLogoSource = "light" | "dark" | "system" | "custom";

export interface EmailSettingsView {
  enabled: boolean;
  mockMode: boolean;
  orderCustomerEmailsEnabled: boolean;
  adminOrderAlertEmailsEnabled: boolean;
  fromName: string;
  fromEmail: string;
  ordersFromName: string;
  ordersFromEmail: string;
  ordersSmtpUser: string;
  ordersReplyTo: string;
  supportFromName: string;
  supportFromEmail: string;
  supportSmtpUser: string;
  supportReplyTo: string;
  systemFromName: string;
  systemFromEmail: string;
  systemSmtpUser: string;
  systemReplyTo: string;
  adminFromName: string;
  adminFromEmail: string;
  adminSmtpUser: string;
  adminReplyTo: string;
  replyTo: string;
  smtpProvider: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  emailLogoSource: EmailLogoSource;
  logoUrl: string;
  footerText: string;
  primaryColor: string;
  updatedAt?: string;
}

export interface EmailChannelSmtpStatus {
  hasPassword: boolean;
  usernameMasked: string;
}

export interface EmailSmtpStatus {
  configured: boolean;
  hasPassword: boolean;
  host: string;
  port: number;
  secure: boolean;
  hasAuth: boolean;
  usernameMasked: string;
  fromDisplay: string;
  envFromName: string;
  envFromEmail: string;
  adminEmail: string;
  orders: EmailChannelSmtpStatus;
  support: EmailChannelSmtpStatus;
  system: EmailChannelSmtpStatus;
  admin: EmailChannelSmtpStatus;
}

export interface SmtpProviderOption {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
}

export function getEmailAdminSettings(): Promise<{
  settings: EmailSettingsView;
  smtp: EmailSmtpStatus;
  providers: SmtpProviderOption[];
}> {
  return authRequest("/email/admin/settings");
}

export function updateEmailAdminSettings(
  patch: Partial<EmailSettingsView> & {
    smtpPass?: string;
    ordersSmtpPass?: string;
    supportSmtpPass?: string;
    systemSmtpPass?: string;
    adminSmtpPass?: string;
  },
): Promise<{ settings: EmailSettingsView; smtp: EmailSmtpStatus }> {
  return authRequest("/email/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function verifySmtpConnection(): Promise<{
  ok: boolean;
  verified: boolean;
  error?: string;
}> {
  return authRequest("/email/admin/verify", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export type EmailTestChannel =
  | "default"
  | "orders"
  | "support"
  | "system"
  | "admin";

export type EmailSenderChannel = EmailTestChannel;

export const EMAIL_SENDER_CHANNEL_OPTIONS: {
  value: EmailSenderChannel;
  label: string;
}[] = [
  { value: "default", label: "Default (General)" },
  { value: "orders", label: "Orders" },
  { value: "support", label: "Support" },
  { value: "system", label: "System" },
  { value: "admin", label: "Admin" },
];

export function sendTestEmail(
  to?: string,
  channel: EmailTestChannel = "system",
): Promise<{
  ok: boolean;
  verified: boolean;
  sent: boolean;
  skipped?: boolean;
  failed?: boolean;
  channel?: EmailTestChannel;
  to?: string;
  error?: string;
}> {
  return authRequest("/email/admin/test", {
    method: "POST",
    body: JSON.stringify({ ...(to ? { to } : {}), channel }),
  });
}

export interface EmailTemplateItem {
  id: string;
  category: "orders" | "account" | "system";
  recipient: "admin" | "customer";
  label: string;
  description: string;
  subject: string;
  heading: string;
  bodyText: string;
  buttonLabel: string;
  buttonUrl: string;
  enabled: boolean;
  updatedAt?: string;
}

export interface EmailTemplateStats {
  total: number;
  enabled: number;
  disabled: number;
  categories: number;
}

export type EmailTemplatePatch = Partial<
  Pick<
    EmailTemplateItem,
    | "subject"
    | "heading"
    | "bodyText"
    | "buttonLabel"
    | "buttonUrl"
    | "enabled"
  >
>;

export function getEmailTemplates(): Promise<{
  templates: EmailTemplateItem[];
  stats: EmailTemplateStats;
}> {
  return authRequest("/email/admin/templates");
}

export function getEmailTemplate(id: string): Promise<EmailTemplateItem> {
  return authRequest(`/email/admin/templates/${encodeURIComponent(id)}`);
}

export function updateEmailTemplate(
  id: string,
  patch: EmailTemplatePatch,
): Promise<EmailTemplateItem> {
  return authRequest(`/email/admin/templates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function resetEmailTemplate(id: string): Promise<EmailTemplateItem> {
  return authRequest(`/email/admin/templates/${encodeURIComponent(id)}/reset`, {
    method: "POST",
  });
}

export interface EmailTemplatePreviewHtml {
  available: boolean;
  subject?: string;
  html?: string;
  usesBuiltInDesign?: boolean;
}

export function getEmailTemplatePreviewHtml(
  id: string,
): Promise<EmailTemplatePreviewHtml> {
  return authRequest(
    `/email/admin/templates/${encodeURIComponent(id)}/preview-html`,
  );
}

export function submitContactForm(
  input: {
    name: string;
    email: string;
    subject: string;
    message: string;
  },
  recaptchaToken?: string,
): Promise<{ success: boolean }> {
  return postJson("/contact", input, recaptchaHeaders(recaptchaToken));
}

// --- Contact inbox (email messages) -----------------------------------------

export type ContactInquiryStatus = "new" | "read" | "replied" | "closed";

export interface ContactInquiryMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  adminId?: string;
  sentAt?: string;
}

export interface ContactInquiryItem {
  id: string;
  name: string;
  email: string;
  subject: string;
  status: ContactInquiryStatus;
  message: string;
  adminReply?: string;
  repliedAt?: string;
  readAt?: string;
  lastMessageAt?: string;
  messages: ContactInquiryMessage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactInquiryList {
  items: ContactInquiryItem[];
  total: number;
  page: number;
  limit: number;
}

export function listContactInquiriesAdmin(
  page = 1,
  limit = 50,
  status?: ContactInquiryStatus,
): Promise<ContactInquiryList> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status) params.set("status", status);
  return authRequest<ContactInquiryList>(
    `/contact-inquiries/admin?${params.toString()}`,
  );
}

export function getContactInquiryAdmin(
  id: string,
): Promise<ContactInquiryItem> {
  return authRequest<ContactInquiryItem>(`/contact-inquiries/admin/${id}`);
}

export function replyContactInquiry(
  id: string,
  message: string,
): Promise<ContactInquiryItem> {
  return authRequest<ContactInquiryItem>(
    `/contact-inquiries/admin/${id}/reply`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    },
  );
}

export function updateContactInquiryStatus(
  id: string,
  status: ContactInquiryStatus,
): Promise<ContactInquiryItem> {
  return authRequest<ContactInquiryItem>(
    `/contact-inquiries/admin/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export function deleteContactInquiry(id: string): Promise<{ success: boolean }> {
  return authRequest<{ success: boolean }>(
    `/contact-inquiries/admin/${id}`,
    { method: "DELETE" },
  );
}

// --- Product requests -------------------------------------------------------

export interface ProductRequestItem {
  id: string;
  userId: string;
  productName: string;
  customerName: string;
  email: string;
  mobile: string;
  details: string;
  adminReply?: string;
  repliedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductRequestList {
  items: ProductRequestItem[];
  total: number;
  page: number;
  limit: number;
}

export function submitProductRequest(input: {
  productName: string;
  customerName: string;
  email: string;
  mobile: string;
  details: string;
}): Promise<ProductRequestItem> {
  return authRequest<ProductRequestItem>("/product-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listProductRequestsAdmin(
  page = 1,
  limit = 50,
): Promise<ProductRequestList> {
  return authRequest<ProductRequestList>(
    `/product-requests/admin?page=${page}&limit=${limit}`,
  );
}

export function replyProductRequest(
  id: string,
  message: string,
): Promise<ProductRequestItem> {
  return authRequest<ProductRequestItem>(
    `/product-requests/${encodeURIComponent(id)}/reply`,
    { method: "POST", body: JSON.stringify({ message }) },
  );
}

export function deleteProductRequest(
  id: string,
): Promise<{ success: boolean }> {
  return authRequest(`/product-requests/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// --- SEO management ---------------------------------------------------------

export interface SeoFaqItem {
  question: string;
  answer: string;
}

export interface StaticPageSeoEntry {
  path: string;
  label: string;
  title: string;
  description: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  noIndex: boolean;
}

export interface SeoSettings {
  global: {
    siteTitle: string;
    siteDescription: string;
    keywords: string[];
    canonicalDomain: string;
    robotsIndex: boolean;
    robotsFollow: boolean;
    googleVerification: string;
    bingVerification: string;
    googleAnalyticsId: string;
    gtmId: string;
    facebookPixelId: string;
  };
  homepage: {
    title: string;
    description: string;
    keywords: string[];
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
  };
  social: {
    facebook: string;
    instagram: string;
    youtube: string;
    twitter: string;
    discord: string;
  };
  schema: {
    organization: boolean;
    website: boolean;
    product: boolean;
    faq: boolean;
    faqItems: SeoFaqItem[];
  };
  staticPages: StaticPageSeoEntry[];
  robots: { useCustom: boolean; content: string };
  sitemap: { lastGeneratedAt?: string; urlCount: number; status: string };
  autoGenerateProductSeo: boolean;
  updatedAt?: string;
}

export type SeoSettingsPatch = {
  global?: Partial<SeoSettings["global"]>;
  homepage?: Partial<SeoSettings["homepage"]>;
  social?: Partial<SeoSettings["social"]>;
  schema?: Partial<Omit<SeoSettings["schema"], "faqItems">> & {
    faqItems?: SeoFaqItem[];
  };
  staticPages?: StaticPageSeoEntry[];
  autoGenerateProductSeo?: boolean;
};

export interface PublicSeoConfig {
  siteTitle: string;
  siteDescription: string;
  keywords: string[];
  canonicalDomain: string;
  robots: { index: boolean; follow: boolean };
  verification: { google: string; bing: string };
  analytics: {
    googleAnalyticsId: string;
    gtmId: string;
    facebookPixelId: string;
  };
  homepage: SeoSettings["homepage"];
  social: SeoSettings["social"];
  schema: SeoSettings["schema"];
  staticPages: StaticPageSeoEntry[];
}

export interface SeoEntitySample {
  id: string;
  title: string;
  slug: string;
  type: "product" | "category" | "brand";
}

export interface SeoAnalyzerReport {
  score: number;
  totals: { products: number; categories: number; brands: number };
  issues: {
    missingMetaTitle: { count: number; samples: SeoEntitySample[] };
    missingMetaDescription: { count: number; samples: SeoEntitySample[] };
    missingCanonical: { count: number; samples: SeoEntitySample[] };
    missingAltTags: { count: number; samples: SeoEntitySample[] };
    duplicateTitles: {
      count: number;
      groups: { value: string; count: number; items: SeoEntitySample[] }[];
    };
    duplicateDescriptions: {
      count: number;
      groups: { value: string; count: number; items: SeoEntitySample[] }[];
    };
  };
  generatedAt: string;
}

export interface SitemapStatus {
  lastGeneratedAt: string | null;
  urlCount: number;
  status: string;
  sitemapUrl: string;
}

export interface RobotsState {
  useCustom: boolean;
  content: string;
  effective: string;
  generated: string;
}

export interface RobotsValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function getSeoSettings(): Promise<SeoSettings> {
  return authRequest("/seo/admin/settings");
}

export function updateSeoSettings(patch: SeoSettingsPatch): Promise<SeoSettings> {
  return authRequest("/seo/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function getSeoAnalyzer(): Promise<SeoAnalyzerReport> {
  return authRequest("/seo/admin/analyzer");
}

export function getSitemapStatus(): Promise<SitemapStatus> {
  return authRequest("/seo/admin/sitemap");
}

export function regenerateSitemap(): Promise<SitemapStatus> {
  return authRequest("/seo/admin/sitemap/regenerate", { method: "POST" });
}

export function getRobotsState(): Promise<RobotsState> {
  return authRequest("/seo/admin/robots");
}

export function saveRobots(
  content: string,
  useCustom: boolean,
): Promise<{ useCustom: boolean; content: string; validation: RobotsValidation }> {
  return authRequest("/seo/admin/robots", {
    method: "PUT",
    body: JSON.stringify({ content, useCustom }),
  });
}

export function validateRobots(content: string): Promise<RobotsValidation> {
  return authRequest("/seo/admin/robots/validate", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

/** Public SEO config for the storefront. Server-cached; falls back to defaults. */
export async function getSeoConfig(
  fallback: PublicSeoConfig,
  revalidate = 300,
): Promise<PublicSeoConfig> {
  return safeJsonCached<PublicSeoConfig>(
    `${API_BASE}/seo/config`,
    fallback,
    revalidate,
  );
}

export async function getRobotsContent(fallback: string): Promise<string> {
  const res = await safeJsonCached<{ content: string }>(
    `${API_BASE}/seo/robots`,
    { content: fallback },
    300,
  );
  return res.content || fallback;
}

const LOGO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_UPLOAD_MIME = new Set([
  "image/webp",
  "image/gif",
  "image/png",
  "image/svg+xml",
  "image/avif",
]);

const FAVICON_UPLOAD_MIME = new Set([
  "image/x-icon",
  "image/vnd.microsoft.icon",
  ...LOGO_UPLOAD_MIME,
]);

function logoMimeFromName(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    webp: "image/webp",
    gif: "image/gif",
    png: "image/png",
    svg: "image/svg+xml",
    avif: "image/avif",
    ico: "image/x-icon",
  };
  return ext ? (map[ext] ?? null) : null;
}

export async function uploadSiteLogo(
  file: File,
  variant: LogoUploadVariant,
): Promise<{ url: string; variant: string; filename: string }> {
  if (file.size > LOGO_UPLOAD_MAX_BYTES) {
    throw new ApiError("Logo must be 5 MB or smaller.", 400);
  }
  const mime = file.type || logoMimeFromName(file.name) || "";
  const allowedMime =
    variant === "admin-favicon" ? FAVICON_UPLOAD_MIME : LOGO_UPLOAD_MIME;
  if (!allowedMime.has(mime)) {
    throw new ApiError(
      variant === "admin-favicon"
        ? "Favicon must be ICO, WebP, GIF, PNG, SVG, or AVIF."
        : "Logo must be WebP, GIF, PNG, SVG, or AVIF.",
      400,
    );
  }

  const form = new FormData();
  // Variant must be sent before the file so multer can read it during upload.
  form.append("variant", variant);
  form.append("file", file);

  const run = () => {
    return fetch(
      `${API_BASE}/customer-panel/admin/logo-upload?variant=${encodeURIComponent(variant)}`,
      {
        method: "POST",
        body: form,
        cache: "no-store",
        credentials: "include",
      },
    );
  };

  const res = await fetchWithAuthRetry(run);
  if (!res.ok) await throwApiError(res);
  return parseUploadUrlJson<{ url: string; variant: string; filename: string }>(
    res,
  );
}

const PRODUCT_IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const PRODUCT_IMAGE_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function productImageMimeFromName(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
  };
  return ext ? (map[ext] ?? null) : null;
}

export async function uploadProductImage(
  file: File,
): Promise<{ url: string; filename: string }> {
  if (file.size > PRODUCT_IMAGE_UPLOAD_MAX_BYTES) {
    throw new ApiError("Image must be 10 MB or smaller.", 400);
  }
  const mime = file.type || productImageMimeFromName(file.name) || "";
  if (!PRODUCT_IMAGE_UPLOAD_MIME.has(mime)) {
    throw new ApiError("Image must be JPG, PNG, WebP, GIF, or AVIF.", 400);
  }

  const form = new FormData();
  form.append("file", file);

  const run = () => {
    return fetch(`${API_BASE}/products/admin/image-upload`, {
      method: "POST",
      body: form,
      cache: "no-store",
      credentials: "include",
    });
  };

  const res = await fetchWithAuthRetry(run);
  if (!res.ok) await throwApiError(res);
  return parseUploadUrlJson<{ url: string; filename: string }>(res);
}

const BANNER_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const BANNER_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function bannerMimeFromName(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
  };
  return ext ? (map[ext] ?? null) : null;
}

export async function uploadHomepageBanner(
  file: File,
): Promise<{ url: string; filename: string }> {
  if (file.size > BANNER_UPLOAD_MAX_BYTES) {
    throw new ApiError("Banner must be 10 MB or smaller.", 400);
  }
  const mime = file.type || bannerMimeFromName(file.name) || "";
  if (!BANNER_UPLOAD_MIME.has(mime)) {
    throw new ApiError("Banner must be JPG, PNG, WebP, GIF, or AVIF.", 400);
  }

  const form = new FormData();
  form.append("file", file);

  const run = () => {
    return fetch(`${API_BASE}/customer-panel/admin/banner-upload`, {
      method: "POST",
      body: form,
      cache: "no-store",
      credentials: "include",
    });
  };

  const res = await fetchWithAuthRetry(run);
  if (!res.ok) await throwApiError(res);
  return parseUploadUrlJson<{ url: string; filename: string }>(res);
}

export type RolePermissionProfile = {
  id: string;
  label: string;
  description: string;
  locked: boolean;
  summary: string[];
  customized: boolean;
  permissions: Record<string, boolean>;
};

export function getRolePermissionsOverview(): Promise<{
  roleCount: number;
  customizedCount: number;
  adminAccessCount: number;
  roles: RolePermissionProfile[];
  groups: Array<{ id: string; label: string; locked: boolean }>;
}> {
  return authRequest("/role-permissions/admin");
}

export type AdminPermissions = Record<string, boolean>;

export function getMyAdminPermissions(): Promise<AdminPermissions> {
  return authRequest("/role-permissions/me");
}

export function updateRolePermissions(
  roleId: string,
  permissions: Record<string, boolean>,
): Promise<RolePermissionProfile> {
  return authRequest(`/role-permissions/admin/roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify({ permissions }),
  });
}

export function resetRolePermissions(
  roleId: string,
): Promise<RolePermissionProfile> {
  return authRequest(`/role-permissions/admin/roles/${roleId}/reset`, {
    method: "POST",
  });
}

export function resetAllRolePermissions(): Promise<{
  roleCount: number;
  customizedCount: number;
  adminAccessCount: number;
  roles: RolePermissionProfile[];
  groups: Array<{ id: string; label: string; locked: boolean }>;
}> {
  return authRequest("/role-permissions/admin/reset", { method: "POST" });
}

export interface WishlistEntry {
  _id: string;
  productId: string;
  product: ProductListItem;
  createdAt?: string;
}

export function getWishlist(): Promise<WishlistEntry[]> {
  return authRequest<WishlistEntry[]>("/wishlist");
}

export function addToWishlist(productId: string): Promise<{ added: boolean }> {
  return authRequest(`/wishlist/${productId}`, { method: "POST" });
}

export function removeFromWishlist(
  productId: string,
): Promise<{ removed: boolean }> {
  return authRequest(`/wishlist/${productId}`, { method: "DELETE" });
}

export interface DownloadItem {
  orderId: string;
  orderNumber?: string;
  orderDate?: string;
  productId: string;
  title: string;
  slug: string;
  quantity: number;
  codes: Array<{ code: string; serial?: string; pin?: string }>;
}

export function getDownloads(): Promise<{ items: DownloadItem[]; total: number }> {
  return authRequest("/orders/downloads");
}

export interface RewardsSummary {
  enabled: boolean;
  points: number;
  lifetimePoints: number;
  pointsPerCurrency: number;
  redeemThreshold: number;
  redeemProgress: number;
  canRedeem: boolean;
  history: Array<{
    orderId: string;
    orderNumber?: string;
    points: number;
    total: number;
    createdAt?: string;
  }>;
}

export function getRewardsSummary(): Promise<RewardsSummary> {
  return authRequest<RewardsSummary>("/rewards/me");
}

export function requestWalletWithdraw(input: {
  amount: number;
  method?: string;
  accountNumber?: string;
  note?: string;
}): Promise<unknown> {
  return authRequest("/wallet/withdraw", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type KycDocType = "passport" | "national_id" | "driver_license";

export interface KycDocItem {
  _id: string;
  documentType: string;
  status: string;
  fileUrls: string[];
  createdAt?: string;
}

export interface KycOverview {
  status: string;
  documents: KycDocItem[];
}

export function getKyc(): Promise<KycOverview> {
  return authRequest<KycOverview>("/kyc/me");
}

export function submitKyc(
  documentType: KycDocType,
  fileUrls: string[],
): Promise<KycDocItem> {
  return authRequest<KycDocItem>("/kyc", {
    method: "POST",
    body: JSON.stringify({ documentType, fileUrls }),
  });
}

export type KycRequestStatus = "pending" | "verified" | "rejected";

export interface KycAdminOverview {
  pending: number;
  verified: number;
  rejected: number;
  total: number;
}

export interface AdminKycRequest {
  _id: string;
  userId: string;
  email?: string;
  displayName?: string;
  documentType: KycDocType;
  fileUrls: string[];
  status: KycRequestStatus;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function getKycAdminOverview(): Promise<KycAdminOverview> {
  return authRequest<KycAdminOverview>("/kyc/admin/overview");
}

export function adminListKycRequests(params?: {
  status?: KycRequestStatus;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: AdminKycRequest[]; total: number; page: number; limit: number }> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 30));
  if (params?.status) q.set("status", params.status);
  if (params?.q?.trim()) q.set("q", params.q.trim());
  return authRequest(`/kyc/admin/requests?${q.toString()}`);
}

export function adminApproveKycRequest(id: string): Promise<AdminKycRequest> {
  return authRequest<AdminKycRequest>(`/kyc/admin/requests/${id}/approve`, {
    method: "POST",
  });
}

export function adminRejectKycRequest(
  id: string,
  rejectionReason?: string,
): Promise<AdminKycRequest> {
  return authRequest<AdminKycRequest>(`/kyc/admin/requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ rejectionReason }),
  });
}

// ---- Catalog admin: products, categories, brands, stock ----

export interface Seo {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  metaRobots?: string;
}

export type ProductTypeValue =
  | "license"
  | "account"
  | "giftcard"
  | "topup"
  | "subscription";
export type ProductStatusValue =
  | "draft"
  | "active"
  | "out_of_stock"
  | "archived";
export type DeliveryTypeValue = "auto" | "manual";

export interface AdminProduct {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  sku?: string;
  categoryId?: string;
  categoryIds?: string[];
  brandId?: string;
  type: ProductTypeValue;
  deliveryType?: DeliveryTypeValue;
  pricing: {
    currency?: string;
    basePrice: number;
    compareAt?: number;
    cost?: number;
  };
  attributes?: Record<string, unknown>;
  media?: Array<{ url: string; alt?: string; type?: string }>;
  availableRegions?: string[];
  seo?: Seo;
  status?: ProductStatusValue;
  stock?: { available: number; reserved?: number; sold?: number };
  inventoryAvailable?: number;
  effectiveAvailable?: number;
  createdAt?: string;
  /** When true, this product is shown on the homepage in "featured only" mode. */
  featured?: boolean;
}

export interface ProductInput {
  title: string;
  slug?: string;
  description?: string;
  sku?: string;
  categoryId?: string;
  categoryIds?: string[];
  brandId?: string;
  type: ProductTypeValue;
  deliveryType?: DeliveryTypeValue;
  pricing: {
    currency?: string;
    basePrice: number;
    compareAt?: number;
    cost?: number;
  };
  media?: Array<{ url: string; alt?: string }>;
  attributes?: Record<string, unknown>;
  availableRegions?: string[];
  seo?: Seo;
  status?: ProductStatusValue;
  stock?: { available: number };
  featured?: boolean;
}

export async function adminListProducts(params?: {
  search?: string;
  status?: string;
  categoryId?: string;
  categoryIds?: string[];
  brandId?: string;
}): Promise<AdminProduct[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  if (params?.categoryId) q.set("categoryId", params.categoryId);
  if (params?.brandId) q.set("brandId", params.brandId);
  const data = await authRequest<{ items: AdminProduct[] }>(
    `/products/admin/list?${q.toString()}`,
  );
  return data.items ?? [];
}

export function adminGetProduct(id: string): Promise<AdminProduct> {
  return authRequest<AdminProduct>(`/products/admin/${id}`);
}

export function createProduct(input: ProductInput): Promise<AdminProduct> {
  return authRequest<AdminProduct>("/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProduct(
  id: string,
  input: Partial<ProductInput>,
): Promise<AdminProduct> {
  return authRequest<AdminProduct>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProduct(
  id: string,
): Promise<{ success: boolean; mode?: "deleted" | "archived" }> {
  return authRequest(`/products/${id}`, { method: "DELETE" });
}

export function addInventory(
  id: string,
  values: string[],
  cost?: number,
  variationValueId?: string,
): Promise<{
  added: number;
  skipped: number;
  duplicates: string[];
  available: number;
}> {
  const body: {
    values: string[];
    cost?: number;
    variationValueId?: string;
  } = { values };
  if (cost !== undefined) body.cost = cost;
  if (variationValueId) body.variationValueId = String(variationValueId);
  return authRequest(`/products/${id}/inventory`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type PackageStock = {
  valueId: string;
  name: string;
  stockType: string;
  available: number;
  reserved: number;
  sold: number;
};

export function getStock(
  id: string,
  variationValueId?: string,
): Promise<{
  available: number;
  reserved: number;
  sold: number;
  packages?: PackageStock[];
  unassigned?: { available: number; reserved: number; sold: number };
}> {
  const q = new URLSearchParams();
  if (variationValueId) q.set("variationValueId", variationValueId);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return authRequest(`/products/${id}/stock${suffix}`);
}

export type InventoryCodeStatus =
  | "available"
  | "reserved"
  | "sold"
  | "disabled";

export type InventoryCodeItem = {
  id: string;
  value: string;
  status: InventoryCodeStatus;
  cost?: number;
  createdAt?: string;
  soldAt?: string;
};

export function listInventoryCodes(
  productId: string,
  params?: {
    status?: InventoryCodeStatus;
    page?: number;
    limit?: number;
    variationValueId?: string;
    search?: string;
  },
): Promise<{
  items: InventoryCodeItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.variationValueId) q.set("variationValueId", params.variationValueId);
  if (params?.search?.trim()) q.set("search", params.search.trim());
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return authRequest(`/products/${productId}/inventory${suffix}`);
}

export function updateInventoryCode(
  productId: string,
  itemId: string,
  input: { value?: string; cost?: number },
): Promise<InventoryCodeItem> {
  return authRequest(`/products/${productId}/inventory/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteInventoryCode(
  productId: string,
  itemId: string,
): Promise<{ available: number; reserved: number; sold: number }> {
  return authRequest(`/products/${productId}/inventory/${itemId}`, {
    method: "DELETE",
  });
}

export function deleteUnassignedInventoryCodes(
  productId: string,
): Promise<{ deleted: number; available: number; reserved: number; sold: number }> {
  return authRequest(`/products/${productId}/inventory/unassigned`, {
    method: "DELETE",
  });
}

export type ReviewStatusValue =
  | "pending"
  | "published"
  | "rejected"
  | "flagged";

export type ProductReview = {
  _id: string;
  productId: string;
  productTitle: string;
  productSlug?: string;
  customerName: string;
  customerEmail?: string;
  rating: number;
  title?: string;
  body: string;
  status: ReviewStatusValue;
  adminReply?: string;
  adminReplyAuthor?: string;
  adminReplyAt?: string;
  orderId?: string;
  createdAt: string;
  updatedAt: string;
};

export async function adminListReviews(params?: {
  search?: string;
  status?: ReviewStatusValue;
  rating?: number;
}): Promise<ProductReview[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  if (params?.rating) q.set("rating", String(params.rating));
  const data = await authRequest<{ items: ProductReview[] }>(
    `/reviews/admin/list?${q.toString()}`,
  );
  return data.items ?? [];
}

export function updateReview(
  id: string,
  input: {
    customerName?: string;
    customerEmail?: string;
    rating?: number;
    title?: string;
    body?: string;
    status?: ReviewStatusValue;
    adminReply?: string;
    createdAt?: string;
  },
): Promise<ProductReview> {
  return authRequest<ProductReview>(`/reviews/admin/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteReview(id: string): Promise<{ success: boolean }> {
  return authRequest(`/reviews/admin/${id}`, { method: "DELETE" });
}

export type PublicProductReview = {
  _id: string;
  customerName: string;
  rating: number;
  title?: string;
  body: string;
  adminReply?: string;
  adminReplyAuthor?: string;
  adminReplyAt?: string;
  createdAt: string;
};

export type ProductReviewsSummary = {
  avg: number;
  count: number;
  distribution: number[];
};

export type ProductReviewsPage = {
  items: PublicProductReview[];
  total: number;
  page: number;
  limit: number;
  summary: ProductReviewsSummary;
};

const PRODUCT_REVIEWS_PAGE_SIZE = 10;
export const ALL_REVIEWS_PAGE_SIZE = 12;

export type PublicReviewListItem = PublicProductReview & {
  productId: string;
  productTitle: string;
  productSlug?: string;
  categoryName?: string;
  categorySlug?: string;
};

export type AllReviewsPage = {
  items: PublicReviewListItem[];
  total: number;
  page: number;
  limit: number;
};

export type ReviewFilterProduct = {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  reviewCount: number;
};

export type ReviewFilterCategory = {
  id: string;
  name: string;
  slug: string;
  reviewCount: number;
};

export type ReviewFilters = {
  products: ReviewFilterProduct[];
  categories: ReviewFilterCategory[];
};

function reviewsApiBase(): string {
  return typeof window === "undefined"
    ? serverApiBase()
    : API_BASE.replace(/\/$/, "");
}

const EMPTY_ALL_REVIEWS_PAGE = (
  page: number,
  limit: number,
): AllReviewsPage => ({
  items: [],
  total: 0,
  page,
  limit,
});

export async function fetchReviewFilters(opts?: {
  cached?: boolean;
  revalidate?: number;
}): Promise<ReviewFilters> {
  const url = `${reviewsApiBase()}/reviews/filters`;
  const fallback: ReviewFilters = { products: [], categories: [] };
  if (opts?.cached) {
    return safeJsonCached<ReviewFilters>(url, fallback, opts.revalidate ?? 300);
  }
  return safeJsonRaw(url, fallback);
}

export async function fetchAllReviews(
  page = 1,
  limit = ALL_REVIEWS_PAGE_SIZE,
  search?: string,
  filters?: { productId?: string; categoryId?: string },
  opts?: { cached?: boolean; revalidate?: number },
): Promise<AllReviewsPage> {
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search?.trim()) {
    q.set("q", search.trim());
  }
  if (filters?.productId) {
    q.set("productId", filters.productId);
  }
  if (filters?.categoryId) {
    q.set("categoryId", filters.categoryId);
  }
  const url = `${reviewsApiBase()}/reviews?${q.toString()}`;
  const fallback = EMPTY_ALL_REVIEWS_PAGE(page, limit);
  if (opts?.cached) {
    return safeJsonCached<AllReviewsPage>(
      url,
      fallback,
      opts.revalidate ?? 120,
    );
  }
  return safeJsonRaw(url, fallback);
}

export async function fetchProductReviews(
  productId: string,
  page = 1,
  limit = PRODUCT_REVIEWS_PAGE_SIZE,
  opts?: { cached?: boolean; revalidate?: number },
): Promise<ProductReviewsPage> {
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const url = `${reviewsApiBase()}/reviews/product/${encodeURIComponent(productId)}?${q.toString()}`;
  const fallback: ProductReviewsPage = {
    items: [],
    total: 0,
    page,
    limit,
    summary: { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] },
  };
  if (opts?.cached) {
    return safeJsonCached<ProductReviewsPage>(url, fallback, opts.revalidate ?? 120);
  }
  return safeJsonRaw(url, fallback);
}

export { PRODUCT_REVIEWS_PAGE_SIZE };

export type ReviewEligibility = {
  canReview: boolean;
  reason:
    | "invalid_product"
    | "already_reviewed"
    | "pending_approval"
    | "not_delivered"
    | "staff"
    | "delivered";
  reviewId?: string;
  status?: ReviewStatusValue;
  orderId?: string;
};

export type SubmittedProductReview = PublicProductReview & {
  status: ReviewStatusValue;
};

export function fetchReviewEligibility(
  productId: string,
): Promise<ReviewEligibility> {
  return authRequest<ReviewEligibility>(
    `/reviews/product/${encodeURIComponent(productId)}/eligibility`,
  );
}

export function submitProductReview(input: {
  productId: string;
  rating: number;
  title?: string;
  body: string;
}): Promise<SubmittedProductReview> {
  return authRequest<SubmittedProductReview>("/reviews", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface CategoryInput {
  name: string;
  slug?: string;
  parentId?: string;
  isActive?: boolean;
  order?: number;
  seo?: Seo;
}

export function createCategory(input: CategoryInput): Promise<Category> {
  return authRequest<Category>("/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
): Promise<Category> {
  return authRequest<Category>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCategory(
  id: string,
  options?: { reassignToCategoryId?: string },
): Promise<{ success: boolean; reassignedProducts?: number }> {
  const q = new URLSearchParams();
  if (options?.reassignToCategoryId) {
    q.set("reassignToCategoryId", options.reassignToCategoryId);
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return authRequest(`/categories/${id}${suffix}`, { method: "DELETE" });
}

export interface Brand {
  _id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  isActive?: boolean;
  seo?: Seo;
}

export interface BrandInput {
  name: string;
  slug?: string;
  logoUrl?: string;
  description?: string;
  isActive?: boolean;
  seo?: Seo;
}

export function listBrands(): Promise<Brand[]> {
  return authRequest<Brand[]>("/brands");
}

export function createBrand(input: BrandInput): Promise<Brand> {
  return authRequest<Brand>("/brands", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBrand(
  id: string,
  input: Partial<BrandInput>,
): Promise<Brand> {
  return authRequest<Brand>(`/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteBrand(id: string): Promise<{ success: boolean }> {
  return authRequest(`/brands/${id}`, { method: "DELETE" });
}

// ---- Cart ----

export interface CartCustomerInput {
  label: string;
  value: string;
}

export interface CartLineItem {
  productId: string;
  title: string;
  slug: string;
  packageName?: string;
  variationValueId?: string;
  customerInputs?: CartCustomerInput[];
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  thumbnail?: string;
  availableStock: number;
}

export interface CartView {
  items: CartLineItem[];
  subtotal: number;
  coupon: { code: string; discount: number; valid: boolean; reason?: string } | null;
  voucher: {
    code: string;
    amount: number;
    applied: number;
    valid: boolean;
    reason?: string;
  } | null;
  discountTotal: number;
  total: number;
  currency: string;
}

export function getCart(): Promise<CartView> {
  return authRequest<CartView>("/cart");
}

/** Always hits the API (no in-flight GET dedupe). Use before placing an order. */
export function getCartFresh(): Promise<CartView> {
  return authRequestRaw<CartView>("/cart");
}

export function addToCart(
  productId: string,
  quantity = 1,
  variationValueId?: string,
  customerInputs?: CartCustomerInput[],
): Promise<CartView> {
  return authRequest<CartView>("/cart/items", {
    method: "POST",
    body: JSON.stringify({
      productId,
      quantity,
      ...(variationValueId ? { variationValueId } : {}),
      ...(customerInputs && customerInputs.length > 0
        ? { customerInputs }
        : {}),
    }),
  });
}

export function updateCartItem(
  productId: string,
  quantity: number,
  variationValueId?: string,
): Promise<CartView> {
  return authRequest<CartView>(`/cart/items/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({
      quantity,
      ...(variationValueId ? { variationValueId } : {}),
    }),
  });
}

export function removeCartItem(
  productId: string,
  variationValueId?: string,
): Promise<CartView> {
  const query = variationValueId
    ? `?variationValueId=${encodeURIComponent(variationValueId)}`
    : "";
  return authRequest<CartView>(`/cart/items/${productId}${query}`, {
    method: "DELETE",
  });
}

export function clearCart(): Promise<CartView> {
  return authRequest<CartView>("/cart", { method: "DELETE" });
}

export function applyCoupon(code: string): Promise<CartView> {
  return authRequest<CartView>("/cart/coupon", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function removeCoupon(): Promise<CartView> {
  return authRequest<CartView>("/cart/coupon", { method: "DELETE" });
}

export function applyVoucher(code: string): Promise<CartView> {
  return authRequest<CartView>("/cart/voucher", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function removeVoucher(): Promise<CartView> {
  return authRequest<CartView>("/cart/voucher", { method: "DELETE" });
}

// ---- Coupons (admin) ----

export type CouponType = "percent" | "fixed";

export interface Coupon {
  _id: string;
  code: string;
  type: CouponType;
  value: number;
  minSubtotal?: number;
  maxDiscount?: number;
  startsAt?: string;
  expiresAt?: string;
  usageLimit?: number;
  perUserLimit?: number;
  usedCount?: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface CouponInput {
  code?: string;
  type: CouponType;
  value: number;
  minSubtotal?: number;
  maxDiscount?: number;
  startsAt?: string;
  expiresAt?: string;
  usageLimit?: number;
  perUserLimit?: number;
  isActive?: boolean;
}

export function listCoupons(): Promise<Coupon[]> {
  return authRequest<Coupon[]>("/coupons");
}

export function createCoupon(input: CouponInput): Promise<Coupon> {
  return authRequest<Coupon>("/coupons", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteCoupon(id: string): Promise<{ success: boolean }> {
  return authRequest(`/coupons/${id}`, { method: "DELETE" });
}

// ---- Vouchers (admin) ----

export interface Voucher {
  _id: string;
  code: string;
  amount: number;
  currency: string;
  status: string;
  assignedUserId?: string;
  expiresAt?: string;
  createdAt?: string;
}

export interface VoucherInput {
  code?: string;
  amount: number;
  currency?: string;
  assignedUserId?: string;
  expiresAt?: string;
}

export function listVouchers(): Promise<Voucher[]> {
  return authRequest<Voucher[]>("/vouchers");
}

export function createVoucher(input: VoucherInput): Promise<Voucher> {
  return authRequest<Voucher>("/vouchers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteVoucher(id: string): Promise<{ success: boolean }> {
  return authRequest(`/vouchers/${id}`, { method: "DELETE" });
}

// ---- Orders ----

export type OrderStatusValue =
  | "pending"
  | "paid"
  | "processing"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "failed";

export type PaymentMethodValue = "wallet" | "manual" | "gateway";

export interface OrderDeliveredCode {
  code: string;
  serial?: string;
  pin?: string;
}

export interface OrderManualGiftCard {
  code: string;
  amount?: string;
  fieldLabel?: string;
  inventoryItemId?: string;
}

export interface OrderLine {
  productId: string;
  title: string;
  slug: string;
  variationValueId?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  deliveryType: string;
  delivered: boolean;
  deliveredCodes?: OrderDeliveredCode[];
  customerInputs?: CartCustomerInput[];
}

export interface OrderTimelineEntry {
  status: OrderStatusValue;
  at: string;
  note?: string;
}

export interface OrderDetail {
  _id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatusValue;
  items: OrderLine[];
  pricing: {
    subtotal: number;
    couponCode?: string;
    couponDiscount: number;
    voucherCode?: string;
    voucherDiscount: number;
    discountTotal: number;
    total: number;
    currency: string;
  };
  payment: {
    method: PaymentMethodValue;
    status: string;
    paidAt?: string;
    mfs?: {
      sender?: string;
      trxId?: string;
      amount?: number;
      senderMobile?: string;
    };
  };
  timeline: OrderTimelineEntry[];
  refund?: { reason?: string; amount?: number; refundedAt?: string };
  deliveredAt?: string;
  deliveryMessage?: string;
  manualGiftCards?: OrderManualGiftCard[];
  createdAt?: string;
  contact?: {
    fullName: string;
    mobile: string;
    email: string;
  };
  /** Present for guest checkout — signed receipt token (not stored in DB). */
  guestReceiptToken?: string;
  origin?: {
    channel?: string;
    customerIp?: string;
    device?: string;
    browser?: string;
    operatingSystem?: string;
    userAgent?: string;
  };
}

export interface OrderListPage {
  items: OrderDetail[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomerOrderStats {
  totalOrders: number;
  totalSpent: number;
  currency: string;
}

export function getOrderStats(): Promise<CustomerOrderStats> {
  return authRequest<CustomerOrderStats>("/orders/stats");
}

export function adminGetCustomerOrderStats(
  userId: string,
): Promise<CustomerOrderStats> {
  return authRequest<CustomerOrderStats>(
    `/orders/admin/customer/${encodeURIComponent(userId)}/stats`,
  );
}

export function resolveOrderId(
  order: { _id?: unknown; id?: unknown } | null | undefined,
): string {
  const raw = order?._id ?? order?.id;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "$oid" in raw) {
    return String((raw as { $oid: string }).$oid);
  }
  return raw != null ? String(raw) : "";
}

function normalizeOrderDetail(raw: Record<string, unknown>): OrderDetail {
  const pricing =
    (raw.pricing as OrderDetail["pricing"] | undefined) ?? {
      subtotal: 0,
      couponDiscount: 0,
      voucherDiscount: 0,
      discountTotal: 0,
      total: 0,
      currency: DEFAULT_CURRENCY,
    };
  const payment =
    (raw.payment as OrderDetail["payment"] | undefined) ?? {
      method: "wallet",
      status: "pending",
    };

  return {
    ...(raw as unknown as OrderDetail),
    _id: resolveOrderId(raw),
    guestReceiptToken:
      typeof raw.guestReceiptToken === "string"
        ? raw.guestReceiptToken
        : undefined,
    items: Array.isArray(raw.items) ? (raw.items as OrderLine[]) : [],
    timeline: Array.isArray(raw.timeline)
      ? (raw.timeline as OrderTimelineEntry[])
      : [],
    pricing,
    payment,
  };
}

export function createOrder(payload?: {
  paymentMethod?: PaymentMethodValue;
  note?: string;
  contact?: {
    fullName: string;
    mobile: string;
    email: string;
  };
}): Promise<OrderDetail> {
  return authRequest<Record<string, unknown>>("/orders", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  }).then(normalizeOrderDetail);
}

export function payOrder(id: string): Promise<OrderDetail> {
  return authRequest<Record<string, unknown>>(`/orders/${id}/pay`, {
    method: "POST",
  }).then(normalizeOrderDetail);
}

export type GuestOrderReceipt = {
  orderNumber: string;
  status: string;
  emailMasked: string;
  paid: boolean;
};

/** Public guest receipt — uses signed token; returns masked email only. */
export async function getGuestOrderReceipt(
  token: string,
): Promise<GuestOrderReceipt | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const url = `${API_BASE}/orders/guest/receipt?${new URLSearchParams({ token: trimmed })}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) await throwApiError(res);
  return (await res.json()) as GuestOrderReceipt;
}

export type PaymentPurposeValue = "order" | "wallet_topup";

export type PaymentIntentStatusValue =
  | "created"
  | "initializing"
  | "pending"
  | "succeeded"
  | "failed"
  | "expired"
  | "superseded"
  | "unmatched";

export interface PaymentIntentResult {
  intentId: string;
  gateway: string;
  status: PaymentIntentStatusValue;
  amount: number;
  currency: string;
  checkoutUrl?: string;
}

export function createPayment(payload: {
  gateway: "mfs" | PaymentGatewayId;
  purpose: PaymentPurposeValue;
  amount: number;
  orderId?: string;
  currency?: string;
  idempotencyKey?: string;
}): Promise<PaymentIntentResult> {
  return authRequest<PaymentIntentResult>("/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPaymentIntent(id: string): Promise<PaymentIntentResult> {
  return authRequest<PaymentIntentResult>(`/payments/${id}`);
}

export function verifyPaymentIntent(id: string): Promise<PaymentIntentResult> {
  return authRequest<PaymentIntentResult>(`/payments/${id}/verify`, {
    method: "POST",
  });
}

// ---- Manual MFS (bKash/Nagad) ----

export type MfsProviderId = "bkash" | "nagad" | "rocket" | "upay";

export interface MfsGateway {
  id: string;
  name: string;
  provider: MfsProviderId;
  providerLabel: string;
  phoneNumber: string;
  qrCodeUrl?: string;
  minAmount: number;
  maxAmount: number;
  isActive: boolean;
  sortOrder: number;
  instructions?: string;
  defaultInstructions: string;
}

export interface MfsCheckoutOrderItem {
  itemIndex: number;
  productId?: string;
  slug?: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  customerInputs: { label: string; value: string }[];
}

export interface MfsCheckoutSummary {
  purpose: "order" | "wallet_topup";
  title: string;
  orderNumber?: string;
  orderId?: string;
  amount: number;
  currency: string;
  items?: MfsCheckoutOrderItem[];
  subtotal?: number;
  discountTotal?: number;
  couponCode?: string;
  voucherCode?: string;
  contact?: { fullName: string; mobile: string; email: string };
  note?: string;
}

export interface MfsCheckoutSession {
  intentId: string;
  status: PaymentIntentStatusValue;
  amount: number;
  currency: string;
  orderId?: string;
  selectedGateway?: MfsGateway;
  gateways: MfsGateway[];
  submittedTrxId?: string;
  redirectUrl?: string;
  summary?: MfsCheckoutSummary;
}

export interface SmsLogRow {
  _id: string;
  sender?: string;
  body: string;
  trxId?: string;
  amount?: number;
  status: "unmatched" | "matched" | "ignored";
  matchedPaymentIntentId?: string;
  smsTimestamp?: string;
  createdAt?: string;
}

export interface MfsGatewayInput {
  name: string;
  provider: MfsProviderId;
  phoneNumber: string;
  qrCodeUrl?: string;
  minAmount?: number;
  maxAmount?: number;
  isActive?: boolean;
  sortOrder?: number;
  instructions?: string;
}

export function listActiveMfsGateways(): Promise<MfsGateway[]> {
  return authRequest<MfsGateway[]>("/payments/mfs/gateways");
}

export function getMfsCheckoutSession(
  intentId: string,
): Promise<MfsCheckoutSession> {
  return authRequest<MfsCheckoutSession>(`/payments/mfs/checkout/${intentId}`);
}

export function selectMfsGateway(
  intentId: string,
  gatewayId: string,
): Promise<MfsCheckoutSession> {
  return authRequest<MfsCheckoutSession>(
    `/payments/mfs/checkout/${intentId}/gateway`,
    {
      method: "POST",
      body: JSON.stringify({ gatewayId }),
    },
  );
}

export function resetMfsGateway(
  intentId: string,
): Promise<MfsCheckoutSession> {
  return authRequest<MfsCheckoutSession>(
    `/payments/mfs/checkout/${intentId}/reset-gateway`,
    { method: "POST" },
  );
}

export function updateMfsCheckoutItem(
  intentId: string,
  itemIndex: number,
  quantity: number,
): Promise<MfsCheckoutSession> {
  return authRequest<MfsCheckoutSession>(
    `/payments/mfs/checkout/${intentId}/items/${itemIndex}`,
    {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    },
  );
}

export function removeMfsCheckoutItem(
  intentId: string,
  itemIndex: number,
): Promise<MfsCheckoutSession> {
  return authRequest<MfsCheckoutSession>(
    `/payments/mfs/checkout/${intentId}/items/${itemIndex}`,
    { method: "DELETE" },
  );
}

export function submitMfsTrxId(
  intentId: string,
  trxId: string,
): Promise<MfsCheckoutSession> {
  return authRequest<MfsCheckoutSession>(
    `/payments/mfs/checkout/${intentId}/trx`,
    {
      method: "POST",
      body: JSON.stringify({ trxId }),
    },
  );
}

export function listAdminMfsGateways(): Promise<MfsGateway[]> {
  return authRequest<MfsGateway[]>("/payments/admin/mfs/gateways");
}

export function createAdminMfsGateway(
  payload: MfsGatewayInput,
): Promise<MfsGateway> {
  return authRequest<MfsGateway>("/payments/admin/mfs/gateways", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminMfsGateway(
  id: string,
  payload: Partial<MfsGatewayInput>,
): Promise<MfsGateway> {
  return authRequest<MfsGateway>(`/payments/admin/mfs/gateways/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminMfsGateway(id: string): Promise<{ ok: boolean }> {
  return authRequest<{ ok: boolean }>(`/payments/admin/mfs/gateways/${id}`, {
    method: "DELETE",
  });
}

export function uploadMfsQrCode(file: File): Promise<{ url: string }> {
  const MFS_QR_MAX_BYTES = 2 * 1024 * 1024;
  const MFS_QR_NAME = /\.(jpe?g|png|webp|gif)$/i;

  if (file.size > MFS_QR_MAX_BYTES) {
    throw new ApiError("QR image must be 2 MB or smaller.", 400);
  }
  if (!MFS_QR_NAME.test(file.name)) {
    throw new ApiError("QR image must be JPG, PNG, WebP, or GIF.", 400);
  }

  const form = new FormData();
  form.append("file", file);

  const run = () => {
    return fetch(`${API_BASE}/payments/admin/mfs/gateways/qr-upload`, {
      method: "POST",
      body: form,
      cache: "no-store",
      credentials: "include",
    });
  };

  return (async () => {
    const res = await fetchWithAuthRetry(run);
    if (!res.ok) await throwApiError(res);
    return parseUploadUrlJson<{ url: string }>(res);
  })();
}

export function listAdminSmsLogs(
  status?: string,
  trxId?: string,
): Promise<SmsLogRow[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (trxId?.trim()) params.set("trxId", trxId.trim());
  const q = params.toString();
  return authRequest<SmsLogRow[]>(
    `/payments/admin/mfs/sms-logs${q ? `?${q}` : ""}`,
  );
}

export function deleteAdminSmsLog(
  id: string,
  trxId?: string,
): Promise<{ deleted: number }> {
  const ids = id?.trim() ? [id.trim()] : [];
  const trxIds = trxId?.trim() ? [trxId.trim()] : undefined;
  return bulkDeleteAdminSmsLogs(ids, trxIds);
}

export function bulkDeleteAdminSmsLogs(
  ids: string[],
  trxIds?: string[],
): Promise<{ deleted: number }> {
  const body: { ids?: string[]; trxIds?: string[] } = {};
  const cleanIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const cleanTrx = trxIds
    ? [...new Set(trxIds.map((trx) => trx.trim()).filter(Boolean))]
    : [];
  if (cleanIds.length > 0) body.ids = cleanIds;
  if (cleanTrx.length > 0) body.trxIds = cleanTrx;
  return authRequest("/payments/admin/mfs/sms-logs/bulk-delete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAdminSmsLogStatus(
  id: string,
  status: SmsLogRow["status"],
): Promise<SmsLogRow> {
  return authRequest<SmsLogRow>(`/payments/admin/mfs/sms-logs/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function bulkUpdateAdminSmsLogsStatus(
  ids: string[],
  status: SmsLogRow["status"],
): Promise<{ updated: number }> {
  return authRequest("/payments/admin/mfs/sms-logs/bulk-status", {
    method: "POST",
    body: JSON.stringify({ ids, status }),
  });
}

export function listAdminMfsIntents(status?: string): Promise<
  Array<{
    _id: string;
    userId: string;
    amount: number;
    currency: string;
    status: PaymentIntentStatusValue;
    submittedTrxId?: string;
    orderId?: string;
    createdAt?: string;
  }>
> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return authRequest(`/payments/admin/mfs/intents${q}`);
}

export function approveAdminMfsIntent(
  id: string,
  reason: string,
): Promise<MfsCheckoutSession> {
  return authRequest<MfsCheckoutSession>(
    `/payments/admin/mfs/intents/${id}/approve`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export interface MfsSmsProviderFormat {
  provider: MfsProviderId;
  enabled: boolean;
  priority: number;
  detectKeywords: string[];
  detectPatterns: string[];
  trxIdPatterns: string[];
  amountPatterns: string[];
  sampleSms: string;
}

export interface MfsSmsFormatsConfig {
  providers: MfsSmsProviderFormat[];
  updatedAt?: string;
}

export interface MfsSmsParseTestResult {
  provider: string;
  trxId?: string;
  amount?: number;
  allowed: boolean;
}

export function getAdminMfsSmsFormats(): Promise<MfsSmsFormatsConfig> {
  return authRequest<MfsSmsFormatsConfig>("/payments/admin/mfs/sms-formats");
}

export function updateAdminMfsSmsFormats(
  providers: MfsSmsProviderFormat[],
): Promise<MfsSmsFormatsConfig> {
  return authRequest<MfsSmsFormatsConfig>("/payments/admin/mfs/sms-formats", {
    method: "PUT",
    body: JSON.stringify({ providers }),
  });
}

export function resetAdminMfsSmsFormats(): Promise<MfsSmsFormatsConfig> {
  return authRequest<MfsSmsFormatsConfig>(
    "/payments/admin/mfs/sms-formats/reset",
    { method: "POST" },
  );
}

export function testAdminMfsSmsFormat(payload: {
  sms: string;
  sender?: string;
}): Promise<MfsSmsParseTestResult> {
  return authRequest<MfsSmsParseTestResult>(
    "/payments/admin/mfs/sms-formats/test",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function listOrders(page = 1, limit = 20): Promise<OrderListPage> {
  return authRequest<{ items: Record<string, unknown>[]; total: number; page: number; limit: number }>(
    `/orders?page=${page}&limit=${limit}`,
  ).then((page) => ({
    ...page,
    items: page.items.map(normalizeOrderDetail),
  }));
}

export function getOrder(id: string): Promise<OrderDetail> {
  return authRequest<Record<string, unknown>>(`/orders/${id}`).then(
    normalizeOrderDetail,
  );
}

export interface AdminOrderFilters {
  status?: OrderStatusValue;
  q?: string;
  page?: number;
  limit?: number;
}

export function adminListOrders(
  filters: AdminOrderFilters = {},
): Promise<OrderListPage> {
  const q = new URLSearchParams();
  q.set("page", String(filters.page ?? 1));
  q.set("limit", String(filters.limit ?? 20));
  if (filters.status) q.set("status", filters.status);
  if (filters.q) q.set("q", filters.q);
  return authRequest<OrderListPage>(`/orders/admin/list?${q.toString()}`);
}

export function adminDeleteOrder(id: string): Promise<{ deleted: boolean }> {
  return authRequest<{ deleted: boolean }>(`/orders/admin/${id}`, {
    method: "DELETE",
  });
}

export function restoreOrder(id: string): Promise<OrderDetail> {
  return authRequest<OrderDetail>(`/orders/admin/${id}/restore`, {
    method: "POST",
  });
}

// ── Order edit locks ──────────────────────────────────────────────────────

export interface OrderLockInfo {
  orderId: string;
  userId: string;
  userName: string;
  lockedAt: string;
}

export interface AcquireLockResult {
  acquired: boolean;
  lock?: OrderLockInfo;
}

/** Try to acquire an edit lock on an order before opening its detail page. */
export function acquireOrderLock(
  orderId: string,
  userName: string,
): Promise<AcquireLockResult> {
  return authRequest<AcquireLockResult>(`/orders/${orderId}/lock`, {
    method: "POST",
    body: JSON.stringify({ userName }),
  });
}

/** Release the lock when leaving the order detail page. */
export function releaseOrderLock(orderId: string): Promise<void> {
  return authRequest<void>(`/orders/${orderId}/lock`, { method: "DELETE" });
}

/** Heartbeat — extend the lock TTL while still editing the order. */
export function refreshOrderLock(orderId: string): Promise<boolean> {
  return authRequest<boolean>(`/orders/${orderId}/lock/refresh`, {
    method: "POST",
  });
}

/** Get all currently active order edit locks (for the list view). */
export function getOrderLocks(): Promise<OrderLockInfo[]> {
  return authRequest<OrderLockInfo[]>("/orders/admin/locks");
}

export function updateOrderStatus(
  id: string,
  status: OrderStatusValue,
  note?: string,
  deliveryMessage?: string,
  emailChannel?: EmailSenderChannel,
  giftCards?: OrderManualGiftCard[],
): Promise<OrderDetail> {
  return authRequest<OrderDetail>(`/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      note,
      deliveryMessage,
      emailChannel,
      giftCards,
    }),
  });
}

export function saveOrderManualDelivery(
  id: string,
  payload: {
    giftCards?: OrderManualGiftCard[];
    deliveryMessage?: string;
  },
): Promise<OrderDetail> {
  // Explicitly pick only the fields the backend DTO allows so that extra
  // properties (e.g. emailChannel from a full AdminOrderCompletePayload)
  // are never serialised and don't trigger forbidNonWhitelisted errors.
  return authRequest<OrderDetail>(`/orders/${id}/manual-delivery`, {
    method: "PATCH",
    body: JSON.stringify({
      giftCards: payload.giftCards,
      deliveryMessage: payload.deliveryMessage,
    }),
  });
}

export function sendOrderNote(
  id: string,
  message: string,
  emailChannel?: EmailSenderChannel,
): Promise<OrderDetail> {
  return authRequest<OrderDetail>(`/orders/${id}/note`, {
    method: "PATCH",
    body: JSON.stringify({ message, emailChannel }),
  });
}

export function refundOrder(
  id: string,
  reason?: string,
): Promise<{ queued: boolean }> {
  return authRequest(`/orders/${id}/refund`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ---- System status (admin) ----

export interface RedisMetrics {
  version?: string;
  uptimeSeconds?: number;
  usedMemoryMb: number;
  peakMemoryMb: number;
  maxMemoryMb: number;
  memoryUsagePercent?: number;
  connectedClients: number;
  opsPerSec: number;
  hitRate?: number;
  totalKeys: number;
}

export interface SystemStatus {
  status: string;
  timestamp?: string;
  uptimeSeconds?: number;
  memory?: { heapUsedMb: number; heapTotalMb: number; rssMb: number };
  node?: string;
  apis?: {
    totalEndpoints: number;
    totalControllers: number;
    globalPrefix: string;
    byMethod: Record<string, number>;
    controllers?: {
      name: string;
      path: string;
      routes: number;
    }[];
    version?: {
      api: string;
      nestjs: string;
      swagger: string;
      openapi: string;
      environment: string;
      port: number;
      publicUrl: string;
      docsPath: string;
      docsEnabled: boolean;
    };
  };
  database: { ok: boolean; state?: string; latencyMs?: number; error?: string };
  redis: {
    ok: boolean;
    state?: string;
    latencyMs?: number;
    error?: string;
    metrics?: RedisMetrics;
  };
  queues: Record<
    string,
    {
      ok: boolean;
      waiting?: number;
      active?: number;
      completed?: number;
      failed?: number;
      delayed?: number;
      redisOffline?: boolean;
      error?: string;
    }
  >;
}

export function getSystemStatus(): Promise<SystemStatus> {
  return authRequest<SystemStatus>("/admin/dashboard/status");
}

// ---- Suppliers (admin) ----

export type SupplierCode =
  | "reloadly"
  | "xsolla"
  | "turgame"
  | "foxreload";

export type SupplierStatus = "active" | "disabled";

export type SupplierStockStatus = "in_stock" | "out_of_stock" | "unknown";

export interface Supplier {
  _id: string;
  code: SupplierCode;
  name: string;
  status: SupplierStatus;
  priority: number;
  supportedRegions: string[];
  supportedCurrencies: string[];
  lastBalance?: number;
  lastBalanceCurrency?: string;
  lastHealthyAt?: string;
  lastError?: string;
}

export interface SupplierInput {
  code: SupplierCode;
  name: string;
  status?: SupplierStatus;
  priority?: number;
  supportedRegions?: string[];
  supportedCurrencies?: string[];
}

export interface SupplierUpdate {
  name?: string;
  status?: SupplierStatus;
  priority?: number;
  supportedRegions?: string[];
  supportedCurrencies?: string[];
}

export interface SupplierOffering {
  _id: string;
  supplierCode: SupplierCode;
  productId?: string;
  sku?: string;
  externalProductId: string;
  cost: number;
  currency: string;
  region?: string;
  enabled: boolean;
  stockStatus: SupplierStockStatus;
  priority?: number;
}

export interface OfferingInput {
  supplierCode: SupplierCode;
  productId?: string;
  sku?: string;
  externalProductId: string;
  cost: number;
  currency?: string;
  region?: string;
  priority?: number;
  enabled?: boolean;
  stockStatus?: SupplierStockStatus;
}

export interface OfferingUpdate {
  externalProductId?: string;
  cost?: number;
  currency?: string;
  region?: string;
  priority?: number;
  enabled?: boolean;
  stockStatus?: SupplierStockStatus;
}

export function listSuppliers(): Promise<Supplier[]> {
  return authRequest<Supplier[]>("/suppliers");
}

export function upsertSupplier(input: SupplierInput): Promise<Supplier> {
  return authRequest<Supplier>("/suppliers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSupplier(
  code: SupplierCode,
  input: SupplierUpdate,
): Promise<Supplier> {
  return authRequest<Supplier>(`/suppliers/${code}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function refreshSupplierBalance(
  code: SupplierCode,
): Promise<{ balance: number; currency: string }> {
  return authRequest(`/suppliers/${code}/balance`);
}

export function listOfferings(productId?: string): Promise<SupplierOffering[]> {
  const q = productId ? `?productId=${productId}` : "";
  return authRequest<SupplierOffering[]>(`/suppliers/offerings${q}`);
}

export function createOffering(input: OfferingInput): Promise<SupplierOffering> {
  return authRequest<SupplierOffering>("/suppliers/offerings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateOffering(
  id: string,
  input: OfferingUpdate,
): Promise<SupplierOffering> {
  return authRequest<SupplierOffering>(`/suppliers/offerings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteOffering(id: string): Promise<{ deleted: boolean }> {
  return authRequest(`/suppliers/offerings/${id}`, { method: "DELETE" });
}

// ---- Auto delivery (admin) ----

export interface CustomOrderFieldConfig {
  label: string;
  enabled: boolean;
  messages: string[];
  regions?: string[];
}

export interface SavedDeliveryNoteConfig {
  label: string;
  enabled: boolean;
  note: string;
}

export interface DeliverySettings {
  customOrderFields: CustomOrderFieldConfig[];
  savedDeliveryNotes: SavedDeliveryNoteConfig[];
  updatedAt?: string;
}

export interface DeliveryOverview {
  pipeline: Array<{
    key: string;
    label: string;
    description: string;
  }>;
  customOrderFields?: {
    total: number;
    enabled: number;
  };
  retryStrategy: {
    attempts: number;
    backoff: { type: string; delay: number };
    removeOnComplete: number;
    removeOnFail: number;
  };
  queue: {
    ok: boolean;
    name: string;
    waiting?: number;
    active?: number;
    completed?: number;
    failed?: number;
    delayed?: number;
    error?: string;
  };
  redis: { ok: boolean; state?: string; error?: string };
  supplierAttempts: Array<{
    id: string;
    orderId?: string;
    supplierCode: string;
    status: string;
    attempt: number;
    error?: string;
    createdAt?: string;
  }>;
  failedJobs: Array<{
    id: string;
    orderId: string;
    attemptsMade: number;
    failedReason?: string;
    finishedOn?: number;
  }>;
}

export function getDeliveryOverview(): Promise<DeliveryOverview> {
  return authRequest<DeliveryOverview>("/delivery/admin/overview");
}

export function retryDelivery(
  orderId: string,
): Promise<{ queued: boolean }> {
  return authRequest(`/delivery/admin/retry/${orderId}`, { method: "POST" });
}

export function getDeliverySettings(): Promise<DeliverySettings> {
  return authRequest<DeliverySettings>("/delivery/admin/settings");
}

export function updateDeliverySettings(
  patch: Partial<
    Pick<DeliverySettings, "customOrderFields" | "savedDeliveryNotes">
  >,
): Promise<DeliverySettings> {
  return authRequest<DeliverySettings>("/delivery/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ---- Payment gateway settings ----

export type PaymentGatewayId =
  | "bkash"
  | "nagad"
  | "rocket"
  | "upay"
  | "uddoktapay";

export type PaymentGatewayMode = "live" | "sandbox" | "disabled" | "misconfigured";

export interface PaymentGatewaySettingsView {
  id: PaymentGatewayId;
  label: string;
  hint: string;
  enabled: boolean;
  sandbox: boolean;
  configured: boolean;
  mode: PaymentGatewayMode;
  baseUrl?: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasWebhookSecret: boolean;
  hasUsername: boolean;
  hasPassword: boolean;
  apiKeyFromEnv: boolean;
  apiSecretFromEnv: boolean;
  webhookSecretFromEnv: boolean;
  usernameFromEnv: boolean;
  passwordFromEnv: boolean;
}

export interface PaymentGatewaySettings {
  defaultGateway: PaymentGatewayId;
  callbackBaseUrl: string;
  appUrl: string;
  gateways: PaymentGatewaySettingsView[];
  updatedAt?: string;
}

export interface PaymentGatewayOverview {
  callbackBaseUrl: string;
  appUrl: string;
  defaultGateway: PaymentGatewayId;
  configuredCount: number;
  enabledCount: number;
  liveCount: number;
  intents24h: number;
  succeeded24h: number;
  failed24h: number;
  gateways: Array<{
    id: PaymentGatewayId;
    label: string;
    enabled: boolean;
    configured: boolean;
    sandbox: boolean;
    mode: PaymentGatewayMode;
  }>;
}

export type PaymentGatewaySettingsPatch = Partial<{
  defaultGateway: PaymentGatewayId;
  bkash: Partial<GatewayFormPatch>;
  nagad: Partial<GatewayFormPatch>;
  rocket: Partial<GatewayFormPatch>;
  upay: Partial<GatewayFormPatch>;
  uddoktapay: Partial<GatewayFormPatch>;
}>;

export type GatewayFormPatch = {
  enabled: boolean;
  sandbox: boolean;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  username: string;
  password: string;
};

export function getPaymentGatewayOverview(): Promise<PaymentGatewayOverview> {
  return authRequest<PaymentGatewayOverview>("/payments/admin/overview");
}

export function getPaymentGatewaySettings(): Promise<PaymentGatewaySettings> {
  return authRequest<PaymentGatewaySettings>("/payments/admin/settings");
}

export function updatePaymentGatewaySettings(
  patch: PaymentGatewaySettingsPatch,
): Promise<PaymentGatewaySettings> {
  return authRequest<PaymentGatewaySettings>("/payments/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ---- Live chat ----

export type ChatRoomStatus = "open" | "closed";
export type ChatRoomType = "support" | "direct";

export interface ChatRoomCustomer {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  phone?: string;
}

export interface ChatRoom {
  id?: string;
  _id?: string;
  type: ChatRoomType;
  status: ChatRoomStatus;
  subject?: string;
  participants: string[];
  createdBy?: string;
  customer?: ChatRoomCustomer;
  assignedAdminId?: string;
  /** Customer message not yet seen by any staff — admin inbox highlight */
  unreadFromCustomer?: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt?: string;
}

export interface ChatMessage {
  id?: string;
  _id?: string;
  roomId: string;
  senderId: string;
  senderRole: string;
  senderName?: string;
  /** Profile firstName — set for staff senders; use this for the chat label. */
  senderFirstName?: string;
  body: string;
  imageUrl?: string;
  createdAt?: string;
}

export interface ChatHistory {
  items: ChatMessage[];
  total: number;
  page: number;
  limit: number;
}

export interface ChatAdminOverview {
  openRooms: number;
  closedRooms: number;
  totalMessages: number;
  namespace: string;
  transport: string;
}

export function getStaffChatUnreadCount(): Promise<{ count: number }> {
  return authRequest<{ count: number }>("/chat/unread-customer-count");
}

export function listChatRooms(
  page = 1,
  limit = 50,
  search?: string,
): Promise<ChatRoom[]> {
  const q = search?.trim()
    ? `&q=${encodeURIComponent(search.trim())}`
    : "";
  return authRequest<ChatRoom[]>(`/chat/rooms?page=${page}&limit=${limit}${q}`);
}

export function openSupportRoom(): Promise<ChatRoom> {
  return authRequest<ChatRoom>("/chat/rooms/support", { method: "POST" });
}

export function startGuestChatSession(name?: string): Promise<{
  accessToken: string;
  csrfToken?: string;
  refreshToken?: string;
  expiresIn: number;
  user: { id: string; email: string; roles: string[]; isGuest: boolean };
}> {
  return safeJsonRaw(
    `${API_BASE}/chat/guest-session`,
    null as never,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name ?? "Guest" }),
      cache: "no-store",
    },
  );
}

/** API pagination caps limit at 100; load older pages for long threads. */
const CHAT_HISTORY_PAGE_SIZE = 100;
const CHAT_HISTORY_MAX_PAGES = 15;

export function getChatHistory(
  roomId: string,
  page = 1,
  limit = 50,
): Promise<ChatHistory> {
  return authRequest<ChatHistory>(
    `/chat/rooms/${roomId}/messages?page=${page}&limit=${limit}`,
  );
}

export async function fetchFullChatHistory(roomId: string): Promise<ChatHistory> {
  const limit = CHAT_HISTORY_PAGE_SIZE;
  const pageBatches: ChatMessage[][] = [];
  let total = 0;
  let page = 1;
  while (page <= CHAT_HISTORY_MAX_PAGES) {
    const hist = await getChatHistory(roomId, page, limit);
    total = hist.total;
    pageBatches.push(hist.items);
    if (page * limit >= total || hist.items.length < limit) {
      break;
    }
    page += 1;
  }
  const items = pageBatches.reverse().flat();
  return { items, total, page: 1, limit: items.length };
}

export function getCustomerSupportHistory(
  page = 1,
  limit = 100,
): Promise<ChatHistory> {
  return authRequest<ChatHistory>(
    `/chat/rooms/support/history?page=${page}&limit=${limit}`,
  );
}

/** Merged customer support thread (all duplicate rooms) — one fast API query per page. */
export async function fetchFullCustomerSupportHistory(): Promise<ChatHistory> {
  const limit = CHAT_HISTORY_PAGE_SIZE;
  const pageBatches: ChatMessage[][] = [];
  let total = 0;
  let page = 1;
  while (page <= CHAT_HISTORY_MAX_PAGES) {
    const hist = await getCustomerSupportHistory(page, limit);
    total = hist.total;
    pageBatches.push(hist.items);
    if (page * limit >= total || hist.items.length < limit) {
      break;
    }
    page += 1;
  }
  const items = pageBatches.reverse().flat();
  return { items, total, page: 1, limit: items.length };
}

export function sendChatMessage(
  roomId: string,
  body?: string,
  imageUrl?: string,
): Promise<{ ok: boolean; id?: string; message?: ChatMessage; error?: string }> {
  return authRequest(`/chat/rooms/${roomId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      ...(body?.trim() ? { body: body.trim() } : {}),
      ...(imageUrl?.trim() ? { imageUrl: imageUrl.trim() } : {}),
    }),
  });
}

const LIVE_CHAT_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

const LIVE_CHAT_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function liveChatMimeFromName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return ext ? (map[ext] ?? null) : null;
}

export async function uploadChatImage(
  roomId: string,
  file: File,
): Promise<{ url: string; filename: string }> {
  if (file.size > LIVE_CHAT_UPLOAD_MAX_BYTES) {
    throw new ApiError("Chat image must be 8 MB or smaller.", 400);
  }
  const mime = file.type || liveChatMimeFromName(file.name) || "";
  if (!LIVE_CHAT_UPLOAD_MIME.has(mime)) {
    throw new ApiError("Chat image must be JPG, PNG, WebP, or GIF.", 400);
  }

  const form = new FormData();
  form.append("file", file);

  const run = () => {
    return fetch(`${API_BASE}/chat/rooms/${roomId}/image-upload`, {
      method: "POST",
      body: form,
      cache: "no-store",
      credentials: "include",
    });
  };

  const res = await fetchWithAuthRetry(run);
  if (!res.ok) await throwApiError(res);
  return parseUploadUrlJson<{ url: string; filename: string }>(res);
}

export function markChatRead(roomId: string): Promise<{ success: boolean }> {
  return authRequest(`/chat/rooms/${roomId}/read`, { method: "POST" }).then(
    (result) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("notification-change"));
      }
      return result as { success: boolean };
    },
  );
}

export function getOnlineUsers(): Promise<string[]> {
  return authRequest<string[]>("/chat/online");
}

export interface ChatSupportAgent {
  id: string;
  displayName: string;
  avatarUrl?: string;
  firstName?: string;
}

export function getOnlineSupportStaff(): Promise<ChatSupportAgent[]> {
  return authRequest<ChatSupportAgent[]>("/chat/support-online");
}

export function getChatAdminOverview(): Promise<ChatAdminOverview> {
  return authRequest<ChatAdminOverview>("/chat/admin/overview");
}

export function updateChatRoomStatus(
  roomId: string,
  status: ChatRoomStatus,
): Promise<ChatRoom> {
  return authRequest<ChatRoom>(`/chat/rooms/${roomId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export interface ChatQuickReply {
  id: string;
  label: string;
  category: string;
  body: string;
  enabled: boolean;
  sortOrder: number;
}

export interface ChatQuickRepliesResponse {
  quickReplies: ChatQuickReply[];
  updatedAt?: string;
}

export function getChatQuickReplies(): Promise<ChatQuickRepliesResponse> {
  return authRequest<ChatQuickRepliesResponse>("/chat/admin/quick-replies");
}

export function updateChatQuickReplies(
  quickReplies: ChatQuickReply[],
): Promise<ChatQuickRepliesResponse> {
  return authRequest<ChatQuickRepliesResponse>("/chat/admin/quick-replies", {
    method: "PUT",
    body: JSON.stringify({ quickReplies }),
  });
}

export interface ChatWelcomeAutoReply {
  enabled: boolean;
  message: string;
  updatedAt?: string;
}

export function getChatWelcomeAutoReply(): Promise<ChatWelcomeAutoReply> {
  return authRequest<ChatWelcomeAutoReply>(
    "/chat/admin/welcome-auto-reply",
  );
}

export function updateChatWelcomeAutoReply(input: {
  enabled: boolean;
  message: string;
}): Promise<ChatWelcomeAutoReply> {
  return authRequest<ChatWelcomeAutoReply>(
    "/chat/admin/welcome-auto-reply",
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export interface ChatStaffQuickRepliesResponse {
  quickReplies: ChatQuickReply[];
}

export function getChatStaffQuickReplies(): Promise<ChatStaffQuickRepliesResponse> {
  return authRequest<ChatStaffQuickRepliesResponse>("/chat/staff/quick-replies");
}

export function deleteChatRoom(
  roomId: string,
): Promise<{ success: boolean }> {
  return authRequest(`/chat/rooms/${roomId}`, { method: "DELETE" });
}

export function roomId(room: ChatRoom): string {
  return room.id ?? room._id ?? "";
}

// ---- Tickets ----

export type TicketStatus =
  | "open"
  | "in_progress"
  | "pending"
  | "resolved"
  | "closed";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface Ticket {
  _id: string;
  ticketNumber: string;
  userId: string;
  subject: string;
  category?: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedAdminId?: string;
  lastReplyAt?: string;
  lastReplyBy?: string;
  closedAt?: string;
  createdAt?: string;
}

export interface TicketMessage {
  _id: string;
  ticketId: string;
  senderId: string;
  senderRole: string;
  body: string;
  internal?: boolean;
  createdAt?: string;
}

export interface TicketListPage {
  items: Ticket[];
  total: number;
  page: number;
  limit: number;
}

export interface TicketMessagesPage {
  items: TicketMessage[];
  total: number;
  page: number;
  limit: number;
}

export interface TicketOverview {
  total: number;
  open: number;
  inProgress: number;
  pending: number;
  resolved: number;
  closed: number;
  unassigned: number;
}

export interface StaffMember {
  id: string;
  email: string;
  displayName?: string;
}

export function createTicket(input: {
  subject: string;
  body: string;
  category?: string;
  priority?: TicketPriority;
}): Promise<Ticket> {
  return authRequest<Ticket>("/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listTickets(params?: {
  status?: TicketStatus;
  assignedToMe?: boolean;
  page?: number;
  limit?: number;
}): Promise<TicketListPage> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 20));
  if (params?.status) q.set("status", params.status);
  if (params?.assignedToMe) q.set("assignedToMe", "true");
  return authRequest<TicketListPage>(`/tickets?${q.toString()}`);
}

export function getTicket(id: string): Promise<Ticket> {
  return authRequest<Ticket>(`/tickets/${id}`);
}

export function getTicketMessages(
  id: string,
  page = 1,
  limit = 100,
): Promise<TicketMessagesPage> {
  return authRequest<TicketMessagesPage>(
    `/tickets/${id}/messages?page=${page}&limit=${limit}`,
  );
}

export function replyTicket(
  id: string,
  body: string,
  internal?: boolean,
): Promise<TicketMessage> {
  return authRequest<TicketMessage>(`/tickets/${id}/reply`, {
    method: "POST",
    body: JSON.stringify({ body, internal }),
  });
}

export function updateTicketStatus(
  id: string,
  status: TicketStatus,
): Promise<Ticket> {
  return authRequest<Ticket>(`/tickets/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function assignTicket(id: string, adminId: string): Promise<Ticket> {
  return authRequest<Ticket>(`/tickets/${id}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ adminId }),
  });
}

export function getTicketOverview(): Promise<TicketOverview> {
  return authRequest<TicketOverview>("/tickets/admin/overview");
}

export function listStaff(): Promise<StaffMember[]> {
  return authRequest<StaffMember[]>("/tickets/admin/staff");
}

// ---- Affiliates ----

export type AffiliateStatus = "active" | "disabled";

export type AffiliateCommissionStatus =
  | "pending"
  | "paid"
  | "rejected"
  | "reversed";

export interface AffiliateRecord {
  _id: string;
  userId: string;
  code: string;
  status: AffiliateStatus;
  commissionRate: number;
  clicks: number;
  signups: number;
  conversions: number;
  totalEarned: number;
  totalPending: number;
  createdAt?: string;
}

export interface AffiliateDashboard {
  affiliate: AffiliateRecord;
  referralCode: string;
  referralLink: string;
}

export interface AffiliateCommission {
  _id: string;
  affiliateId: string;
  affiliateUserId: string;
  referredUserId: string;
  orderId: string;
  baseAmount: number;
  rate: number;
  amount: number;
  currency: string;
  status: AffiliateCommissionStatus;
  paidAt?: string;
  note?: string;
  createdAt?: string;
}

export interface AffiliateListPage {
  items: AffiliateRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface AffiliateCommissionPage {
  items: AffiliateCommission[];
  total: number;
  page: number;
  limit: number;
}

export interface AffiliatePayoutTotals {
  pending: number;
  paid: number;
  rejected: number;
  reversed: number;
  count: number;
}

export interface AffiliatePayoutReport {
  totals: AffiliatePayoutTotals;
  affiliates: Array<AffiliatePayoutTotals & { affiliateId: string }>;
}

export interface AffiliateAdminOverview {
  affiliates: { total: number; active: number; disabled: number };
  tracking: { clicks: number; signups: number; conversions: number };
  payouts: AffiliatePayoutTotals;
  defaultCommissionRate: number;
  referralLinkTemplate: string;
}

export interface AdminAffiliateRow {
  _id: string;
  userId: string;
  email?: string;
  displayName?: string;
  code: string;
  status: AffiliateStatus;
  commissionRate: number;
  clicks: number;
  signups: number;
  conversions: number;
  totalEarned: number;
  totalPending: number;
  createdAt?: string;
}

export interface AdminAffiliateListPage {
  items: AdminAffiliateRow[];
  total: number;
  page: number;
  limit: number;
}

export function trackAffiliateClick(
  code: string,
  landingPath?: string,
): Promise<{ tracked: boolean }> {
  return fetch(`${API_BASE}/affiliate/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, landingPath }),
  }).then(async (res) => {
    if (!res.ok) return { tracked: false };
    return res.json() as Promise<{ tracked: boolean }>;
  });
}

export function getAffiliateDashboard(): Promise<AffiliateDashboard> {
  return authRequest<AffiliateDashboard>("/affiliate/me");
}

export function attachAffiliateReferral(
  code: string,
): Promise<{ code: string }> {
  return authRequest("/affiliate/refer", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function listMyAffiliateCommissions(params?: {
  status?: AffiliateCommissionStatus;
  page?: number;
  limit?: number;
}): Promise<AffiliateCommissionPage> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 20));
  if (params?.status) q.set("status", params.status);
  return authRequest<AffiliateCommissionPage>(
    `/affiliate/commissions?${q.toString()}`,
  );
}

export function getAffiliateAdminOverview(): Promise<AffiliateAdminOverview> {
  return authRequest<AffiliateAdminOverview>("/affiliate/admin/overview");
}

export function adminListAffiliates(params?: {
  status?: AffiliateStatus;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<AdminAffiliateListPage> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 20));
  if (params?.status) q.set("status", params.status);
  if (params?.q) q.set("q", params.q);
  return authRequest<AdminAffiliateListPage>(
    `/affiliate/admin/affiliates?${q.toString()}`,
  );
}

export function adminUpdateAffiliate(
  id: string,
  input: { status?: AffiliateStatus; commissionRate?: number },
): Promise<AffiliateRecord> {
  return authRequest<AffiliateRecord>(`/affiliate/admin/affiliates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function adminListAffiliateCommissions(params?: {
  status?: AffiliateCommissionStatus;
  page?: number;
  limit?: number;
}): Promise<AffiliateCommissionPage> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 20));
  if (params?.status) q.set("status", params.status);
  return authRequest<AffiliateCommissionPage>(
    `/affiliate/admin/commissions?${q.toString()}`,
  );
}

export function getAffiliatePayoutReport(): Promise<AffiliatePayoutReport> {
  return authRequest<AffiliatePayoutReport>("/affiliate/admin/payouts/report");
}

export function approveAffiliateCommission(
  id: string,
): Promise<AffiliateCommission> {
  return authRequest<AffiliateCommission>(
    `/affiliate/admin/commissions/${id}/approve`,
    { method: "POST" },
  );
}

export function rejectAffiliateCommission(
  id: string,
  note?: string,
): Promise<AffiliateCommission> {
  return authRequest<AffiliateCommission>(
    `/affiliate/admin/commissions/${id}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ note }),
    },
  );
}

// ---- Resellers ----

export type ResellerStatus = "pending" | "active" | "suspended";
export type ResellerTier = "standard" | "silver" | "gold" | "platinum";
export type ResellerOrderStatus = "pending" | "completed" | "cancelled";
export type ResellerOrderSource = "dashboard" | "api";

export interface ResellerRecord {
  _id: string;
  userId: string;
  companyName: string;
  status: ResellerStatus;
  tier: ResellerTier;
  discountRate: number;
  totalOrders: number;
  totalSpent: number;
  createdAt?: string;
}

export interface ResellerPrice {
  _id: string;
  resellerId: string;
  productId: string;
  unitPrice: number;
  currency: string;
  active: boolean;
}

export interface ResellerCatalogItem {
  productId: string;
  title: string;
  slug: string;
  basePrice: number;
  wholesalePrice: number;
  currency: string;
  available: number;
  hasOverride: boolean;
}

export interface ResellerApiKey {
  _id: string;
  label: string;
  prefix: string;
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt?: string;
}

export interface ResellerOrderItem {
  productId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  deliveredCodes?: Array<{ code: string }>;
}

export interface ResellerOrder {
  _id: string;
  orderNumber: string;
  resellerId: string;
  userId: string;
  items: ResellerOrderItem[];
  total: number;
  currency: string;
  status: ResellerOrderStatus;
  source: ResellerOrderSource;
  createdAt?: string;
}

export interface ResellerListPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminResellerRow {
  _id: string;
  userId: string;
  email?: string;
  displayName?: string;
  companyName: string;
  status: ResellerStatus;
  tier: ResellerTier;
  discountRate: number;
  totalOrders: number;
  totalSpent: number;
  balance: number;
  currency: string;
  createdAt?: string;
}

export interface ResellerAdminOverview {
  resellers: { total: number; pending: number; active: number; suspended: number };
  wholesale: { orders: number; spent: number };
  apiKeys: { active: number };
  tiers: string[];
  defaultDiscountRate: number;
  apiBaseUrl: string;
}

export function applyReseller(companyName: string): Promise<ResellerRecord> {
  return authRequest<ResellerRecord>("/reseller/apply", {
    method: "POST",
    body: JSON.stringify({ companyName }),
  });
}

export function getResellerMe(): Promise<ResellerRecord> {
  return authRequest<ResellerRecord>("/reseller/me");
}

export function getResellerBalance(): Promise<Wallet> {
  return authRequest<Wallet>("/reseller/balance");
}

export function getResellerCatalog(): Promise<ResellerCatalogItem[]> {
  return authRequest<ResellerCatalogItem[]>("/reseller/catalog");
}

export function getResellerPrices(): Promise<ResellerPrice[]> {
  return authRequest<ResellerPrice[]>("/reseller/prices");
}

export function createWholesaleOrder(items: Array<{
  productId: string;
  quantity: number;
}>): Promise<ResellerOrder> {
  return authRequest<ResellerOrder>("/reseller/orders", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function listWholesaleOrders(
  page = 1,
  limit = 20,
): Promise<ResellerListPage<ResellerOrder>> {
  return authRequest<ResellerListPage<ResellerOrder>>(
    `/reseller/orders?page=${page}&limit=${limit}`,
  );
}

export function getWholesaleOrder(id: string): Promise<ResellerOrder> {
  return authRequest<ResellerOrder>(`/reseller/orders/${id}`);
}

export function createResellerApiKey(label: string): Promise<{
  id: string;
  label: string;
  prefix: string;
  key: string;
}> {
  return authRequest("/reseller/api-keys", {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export function listResellerApiKeys(): Promise<ResellerApiKey[]> {
  return authRequest<ResellerApiKey[]>("/reseller/api-keys");
}

export function revokeResellerApiKey(id: string): Promise<{ success: boolean }> {
  return authRequest(`/reseller/api-keys/${id}`, { method: "DELETE" });
}

export function getWalletTransactions(
  page = 1,
  limit = 20,
): Promise<ResellerListPage<{
  _id: string;
  type: string;
  amount: number;
  currency: string;
  description?: string;
  createdAt?: string;
}>> {
  return authRequest(`/wallet/transactions?page=${page}&limit=${limit}`);
}

export function getResellerAdminOverview(): Promise<ResellerAdminOverview> {
  return authRequest<ResellerAdminOverview>("/reseller/admin/overview");
}

export function adminListResellers(params?: {
  status?: ResellerStatus;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<ResellerListPage<AdminResellerRow>> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 20));
  if (params?.status) q.set("status", params.status);
  if (params?.q) q.set("q", params.q);
  return authRequest<ResellerListPage<AdminResellerRow>>(
    `/reseller/admin/resellers?${q.toString()}`,
  );
}

export function adminUpdateReseller(
  id: string,
  input: {
    status?: ResellerStatus;
    tier?: ResellerTier;
    discountRate?: number;
  },
): Promise<ResellerRecord> {
  return authRequest<ResellerRecord>(`/reseller/admin/resellers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function adminTopUpReseller(
  id: string,
  amount: number,
  note?: string,
): Promise<Wallet> {
  return authRequest<Wallet>(`/reseller/admin/resellers/${id}/topup`, {
    method: "POST",
    body: JSON.stringify({ amount, note }),
  });
}

export function adminListResellerPrices(
  resellerId: string,
): Promise<ResellerPrice[]> {
  return authRequest<ResellerPrice[]>(
    `/reseller/admin/resellers/${resellerId}/prices`,
  );
}

export function adminSetResellerPrice(
  resellerId: string,
  input: { productId: string; unitPrice: number; currency?: string },
): Promise<ResellerPrice> {
  return authRequest<ResellerPrice>(
    `/reseller/admin/resellers/${resellerId}/prices`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export function adminRemoveResellerPrice(
  resellerId: string,
  productId: string,
): Promise<void> {
  return authRequest(
    `/reseller/admin/resellers/${resellerId}/prices/${productId}`,
    { method: "DELETE" },
  );
}

export function adminListResellerApiKeys(
  resellerId: string,
): Promise<ResellerApiKey[]> {
  return authRequest<ResellerApiKey[]>(
    `/reseller/admin/resellers/${resellerId}/api-keys`,
  );
}

export function adminListWholesaleOrders(params?: {
  resellerId?: string;
  page?: number;
  limit?: number;
}): Promise<ResellerListPage<ResellerOrder>> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 20));
  if (params?.resellerId) q.set("resellerId", params.resellerId);
  return authRequest<ResellerListPage<ResellerOrder>>(
    `/reseller/admin/orders?${q.toString()}`,
  );
}

export function flattenCategories(
  nodes: Category[],
  depth = 0,
): Array<{ id: string; label: string; depth: number; productCount?: number }> {
  const out: Array<{ id: string; label: string; depth: number; productCount?: number }> = [];
  for (const n of nodes) {
    const id = n._id ?? (n as Category & { id?: string }).id ?? "";
    out.push({
      id,
      label: `${"— ".repeat(depth)}${n.name}`,
      depth,
      productCount: n.productCount,
    });
    if (n.children?.length) {
      out.push(...flattenCategories(n.children, depth + 1));
    }
  }
  return out;
}

export { DEFAULT_CURRENCY };

/** Normalize stored currency codes for storefront display (legacy USD → BDT). */
export function resolveCurrency(currency?: string | null): string {
  const code = (currency?.trim() || DEFAULT_CURRENCY).toUpperCase();
  return code === "USD" ? DEFAULT_CURRENCY : code;
}

function formatBdtAmount(value: number): string {
  const fractionDigits =
    Number.isInteger(value) || Math.abs(Math.round(value * 100) % 100) === 0
      ? 0
      : 2;
  const formatted = new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted}৳`;
}

/** Numeric part only (no ৳ / currency code) for BDT and other currencies. */
export function formatPriceAmount(
  amount: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  const value = Number(amount ?? 0);
  const code = resolveCurrency(currency);
  const fractionDigits =
    code === "BDT" &&
    (Number.isInteger(value) || Math.abs(Math.round(value * 100) % 100) === 0)
      ? 0
      : 2;
  return new Intl.NumberFormat(code === "BDT" ? "en-BD" : "en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(value);
}

// ── Contact page settings ────────────────────────────────────────────────────

export interface ContactSocialLink {
  text: string;
  url: string;
}

export interface ContactSettings {
  heading: string;
  subheading: string;
  extraText: string;
  address: { label: string; lines: string[] };
  support: { label: string; phones: string[] };
  email: { label: string; emails: string[] };
  social: {
    label: string;
    facebookUrl: string;
    youtubeUrl: string;
    whatsappUrl: string;
    links: ContactSocialLink[];
  };
  /** "Connect Directly" WhatsApp card on /contact. */
  whatsappCard?: { title: string; description: string };
  updatedAt?: string;
}

export function getContactPageSettings(): Promise<ContactSettings> {
  const base =
    typeof window === "undefined"
      ? (process.env.INTERNAL_API_URL?.trim() || API_BASE).replace(/\/$/, "")
      : API_BASE.replace(/\/$/, "");
  return safeJsonRaw<ContactSettings>(`${base}/contact/page-settings`, {
    heading: "CONTACT US",
    subheading: "",
    extraText: "",
    address: { label: "Address", lines: [] },
    support: { label: "Support", phones: [] },
    email: { label: "Email", emails: [] },
    social: { label: "Social", facebookUrl: "", youtubeUrl: "", whatsappUrl: "", links: [] },
    whatsappCard: { title: "Connect Directly", description: "" },
  }, { cache: "no-store" });
}

export function getAdminContactSettings(): Promise<ContactSettings> {
  return authRequest<ContactSettings>("/contact/admin/settings");
}

export function updateContactSettings(
  patch: Partial<ContactSettings>,
): Promise<ContactSettings> {
  return authRequest<ContactSettings>("/contact/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Website pricing page
// ─────────────────────────────────────────────────────────────────────────────

export async function getWebsitePageSettings(opts?: {
  cached?: boolean;
  revalidate?: number;
}): Promise<WebsitePageSettings> {
  const base =
    typeof window === "undefined"
      ? (process.env.INTERNAL_API_URL?.trim() || API_BASE).replace(/\/$/, "")
      : API_BASE.replace(/\/$/, "");
  const url = `${base}/website/page-settings`;
  if (opts?.cached) {
    const data = await safeJsonCached<WebsitePageSettings | null>(
      url,
      null,
      opts.revalidate ?? 300,
      ["website-page-settings"],
    );
    return normalizeWebsitePageSettings(data ?? DEFAULT_WEBSITE_PAGE_SETTINGS);
  }
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return DEFAULT_WEBSITE_PAGE_SETTINGS;
    return normalizeWebsitePageSettings((await res.json()) as WebsitePageSettings);
  } catch {
    return DEFAULT_WEBSITE_PAGE_SETTINGS;
  }
}

export function getAdminWebsiteSettings(): Promise<WebsitePageSettings> {
  return authRequest<WebsitePageSettings>("/website/admin/settings").then(
    normalizeWebsitePageSettings,
  );
}

export function updateWebsiteSettings(
  patch: Partial<WebsitePageSettings>,
): Promise<WebsitePageSettings> {
  return authRequest<WebsitePageSettings>("/website/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then(normalizeWebsitePageSettings);
}

// ─────────────────────────────────────────────────────────────────────────────
// Blog (public storefront)
// ─────────────────────────────────────────────────────────────────────────────

export interface BlogAuthor {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

export interface BlogListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featuredImage?: string;
  ogImage?: string;
  category?: string;
  categoryId?: string;
  categorySlug?: string;
  tags: string[];
  author: BlogAuthor;
  status: string;
  views: number;
  likeCount?: number;
  dislikeCount?: number;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  publishedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  reviewedBy?: BlogAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPost extends BlogListItem {
  content: string;
}

export interface BlogListResponse {
  items: BlogListItem[];
  total: number;
  page: number;
  limit: number;
}

export type BlogQuery = {
  page?: number;
  limit?: number;
  category?: string;
  categoryId?: string;
  categorySlug?: string;
  tag?: string;
  q?: string;
  status?: BlogStatus;
};

function buildBlogQueryString(query: BlogQuery = {}): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.category?.trim()) params.set("category", query.category.trim());
  if (query.categoryId?.trim()) params.set("categoryId", query.categoryId.trim());
  if (query.categorySlug?.trim()) {
    params.set("categorySlug", query.categorySlug.trim());
  }
  if (query.tag?.trim()) params.set("tag", query.tag.trim());
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.status) params.set("status", query.status);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function blogApiBase(): string {
  return typeof window === "undefined"
    ? serverApiBase()
    : API_BASE.replace(/\/$/, "");
}

const EMPTY_BLOG_LIST: BlogListResponse = {
  items: [],
  total: 0,
  page: 1,
  limit: 12,
};

export async function getBlogPosts(
  query: BlogQuery = {},
  opts?: { cached?: boolean; revalidate?: number },
): Promise<BlogListResponse> {
  const url = `${blogApiBase()}/blogs${buildBlogQueryString(query)}`;
  if (opts?.cached) {
    return safeJsonCached(url, EMPTY_BLOG_LIST, opts.revalidate ?? 120);
  }
  return safeJsonRaw(url, EMPTY_BLOG_LIST);
}

export async function getBlogPost(
  slug: string,
  opts?: { cached?: boolean; revalidate?: number },
): Promise<BlogPost | null> {
  const encoded = encodeURIComponent(slug.trim());
  const url = `${blogApiBase()}/blogs/${encoded}`;
  if (opts?.cached) {
    return safeJsonCached<BlogPost | null>(url, null, opts.revalidate ?? 300);
  }
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as BlogPost;
  } catch {
    return null;
  }
}

export async function getBlogPageSettings(opts?: {
  cached?: boolean;
  revalidate?: number;
}): Promise<BlogPageSettings> {
  const url = `${blogApiBase()}/blogs/page-settings`;
  if (opts?.cached) {
    const data = await safeJsonCached<BlogPageSettings | null>(
      url,
      null,
      opts.revalidate ?? 300,
    );
    return normalizeBlogPageSettings(data ?? DEFAULT_BLOG_PAGE_SETTINGS);
  }
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return DEFAULT_BLOG_PAGE_SETTINGS;
    return normalizeBlogPageSettings((await res.json()) as BlogPageSettings);
  } catch {
    return DEFAULT_BLOG_PAGE_SETTINGS;
  }
}

export function getAdminBlogSettings(): Promise<BlogPageSettings> {
  return authRequest<BlogPageSettings>("/admin/blogs/settings").then(
    normalizeBlogPageSettings,
  );
}

export function updateAdminBlogSettings(
  patch: Partial<Pick<BlogPageSettings, "features">>,
): Promise<BlogPageSettings> {
  return authRequest<BlogPageSettings>("/admin/blogs/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then(normalizeBlogPageSettings);
}

export type BlogStatus = "draft" | "pending" | "published" | "rejected";

export type AdminBlogPayload = {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  ogImage?: string;
  categoryId?: string;
  category?: string;
  tags?: string[];
  status?: BlogStatus;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
};

const BLOG_IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const BLOG_IMAGE_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function blogImageMimeFromName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
  };
  return ext ? (map[ext] ?? null) : null;
}

export async function uploadBlogImage(
  file: File,
): Promise<{
  url: string;
  filename: string;
  format?: "webp";
  sizeBytes?: number;
  width?: number;
  height?: number;
}> {
  if (file.size > BLOG_IMAGE_UPLOAD_MAX_BYTES) {
    throw new ApiError("Image must be 10 MB or smaller.", 400);
  }
  const mime = file.type || blogImageMimeFromName(file.name) || "";
  if (!BLOG_IMAGE_UPLOAD_MIME.has(mime)) {
    throw new ApiError("Image must be JPG, PNG, WebP, GIF, or AVIF.", 400);
  }

  const form = new FormData();
  form.append("file", file);

  const run = () => {
    return fetch(`${API_BASE}/admin/blogs/image-upload`, {
      method: "POST",
      body: form,
      cache: "no-store",
      credentials: "include",
    });
  };

  const res = await fetchWithAuthRetry(run);
  if (!res.ok) await throwApiError(res);
  return parseUploadUrlJson<{
    url: string;
    filename: string;
    format?: "webp";
    sizeBytes?: number;
    width?: number;
    height?: number;
  }>(res);
}

export async function getAdminBlogs(
  query: BlogQuery = {},
): Promise<BlogListResponse> {
  return authRequest<BlogListResponse>(
    `/admin/blogs${buildBlogQueryString(query)}`,
  );
}

export interface BlogAdminOverview {
  posts: {
    total: number;
    published: number;
    draft: number;
    pending: number;
    rejected: number;
    createdToday: number;
    createdThisWeek: number;
    totalViews: number;
  };
  categories: {
    total: number;
    active: number;
    inactive: number;
  };
  recentPosts: BlogListItem[];
  pendingPosts: BlogListItem[];
  topCategories: Array<{
    id: string;
    name: string;
    slug?: string;
    postCount: number;
  }>;
}

export function getBlogAdminOverview(): Promise<BlogAdminOverview> {
  return authRequest<BlogAdminOverview>("/admin/blogs/overview");
}

export async function getAdminBlog(id: string): Promise<BlogPost> {
  return authRequest<BlogPost>(`/admin/blogs/${encodeURIComponent(id)}`);
}

export async function createBlog(
  payload: AdminBlogPayload,
): Promise<BlogPost> {
  return authRequest<BlogPost>("/admin/blogs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBlog(
  id: string,
  payload: Partial<AdminBlogPayload>,
): Promise<BlogPost> {
  return authRequest<BlogPost>(`/admin/blogs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBlog(id: string): Promise<{ success: boolean }> {
  return authRequest<{ success: boolean }>(
    `/admin/blogs/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function changeBlogStatus(
  id: string,
  status: BlogStatus,
): Promise<BlogPost> {
  return updateBlog(id, { status });
}

export async function approveBlog(id: string): Promise<BlogPost> {
  return authRequest<BlogPost>(
    `/admin/blogs/${encodeURIComponent(id)}/approve`,
    { method: "POST" },
  );
}

export async function rejectBlog(
  id: string,
  rejectionReason?: string,
): Promise<BlogPost> {
  return authRequest<BlogPost>(
    `/admin/blogs/${encodeURIComponent(id)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ rejectionReason }),
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Blog categories
// ─────────────────────────────────────────────────────────────────────────────

export type BlogCategorySeo = {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogImage?: string;
};

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive?: boolean;
  seo?: BlogCategorySeo;
  createdAt?: string;
  updatedAt?: string;
}

export type BlogCategoryInput = {
  name: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
  seo?: BlogCategorySeo;
};

export async function listBlogCategories(
  opts?: { cached?: boolean; revalidate?: number },
): Promise<BlogCategory[]> {
  const url = `${blogApiBase()}/blog-categories`;
  if (opts?.cached) {
    return safeJsonCached(url, [], opts.revalidate ?? 300);
  }
  return safeJsonRaw(url, []);
}

export async function getBlogCategoryBySlug(
  slug: string,
  opts?: { cached?: boolean; revalidate?: number },
): Promise<BlogCategory | null> {
  const encoded = encodeURIComponent(slug.trim());
  const url = `${blogApiBase()}/blog-categories/${encoded}`;
  if (opts?.cached) {
    return safeJsonCached<BlogCategory | null>(url, null, opts.revalidate ?? 300);
  }
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as BlogCategory;
  } catch {
    return null;
  }
}

export async function listAdminBlogCategories(): Promise<BlogCategory[]> {
  return authRequest<BlogCategory[]>("/admin/blog-categories");
}

export async function createBlogCategory(
  payload: BlogCategoryInput,
): Promise<BlogCategory> {
  return authRequest<BlogCategory>("/admin/blog-categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBlogCategory(
  id: string,
  payload: Partial<BlogCategoryInput>,
): Promise<BlogCategory> {
  return authRequest<BlogCategory>(
    `/admin/blog-categories/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteBlogCategory(
  id: string,
): Promise<{ success: boolean }> {
  return authRequest<{ success: boolean }>(
    `/admin/blog-categories/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export const BLOG_REVIEWS_PAGE_SIZE = 8;

export type PublicBlogReview = {
  id: string;
  customerName: string;
  rating: number;
  title?: string;
  body: string;
  adminReply?: string;
  adminReplyAuthor?: string;
  adminReplyAt?: string;
  createdAt: string;
};

export type BlogReviewsSummary = {
  avg: number;
  count: number;
  distribution: number[];
};

export type BlogReviewsPage = {
  items: PublicBlogReview[];
  total: number;
  page: number;
  limit: number;
  summary: BlogReviewsSummary;
};

export type BlogReactionType = "like" | "dislike";

export type BlogReactionsState = {
  likeCount: number;
  dislikeCount: number;
  reaction?: BlogReactionType | null;
};

export type BlogReviewEligibility = {
  canReview: boolean;
  reason: "invalid_post" | "already_reviewed" | "eligible";
  reviewId?: string;
  status?: string;
};

export type SubmittedBlogReview = PublicBlogReview & {
  status: string;
};

export async function fetchBlogReviews(
  slug: string,
  page = 1,
  limit = BLOG_REVIEWS_PAGE_SIZE,
): Promise<BlogReviewsPage> {
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const url = `${blogApiBase()}/blogs/${encodeURIComponent(slug)}/reviews?${q.toString()}`;
  const fallback: BlogReviewsPage = {
    items: [],
    total: 0,
    page,
    limit,
    summary: { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] },
  };
  return safeJsonRaw(url, fallback);
}

export function fetchBlogReviewEligibility(
  slug: string,
): Promise<BlogReviewEligibility> {
  return authRequest<BlogReviewEligibility>(
    `/blogs/${encodeURIComponent(slug)}/reviews/eligibility`,
  );
}

export function submitBlogReview(
  slug: string,
  input: {
    rating: number;
    title?: string;
    body: string;
  },
): Promise<SubmittedBlogReview> {
  return authRequest<SubmittedBlogReview>(
    `/blogs/${encodeURIComponent(slug)}/reviews`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function fetchBlogReactions(
  slug: string,
): Promise<Pick<BlogReactionsState, "likeCount" | "dislikeCount">> {
  const url = `${blogApiBase()}/blogs/${encodeURIComponent(slug)}/reactions`;
  return safeJsonRaw(url, { likeCount: 0, dislikeCount: 0 });
}

export function fetchMyBlogReaction(
  slug: string,
): Promise<{ reaction: BlogReactionType | null }> {
  return authRequest<{ reaction: BlogReactionType | null }>(
    `/blogs/${encodeURIComponent(slug)}/reactions/me`,
  );
}

export function setBlogReaction(
  slug: string,
  type: BlogReactionType,
): Promise<BlogReactionsState> {
  return authRequest<BlogReactionsState>(
    `/blogs/${encodeURIComponent(slug)}/reactions`,
    {
      method: "POST",
      body: JSON.stringify({ type }),
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function formatPrice(
  amount: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  const value = Number(amount ?? 0);
  const code = resolveCurrency(currency);
  if (code === "BDT") {
    return formatBdtAmount(value);
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}
