"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PriceText } from "@/components/ui/PriceText";
import { autocomplete, type Autocomplete } from "@/lib/api";
import { productPath } from "@/lib/seo";
import { resolveMediaSrc } from "@/lib/site-appearance";

type ProductSearchAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  inputId?: string;
  inputClassName?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Fetch suggestions once the query reaches this length (default 1). */
  minChars?: number;
  limit?: number;
  onProductSelect?: () => void;
};

export function ProductSearchAutocomplete({
  value,
  onChange,
  inputId,
  inputClassName = "admin-input w-full",
  placeholder = "Search products…",
  autoFocus = false,
  minChars = 1,
  limit = 6,
  onProductSelect,
}: ProductSearchAutocompleteProps) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const [suggest, setSuggest] = useState<Autocomplete | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = value.trim();
    if (!showSuggest || trimmed.length < minChars) {
      setSuggest(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      autocomplete(trimmed, limit)
        .then((result) => {
          if (!active) return;
          setSuggest(result);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [value, showSuggest, minChars, limit]);

  useEffect(() => {
    if (!showSuggest) return;
    function handleClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) {
        setShowSuggest(false);
      }
    }
    const id = window.setTimeout(() => {
      document.addEventListener("click", handleClick);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", handleClick);
    };
  }, [showSuggest]);

  function selectProduct(slug: string) {
    setShowSuggest(false);
    onProductSelect?.();
    router.push(productPath(slug));
  }

  const trimmed = value.trim();
  const hasProducts = (suggest?.products.length ?? 0) > 0;
  const showPanel =
    showSuggest &&
    trimmed.length >= minChars &&
    (loading || hasProducts);

  return (
    <div ref={boxRef} className="site-header-search">
      <input
        id={inputId}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggest(true);
        }}
        onFocus={() => setShowSuggest(true)}
        placeholder={placeholder}
        className={inputClassName}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-autocomplete="list"
        aria-controls={showPanel ? `${inputId ?? "search"}-suggest` : undefined}
      />

      {showPanel ? (
        <div
          id={`${inputId ?? "search"}-suggest`}
          className="site-header-search__suggest"
          role="listbox"
        >
          {loading && !hasProducts ? (
            <p className="site-header-search__status">Searching…</p>
          ) : null}

          {hasProducts ? (
            <ul className="site-header-search__list">
              {suggest!.products.map((product) => {
                const image = resolveMediaSrc(product.thumbnail ?? "");
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      role="option"
                      className="site-header-search__item"
                      onClick={() => selectProduct(product.slug)}
                    >
                      <span className="site-header-search__thumb">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="site-header-search__thumb-fallback" aria-hidden>
                            ?
                          </span>
                        )}
                      </span>
                      <span className="site-header-search__title">{product.title}</span>
                      <span className="site-header-search__price">
                        <PriceText amount={product.price} currency={product.currency} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : !loading ? (
            <p className="site-header-search__status">No products found</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
