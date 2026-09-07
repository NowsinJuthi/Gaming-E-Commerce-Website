/**
 * Centralized React Query key factory.
 *
 * Why a factory?
 * - Consistent keys across the codebase — no magic strings scattered in files.
 * - Hierarchical structure enables targeted invalidation:
 *   `queryClient.invalidateQueries({ queryKey: queryKeys.products.all })`
 *   invalidates EVERY product query (lists + details + homepage).
 *   `queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(slug) })`
 *   invalidates only that product's cache entry.
 *
 * Convention: every group has an `.all` sentinel array so invalidating it
 * hits every sub-key in that group.
 *
 * @example
 * // Exact key for a specific admin products list filtered by search
 * queryKeys.admin.products.list({ search: "ipad", status: "active" })
 * // → ["admin", "products", "list", { search: "ipad", status: "active" }]
 *
 * // Invalidate everything admin-products-related (all filters, all pages)
 * queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all })
 * // → matches ["admin", "products"], ["admin", "products", "list", ...], etc.
 */

// ── Public storefront ─────────────────────────────────────────────────────────

export const queryKeys = {
  products: {
    /** Matches all product queries (list, detail, homepage). */
    all: ["products"] as const,

    /** Matches all product list queries regardless of filters. */
    lists: () => ["products", "list"] as const,

    /**
     * Exact key for a filtered product list.
     * @param filters — keep this object stable (useMemo / useState) to avoid
     *   unnecessary refetches.
     */
    list: (filters: {
      search?: string;
      sort?: string;
      type?: string;
      limit?: number;
      categoryId?: string;
      brandId?: string;
      cursor?: string;
    }) => ["products", "list", filters] as const,

    /** Product detail by slug. */
    detail: (slug: string) => ["products", "detail", slug] as const,

    /** Homepage sections (categories + top products per category). */
    homepage: () => ["products", "homepage-sections"] as const,
  },

  categories: {
    /** Matches all category queries. */
    all: ["categories"] as const,

    /** Public category tree. */
    tree: () => ["categories", "tree"] as const,

    /** Single category by slug. */
    bySlug: (slug: string) => ["categories", "slug", slug] as const,
  },

  brands: {
    /** Matches all brand queries. */
    all: ["brands"] as const,

    /** Flat brand list (public). */
    list: () => ["brands", "list"] as const,

    /** Single brand by slug. */
    bySlug: (slug: string) => ["brands", "slug", slug] as const,
  },

  reviews: {
    all: ["reviews"] as const,
    filters: () => ["reviews", "filters"] as const,
    lists: () => ["reviews", "list"] as const,
    list: (filters: {
      page?: number;
      limit?: number;
      q?: string;
      productId?: string;
      categoryId?: string;
    }) => ["reviews", "list", filters] as const,
  },

  blog: {
    /** Matches all blog queries. */
    all: ["blog"] as const,

    /** Matches all blog list queries regardless of filters. */
    lists: () => ["blog", "list"] as const,

    /** Exact key for a filtered blog list. */
    list: (filters: {
      page?: number;
      limit?: number;
      category?: string;
      categoryId?: string;
      categorySlug?: string;
      tag?: string;
      q?: string;
      suggest?: boolean;
    }) => ["blog", "list", filters] as const,

    /** Single blog post by slug. */
    detail: (slug: string) => ["blog", "detail", slug] as const,

    /** Public blog categories for storefront filters. */
    categories: () => ["blog", "categories"] as const,

    /** Blog article reviews for a slug. */
    reviews: (slug: string, page = 1) =>
      ["blog", "reviews", slug, page] as const,

    /** Blog article reaction state for a slug. */
    reactions: (slug: string) => ["blog", "reactions", slug] as const,
  },

  settings: {
    /** Matches all settings queries. */
    all: ["settings"] as const,

    /** Customer panel config (nav, checkout, appearance, banners, etc.). */
    customerPanel: () => ["settings", "customer-panel"] as const,
  },

  // ── Admin (authenticated) ─────────────────────────────────────────────────

  admin: {
    products: {
      /** Matches all admin product queries. */
      all: ["admin", "products"] as const,

      /** Matches all admin product list queries regardless of filters. */
      lists: () => ["admin", "products", "list"] as const,

      /**
       * Exact key for a filtered admin product list.
       * Supports the same filters as `adminListProducts()`.
       */
      list: (filters: {
        search?: string;
        status?: string;
        categoryId?: string;
        brandId?: string;
      }) => ["admin", "products", "list", filters] as const,
    },

    categories: {
      /** Matches all admin category queries. */
      all: ["admin", "categories"] as const,

      /** Admin category tree (full, includes inactive). */
      tree: () => ["admin", "categories", "tree"] as const,
    },

    brands: {
      /** Matches all admin brand queries. */
      all: ["admin", "brands"] as const,

      /** Admin brands list. */
      list: () => ["admin", "brands", "list"] as const,
    },

    blog: {
      /** Matches all admin blog queries. */
      all: ["admin", "blog"] as const,

      /** Matches all admin blog list queries regardless of filters. */
      lists: () => ["admin", "blog", "list"] as const,

      list: (filters: {
        page?: number;
        limit?: number;
        status?: string;
        category?: string;
        categoryId?: string;
        q?: string;
      }) => ["admin", "blog", "list", filters] as const,

      /** Admin blog post by MongoDB id. */
      detail: (id: string) => ["admin", "blog", "detail", id] as const,

      overview: ["admin", "blog", "overview"] as const,
    },

    blogCategory: {
      /** Matches all admin blog category queries. */
      all: ["admin", "blogCategory"] as const,

      /** Admin blog categories list. */
      list: () => ["admin", "blogCategory", "list"] as const,
    },

    permissions: {
      me: ["admin", "permissions", "me"] as const,
    },
  },
} as const;

export type QueryKeys = typeof queryKeys;
