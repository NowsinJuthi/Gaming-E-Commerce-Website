"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductDetailImageGallery } from "@/components/product/ProductDetailImageGallery";
import {
  ProductDetailInfoTabs,
  type ProductInfoTabId,
} from "@/components/product/ProductDetailInfoTabs";
import { ProductDetailCustomerInputs } from "@/components/product/ProductDetailCustomerInputs";
import { ProductDetailOrderSummary } from "@/components/product/ProductDetailOrderSummary";
import { ProductDetailQuantity } from "@/components/product/ProductDetailQuantity";
import { ProductDetailSelectPackage } from "@/components/product/ProductDetailSelectPackage";
import { ProductDetailShortDescription } from "@/components/product/ProductDetailShortDescription";
import {
  ArrowLeftIcon,
  CartIcon,
  ChatIcon,
  FacebookIcon,
  LinkIcon,
  ZapIcon,
} from "@/components/admin/icons";
import { ActionButton } from "@/components/ui/ActionButton";
import { WishlistIconButton } from "@/components/product/WishlistIconButton";
import { useAutoDeliveryAccess } from "@/hooks/useAutoDeliveryAccess";
import {
  HOME_CONTAINER_CLS,
  HOME_PAGE_BG,
} from "@/components/home/home-container";
import {
  addToCart,
  type CartCustomerInput,
  type ProductDetail,
} from "@/lib/api";
import { ensureShoppingSession } from "@/lib/guest-checkout";
import { hasStrictAdminRole } from "@/lib/auth-roles";
import {
  buildPackageOptions,
  buildProductGalleryImages,
  filterPackagesForAutoDeliveryAccess,
  filterPackagesForStockVisibility,
  getShortDescriptionHtml,
  getProductDescriptionHtml,
  hasProductHtmlContent,
  collectSelectableRegions,
  filterPackagesByRegion,
  getProductDefaultRegion,
  normalizeRegionCode,
  parseCustomerInputBoxes,
  parseProductVariations,
  resolvePackageRegions,
  showVariationImagesInGallery,
} from "@/lib/product-page";

