"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminOrderPageIntro, CATALOG_QUICK_LINKS } from "@/components/admin/admin-order-page-shell";
import { BoxIcon } from "@/components/admin/icons";
import {
  buildProductPayload,
  getProductFormSetupHint,
  ProductFormActions,
  ProductFormFields,
  productToFormState,
  type ProductFormState,
} from "@/components/admin/product-form";
import type {
  ProductStockContext,
  ProductVariation,
} from "@/components/admin/product-variations";
import {
  adminGetProduct,
  getCategories,
  getStock,
  listBrands,
  updateProduct,
  type Brand,
  type Category,
} from "@/lib/api";

export default function AdminEditProductPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [form, setForm] = useState<ProductFormState | null>(null);
  const formRef = useRef<ProductFormState | null>(null);
  const [productTitle, setProductTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stockContext, setStockContext] = useState<ProductStockContext | undefined>(
    undefined,
  );

  // Keep ref always current so callbacks never close over a stale form snapshot
  formRef.current = form;

  const loadProduct = useCallback(() => {
    if (!productId) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    // Fetch product, categories, brands, and stock in parallel
    Promise.all([
      getCategories().catch(() => [] as Category[]),
      listBrands().catch(() => [] as Brand[]),
      adminGetProduct(productId),
      getStock(productId).catch(() => null),
    ])
      .then(([c, b, product, stock]) => {
        if (cancelled) return;
        setCategories(c);
        setBrands(b);
        setProductTitle(product.title);
        setForm(productToFormState(product));
        setStockContext({
          productId,
          available: product.stock?.available ?? 0,
          inventoryAvailable: product.inventoryAvailable ?? 0,
          packages: stock?.packages?.map((pkg) => ({
            valueId: pkg.valueId,
            available: pkg.available,
            reserved: pkg.reserved,
            sold: pkg.sold,
          })),
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Could not load product");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    return loadProduct();
  }, [loadProduct]);

  const persistVariations = useCallback(
    async (variations: ProductVariation[]) => {
      const current = formRef.current;
      if (!current) return;
      if (current.categoryIds.length === 0) {
        throw new Error(
          "Please select at least one category before saving variations.",
        );
      }
      const nextForm = { ...current, variations };
      setForm(nextForm);
      formRef.current = nextForm;
      await updateProduct(productId, buildProductPayload(nextForm));
      adminToast("Variations saved.", true);
    },
    [productId],
  );

  const persistPackageImagesSetting = useCallback(
    async (showVariationImagesInGallery: boolean) => {
      const current = formRef.current;
      if (!current) return;
      if (current.categoryIds.length === 0) {
        throw new Error(
          "Please select at least one category before saving this setting.",
        );
      }
      const nextForm = { ...current, showVariationImagesInGallery };
      setForm(nextForm);
      formRef.current = nextForm;
      await updateProduct(productId, buildProductPayload(nextForm));
      adminToast(showVariationImagesInGallery
          ? "Package images enabled on the product page gallery."
          : "Package images hidden from the product page gallery.", true);
    },
    [productId],
  );

  const persistRegions = useCallback(
    async ({
      availableRegions,
      defaultRegion,
    }: {
      availableRegions: string;
      defaultRegion: string;
    }) => {
      const current = formRef.current;
      if (!current) return;
      if (current.categoryIds.length === 0) {
        throw new Error(
          "Please select at least one category before saving storefront regions.",
        );
      }
      const nextForm = { ...current, regions: availableRegions, defaultRegion };
      setForm(nextForm);
      formRef.current = nextForm;
      await updateProduct(productId, buildProductPayload(nextForm));
      adminToast("Storefront regions saved.", true);
    },
    [productId],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    hideAdminToast();
    if (form.categoryIds.length === 0) {
      adminToast("Please select at least one category.", false);
      return;
    }
    setSaving(true);
    try {
      await updateProduct(productId, buildProductPayload(form));
      setProductTitle(form.title.trim());
      adminToast("Product saved successfully.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not save product", false);
    } finally {
      setSaving(false);
    }
  }

  if (!loading && !form) {
    return (
      <AdminPageLayout
        section="Catalog"
        title="Edit product"
        icon={BoxIcon}
        backHref="/admin/products"
        backLabel="Products"
      >
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {loadError ?? "Product not found."}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="dashboard-pro-btn-ghost"
            onClick={loadProduct}
          >
            Try again
          </button>
          <Link
            href="/admin/products"
            className="dashboard-pro-btn-ghost inline-block"
          >
            ← Back to all products
          </Link>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      section="Catalog"
      title="Edit product"
      description={productTitle}
      icon={BoxIcon}
      backHref="/admin/products"
      backLabel="Products"
      loading={loading}
      loadingText="Loading product…"
    >

      {form ? (
        <>
          <AdminOrderPageIntro
            icon={<BoxIcon className="h-4 w-4" />}
            title={productTitle.trim() || "Edit catalog item"}
            subtitle={getProductFormSetupHint(form)}
            quickLinks={CATALOG_QUICK_LINKS}
            quickNavLabel="Catalog shortcuts"
          />

          <form onSubmit={onSubmit} className="space-y-5">
          <ProductFormFields
            form={form}
            setForm={(value) => {
              setForm((prev) => {
                if (!prev) return prev;
                const next =
                  typeof value === "function" ? value(prev) : value;
                formRef.current = next;
                return next;
              });
            }}
            categories={categories}
            brands={brands}
            viewSlug={form.slug.trim() || undefined}
            onVariationsPersist={persistVariations}
            onRegionsPersist={persistRegions}
            onShowPackageImagesPersist={persistPackageImagesSetting}
            stockContext={stockContext}
          />

          <ProductFormActions
            saving={saving}
            submitLabel="Save changes"
            savingLabel="Saving…"
          />
        </form>
        </>
      ) : null}
    </AdminPageLayout>
  );
}
