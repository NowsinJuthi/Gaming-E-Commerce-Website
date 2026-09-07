"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { BoxIcon } from "@/components/admin/icons";
import {
  buildProductPayload,
  EMPTY_PRODUCT_FORM,
  ProductFormActions,
  ProductFormFields,
  type ProductFormState,
} from "@/components/admin/product-form";
import {
  createProduct,
  getCategories,
  listBrands,
  type Brand,
  type Category,
} from "@/lib/api";

export default function AdminNewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Holds the post-create redirect timer so it can be cleared on unmount
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      getCategories().catch(() => [] as Category[]),
      listBrands().catch(() => [] as Brand[]),
    ])
      .then(([c, b]) => {
        if (cancelled) return;
        setCategories(c);
        setBrands(b);
        if (c.length === 0) {
          setLoadError(
            "No categories found. Create a category before adding products.",
          );
        }
      })
      .catch(() => {
        // Individual fetches already swallow their own errors; this guards
        // against any unexpected throw inside the .then() callback.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Clear the redirect timer if the admin manually navigates away before it fires
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    hideAdminToast();
    if (form.categoryIds.length === 0) {
      adminToast("Please select at least one category.", false);
      return;
    }
    setSaving(true);
    try {
      await createProduct(buildProductPayload(form));
      adminToast("Product created successfully.", true);
      // Keep saving=true so the button stays disabled while we wait to redirect.
      // This prevents a second submit that would create a duplicate product.
      redirectTimerRef.current = setTimeout(
        () => router.push("/admin/products"),
        1200,
      );
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not create product", false);
      // Only re-enable the button on failure so the admin can retry
      setSaving(false);
    }
  }

  return (
    <AdminPageLayout
      section="Catalog"
      title="Add product"
      description="Create a new catalog item with media, variations, and SEO."
      icon={BoxIcon}
      backHref="/admin/products"
      backLabel="Products"
      loading={loading}
      loadingText="Loading form…"
    >

      {loadError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {loadError}{" "}
          <Link href="/admin/products/categories" className="font-semibold underline">
            Manage categories
          </Link>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <ProductFormFields
          form={form}
          setForm={setForm}
          categories={categories}
          brands={brands}
        />

        <ProductFormActions
          saving={saving}
          submitLabel="Create product"
          savingLabel="Creating…"
          hint="Fields marked * are required to create the product."
        />
      </form>
    </AdminPageLayout>
  );
}