export function ProductDetailView({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const { canAccess: canAccessAutoDelivery, loaded: accessLoaded } =
    useAutoDeliveryAccess();
  const [isAdmin, setIsAdmin] = useState(() => hasStrictAdminRole());

  useEffect(() => {
    const sync = () => setIsAdmin(hasStrictAdminRole());
    sync();
    window.addEventListener("auth-change", sync);
    return () => window.removeEventListener("auth-change", sync);
  }, []);

  const variations = useMemo(
    () => parseProductVariations(product.attributes),
    [product.attributes],
  );
  const customerInputs = useMemo(
    () => parseCustomerInputBoxes(product.attributes),
    [product.attributes],
  );
  const shortDescription = useMemo(
    () => getShortDescriptionHtml(product.attributes),
    [product.attributes],
  );
  const productDescription = useMemo(
    () => getProductDescriptionHtml(product.description),
    [product.description],
  );
  const allPackages = useMemo(
    () => buildPackageOptions(product, variations),
    [product, variations],
  );
  const packages = useMemo(() => {
    if (!accessLoaded) return [];
    const afterAutoDelivery = filterPackagesForAutoDeliveryAccess(
      allPackages,
      canAccessAutoDelivery,
    );
    return filterPackagesForStockVisibility(afterAutoDelivery, isAdmin);
  }, [accessLoaded, allPackages, canAccessAutoDelivery, isAdmin]);
  const includePackageImagesInGallery = showVariationImagesInGallery(
    product.attributes,
  );
  const galleryImages = useMemo(
    () => buildProductGalleryImages(product, variations),
    [product, variations],
  );

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedPkgId, setSelectedPkgId] = useState("base");
  const [activeImageUrl, setActiveImageUrl] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<ProductInfoTabId>("description");
  const [busy, setBusy] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [inputError, setInputError] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const linkCopiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productRegionList = useMemo(
    () => resolvePackageRegions(product.availableRegions),
    [product.availableRegions],
  );
  const selectableRegions = useMemo(
    () => collectSelectableRegions(productRegionList, packages),
    [productRegionList, packages],
  );
  const regionPackages = useMemo(
    () => filterPackagesByRegion(packages, selectedRegion, productRegionList),
    [packages, selectedRegion, productRegionList],
  );

  const defaultPkg =
    regionPackages.find((p) => p.inStock)?.id ??
    regionPackages[0]?.id ??
    packages.find((p) => p.inStock)?.id ??
    packages[0]?.id ??
    "base";

  useEffect(() => {
    if (!accessLoaded) return;
    setSelectedPkgId((current) => {
      if (current !== "base" && packages.some((pkg) => pkg.id === current)) {
        return current;
      }
      return defaultPkg;
    });
  }, [accessLoaded, defaultPkg, packages]);

  useEffect(() => {
    if (!accessLoaded) return;
    if (selectableRegions.length === 0) {
      setSelectedRegion(null);
      return;
    }
    const defaultRegion = getProductDefaultRegion(
      product.attributes,
      product.availableRegions,
      packages,
    );
    setSelectedRegion((current) => {
      if (
        current &&
        selectableRegions.some((region) =>
          normalizeRegionCode(region) === normalizeRegionCode(current),
        )
      ) {
        return current;
      }
      if (
        defaultRegion &&
        selectableRegions.some(
          (region) =>
            normalizeRegionCode(region) === normalizeRegionCode(defaultRegion),
        )
      ) {
        return (
          selectableRegions.find(
            (region) =>
              normalizeRegionCode(region) === normalizeRegionCode(defaultRegion),
          ) ?? defaultRegion
        );
      }
      return selectableRegions[0] ?? null;
    });
  }, [
    accessLoaded,
    selectableRegions,
    product.attributes,
    product.availableRegions,
    packages,
  ]);

  useEffect(() => {
    if (!accessLoaded || regionPackages.length === 0) return;
    setSelectedPkgId((current) => {
      if (regionPackages.some((pkg) => pkg.id === current)) return current;
      return (
        regionPackages.find((pkg) => pkg.inStock)?.id ??
        regionPackages[0]?.id ??
        "base"
      );
    });
  }, [accessLoaded, regionPackages, selectedRegion]);

  useEffect(() => {
    return () => {
      if (linkCopiedTimer.current) clearTimeout(linkCopiedTimer.current);
    };
  }, []);

  useEffect(() => {
    const initial =
      galleryImages[0]?.url ?? product.media?.[0]?.url ?? "";
    setActiveImageUrl(initial);
  }, [product._id, galleryImages, product.media]);

  useEffect(() => {
    if (!includePackageImagesInGallery) return;
    const selectedPkg =
      packages.find((p) => p.id === selectedPkgId) ?? packages[0];
    const pkgUrl = selectedPkg?.imageUrl?.trim();
    if (!pkgUrl) return;
    if (galleryImages.some((item) => item.url === pkgUrl)) {
      setActiveImageUrl(pkgUrl);
    }
  }, [selectedPkgId, includePackageImagesInGallery, packages, galleryImages]);

  const selectedPkg =
    regionPackages.find((p) => p.id === selectedPkgId) ??
    regionPackages[0] ??
    packages.find((p) => p.id === selectedPkgId) ??
    packages[0];

  const currency = product.pricing.currency;
  const unitPrice = selectedPkg?.price ?? product.pricing.basePrice;
  const subtotal = unitPrice * quantity;
  const mainImage =
    activeImageUrl ||
    galleryImages[0]?.url ||
    product.media?.[0]?.url ||
    (includePackageImagesInGallery ? selectedPkg?.imageUrl : "") ||
    "";
  const activeGalleryItem =
    galleryImages.find((item) => item.url === mainImage) ?? galleryImages[0];
  const mainImageAlt =
    activeGalleryItem?.alt ?? product.media?.[0]?.alt ?? product.title;
  async function requireAuth(): Promise<boolean> {
    const ok = await ensureShoppingSession();
    if (!ok) router.push("/login");
    return ok;
  }

  function validateInputs(): boolean {
    for (const box of customerInputs) {
      if (box.required && !inputValues[box.id]?.trim()) {
        setInputError(`Please fill in ${box.label}.`);
        return false;
      }
    }
    setInputError(null);
    return true;
  }

  async function handleAddToCart(goCheckout = false) {
    if (!selectedPkg?.inStock) return;
    if (selectableRegions.length > 0 && !selectedRegion) {
      setCartError("Please select a package region.");
      return;
    }
    if (!validateInputs()) return;
    if (!(await requireAuth())) return;

    setCartError(null);
    setBusy(true);
    try {
      const selectedVariation = variations.find((v) => v.id === selectedPkgId);
      const filledInputs: CartCustomerInput[] = customerInputs
        .map((box) => ({
          label: box.label,
          value: inputValues[box.id]?.trim() ?? "",
        }))
        .filter((entry) => entry.value.length > 0);
      if (selectedRegion) {
        const hasRegionInput = filledInputs.some(
          (entry) => entry.label.trim().toLowerCase() === "region",
        );
        if (!hasRegionInput) {
          filledInputs.push({ label: "Region", value: selectedRegion });
        }
      }
      await addToCart(
        product._id,
        quantity,
        selectedVariation?.valueId,
        filledInputs,
      );
      window.dispatchEvent(new Event("cart-change"));
      if (goCheckout) router.push("/checkout");
    } catch (err) {
      setCartError(
        err instanceof Error ? err.message : "Failed to add to cart. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function shareFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      "_blank",
      "noopener,noreferrer,width=600,height=400",
    );
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      if (linkCopiedTimer.current) clearTimeout(linkCopiedTimer.current);
      linkCopiedTimer.current = setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className={`product-pdp min-h-screen pb-16 pb-safe pt-4 sm:pt-6 ${HOME_PAGE_BG}`}>
      <div className={HOME_CONTAINER_CLS}>
        <Link href="/products" className="product-pdp-back">
          <ArrowLeftIcon className="h-4 w-4" aria-hidden />
          Back to shop
        </Link>

        <h1 className="sr-only">{product.title}</h1>

        <div className="product-pdp-grid mt-4 sm:mt-6 sm:gap-6">
          <div className="product-pdp-media-col sm:space-y-4">
            <ProductDetailImageGallery
              productTitle={product.title}
              images={galleryImages}
              activeUrl={mainImage}
              activeAlt={mainImageAlt}
              onSelect={setActiveImageUrl}
              actions={
                <div className="product-pdp-social">
                  <WishlistIconButton productId={product._id} />
                  <Link
                    href="/tickets"
                    className="product-pdp-icon-btn"
                    aria-label="Support chat"
                  >
                    <ChatIcon className="h-[18px] w-[18px]" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    onClick={shareFacebook}
                    className="product-pdp-icon-btn"
                    aria-label="Share on Facebook"
                  >
                    <FacebookIcon className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={copyLink}
                    className={`product-pdp-icon-btn${linkCopied ? " product-pdp-icon-btn--copied" : ""}`}
                    aria-label="Copy product link"
                  >
                    <LinkIcon className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                </div>
              }
              actionsNote={
                linkCopied ? (
                  <p className="text-xs text-brand">Link copied</p>
                ) : null
              }
            />

            {hasProductHtmlContent(shortDescription) ? (
              <ProductDetailShortDescription html={shortDescription} />
            ) : null}
          </div>

          <div className="product-pdp-buy-col sm:space-y-4">
            <ProductDetailSelectPackage
              accessLoaded={accessLoaded}
              packages={regionPackages}
              totalPackageCount={packages.length}
              selectedPkgId={selectedPkgId}
              currency={currency}
              onSelectPackage={setSelectedPkgId}
              regions={selectableRegions}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
            />

            <ProductDetailQuantity
              quantity={quantity}
              onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
              onIncrease={() => setQuantity((q) => q + 1)}
            />

            <ProductDetailOrderSummary
              packageName={selectedPkg?.name}
              regionName={selectedRegion ?? undefined}
              subtotal={subtotal}
              currency={currency}
            />

            <ProductDetailCustomerInputs
              inputs={customerInputs}
              values={inputValues}
              onChange={(id, value) =>
                setInputValues((v) => ({ ...v, [id]: value }))
              }
              onFocus={() => setInputError(null)}
            />

            <div className="product-pdp-cta-row">
              {inputError ? (
                <p className="col-span-full text-xs text-danger">{inputError}</p>
              ) : null}
              {cartError ? (
                <p className="col-span-full text-xs text-danger" role="alert">{cartError}</p>
              ) : null}
              <ActionButton
                disabled={
                  busy ||
                  !accessLoaded ||
                  regionPackages.length === 0 ||
                  !selectedPkg?.inStock
                }
                loading={busy}
                icon={ZapIcon}
                onClick={() => handleAddToCart(true)}
                className="product-pdp-buy-btn w-full"
              >
                BUY NOW
              </ActionButton>
              <ActionButton
                disabled={busy || !selectedPkg?.inStock}
                icon={CartIcon}
                showArrow={false}
                onClick={() => handleAddToCart(false)}
                className="product-pdp-add-cart-btn w-full"
              >
                ADD TO CART
              </ActionButton>
            </div>
          </div>

        </div>

        <div className="product-pdp-info-section sm:mt-24">
          <ProductDetailInfoTabs
            productId={product._id}
            productTitle={product.title}
            productDescription={productDescription}
            deliveryType={product.deliveryType}
            availableRegions={product.availableRegions}
            ratings={product.ratings}
            tab={tab}
            onTabChange={setTab}
          />
        </div>
      </div>
    </main>
  );
}
