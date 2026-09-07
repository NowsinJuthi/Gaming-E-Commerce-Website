"use client";

import { useEffect, useRef, useState } from "react";
import { PriceText } from "@/components/ui/PriceText";
import { BoxIcon, ChevronIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  formatPackageStockLabel,
  type PackageOption,
} from "@/lib/product-page";
import { RegionIcon } from "@/components/ui/RegionIcon";

type Props = {
  accessLoaded: boolean;
  packages: PackageOption[];
  totalPackageCount?: number;
  selectedPkgId: string | null;
  currency: string;
  onSelectPackage: (id: string) => void;
  regions?: string[];
  selectedRegion?: string | null;
  onSelectRegion?: (region: string) => void;
};

function PackageRegionDropdown({
  regions,
  selectedRegion,
  onSelectRegion,
}: {
  regions: string[];
  selectedRegion: string | null;
  onSelectRegion: (region: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const value = selectedRegion ?? regions[0] ?? "";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="product-pdp-region-picker">
      <button
        type="button"
        id="product-package-region"
        className={`product-pdp-region-picker-trigger${open ? " product-pdp-region-picker-trigger--open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select package region"
        onClick={() => setOpen((current) => !current)}
      >
        <RegionIcon
          region={value}
          size={20}
          className="product-pdp-region-picker-flag"
        />
        <span className="product-pdp-region-picker-label">{value}</span>
        <ChevronIcon
          className={`product-pdp-region-picker-chevron${open ? " product-pdp-region-picker-chevron--open" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="product-pdp-region-picker-menu" role="listbox">
          {regions.map((region) => {
            const active = region === value;
            return (
              <li key={region} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`product-pdp-region-picker-option${active ? " product-pdp-region-picker-option--active" : ""}`}
                  onClick={() => {
                    onSelectRegion(region);
                    setOpen(false);
                  }}
                >
                  <RegionIcon
                    region={region}
                    size={20}
                    className="product-pdp-region-picker-option-flag"
                  />
                  <span className="truncate">{region}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function ProductDetailSelectPackage({
  accessLoaded,
  packages,
  totalPackageCount = 0,
  selectedPkgId,
  currency,
  onSelectPackage,
  regions = [],
  selectedRegion = null,
  onSelectRegion,
}: Props) {
  return (
    <div className="customer-panel min-w-0">
      <ProductFormOrderCard
        className="admin-product-form-section product-pdp-packages-card"
        icon={<BoxIcon className="h-4 w-4" strokeWidth={2} aria-hidden />}
        title="Select Package Region"
        action={
          onSelectRegion && regions.length > 0 ? (
            <PackageRegionDropdown
              regions={regions}
              selectedRegion={selectedRegion}
              onSelectRegion={onSelectRegion}
            />
          ) : null
        }
        flatBody
      >
        {!accessLoaded ? (
          <p className="text-sm text-foreground-muted">Loading packages…</p>
        ) : totalPackageCount === 0 ? (
          <p className="text-sm text-foreground-muted">
            Instant delivery packages are not available for your account.
          </p>
        ) : packages.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No packages available for {selectedRegion ?? "this region"}.
          </p>
        ) : (
          <ul className="product-pdp-packages">
            {packages.map((pkg) => {
              const active = selectedPkgId === pkg.id;
              return (
                <li key={pkg.id}>
                  <button
                    type="button"
                    disabled={!pkg.inStock}
                    onClick={() => onSelectPackage(pkg.id)}
                    className={`admin-order-view-detail-row admin-order-view-detail-row--inline product-pdp-package-row ${active ? "product-pdp-package-row--active" : ""} ${!pkg.inStock ? "product-pdp-package-row--disabled" : ""}`}
                  >
                    <span className="admin-order-view-thumb product-pdp-package-thumb-wrap">
                      {pkg.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={pkg.imageUrl}
                          alt=""
                          className="product-pdp-package-thumb"
                        />
                      ) : (
                        <div className="product-pdp-package-thumb product-pdp-package-thumb--empty" />
                      )}
                    </span>
                    <span className="product-pdp-package-copy min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {pkg.name}
                      </span>
                      <span
                        className={
                          pkg.inStock
                            ? "product-pdp-stock-in mt-0.5 inline-block"
                            : "product-pdp-stock-out mt-0.5 inline-block"
                        }
                      >
                        {formatPackageStockLabel(pkg)}
                      </span>
                    </span>
                    <span className="product-pdp-package-price shrink-0 text-right">
                      <PriceText amount={pkg.price} currency={currency} />
                    </span>
                    <span
                      className={`product-pdp-package-radio ${active ? "product-pdp-package-radio--on" : ""}`}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ProductFormOrderCard>
    </div>
  );
}
