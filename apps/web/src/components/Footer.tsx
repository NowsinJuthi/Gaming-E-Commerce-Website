"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { ChevronIcon } from "@/components/admin/icons";
import { SiteLogo } from "@/components/SiteLogo";
import { ContactSocialIconRow } from "@/components/contact/ContactSocialIconRow";
import { useSiteMenus } from "@/components/SiteMenusProvider";
import type { ContactSettings, PublicSeoConfig } from "@/lib/api";
import { HOME_CONTAINER_CLS } from "@/components/home/home-container";
import { SITE_COPYRIGHT } from "@/lib/seo";
import type { SiteFooterColumn } from "@/lib/site-menus";

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-bold uppercase tracking-wide text-brand">
      {children}
    </p>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href as "/"}
        className="text-[15px] text-foreground-muted transition hover:text-brand"
      >
        {label}
      </Link>
    </li>
  );
}

function FooterNavColumn({ column }: { column: SiteFooterColumn }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="site-footer-nav-col border-b border-border/50 md:border-0">
      <button
        type="button"
        className="site-footer-nav-toggle flex w-full items-center justify-between gap-3 py-2 text-left md:pointer-events-none md:cursor-default md:py-0"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <FooterHeading>{column.title}</FooterHeading>
        <ChevronIcon
          className={`h-4 w-4 shrink-0 text-brand transition-transform duration-200 md:hidden ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      <ul
        id={panelId}
        className={`site-footer-nav-links mt-0 space-y-1 overflow-hidden pb-2 md:mt-4 md:block md:pb-0 ${
          open ? "block" : "hidden md:block"
        }`}
      >
        {column.items.map((item) => (
          <FooterLink
            key={`${column.title}-${item.href}-${item.label}`}
            href={item.href}
            label={item.label}
          />
        ))}
      </ul>
    </div>
  );
}

function enrichShopColumn(column: SiteFooterColumn): SiteFooterColumn {
  const title = column.title.trim().toLowerCase();
  if (title !== "shop" && title !== "footer menu") {
    return column;
  }

  const gamesTopUpItem = {
    label: "Games Top Up",
    href: "/products?type=topup",
  };
  const giftCardsItem = {
    label: "Gift Cards",
    href: "/products?type=giftcard",
  };
  const blogItem = {
    label: "Blog",
    href: "/blog",
  };
  const reviewsItem = {
    label: "Reviews",
    href: "/reviews",
  };
  const productRequestsItem = {
    label: "Product Requests",
    href: "/request-product",
  };

  const rest = column.items.filter(
    (item) =>
      item.href !== "/products?type=topup" &&
      item.href !== "/products?type=giftcard" &&
      item.href !== "/request-product" &&
      item.href !== "/blog" &&
      !item.href.startsWith("/blog/") &&
      item.href !== "/reviews",
  );

  const allProductsItem =
    rest.find((item) => {
      const path = item.href.split("?")[0] ?? item.href;
      return path === "/products" && !item.href.includes("?");
    }) ?? { label: "All products", href: "/products" };

  const otherItems = rest.filter((item) => {
    const path = item.href.split("?")[0] ?? item.href;
    return !(path === "/products" && !item.href.includes("?"));
  });

  const items = [
    productRequestsItem,
    allProductsItem,
    gamesTopUpItem,
    giftCardsItem,
    reviewsItem,
    blogItem,
    ...otherItems,
  ];

  return {
    ...column,
    title: title === "shop" ? "Footer Menu" : column.title,
    items,
  };
}

function enrichAccountColumn(column: SiteFooterColumn): SiteFooterColumn {
  const title = column.title.trim().toLowerCase();
  if (title !== "account") {
    return column;
  }

  const items = column.items.filter((item) => item.href !== "/request-product");
  if (items.length === column.items.length) {
    return column;
  }

  return { ...column, items };
}

function enrichUsefulLinksColumn(column: SiteFooterColumn): SiteFooterColumn {
  const title = column.title.trim().toLowerCase();
  if (title !== "useful links" && title !== "support") {
    return column;
  }

  const aboutItem = { label: "About UniQbd", href: "/about" };
  const refundItem = {
    label: "Refund And Returns Policy",
    href: "/refund-and-returns-policy/",
  };
  const termsItem = {
    label: "Terms & Conditions",
    href: "/terms-conditions/",
  };
  const privacyItem = {
    label: "Privacy Policy",
    href: "/privacy-policy/",
  };
  const disclaimersItem = {
    label: "Disclaimers",
    href: "/disclaimers/",
  };
  const rest = column.items.filter(
    (item) =>
      item.href !== "/about" &&
      item.href !== "/refund-and-returns-policy" &&
      item.href !== "/refund-and-returns-policy/" &&
      item.href !== "/terms-conditions" &&
      item.href !== "/terms-conditions/" &&
      item.href !== "/privacy-policy" &&
      item.href !== "/privacy-policy/" &&
      item.href !== "/disclaimers" &&
      item.href !== "/disclaimers/",
  );
  const contactIdx = rest.findIndex(
    (item) =>
      item.href === "/support" ||
      item.href === "/contact" ||
      item.label.toLowerCase().includes("contact"),
  );
  const insertAt = contactIdx >= 0 ? contactIdx : 0;
  const items = [...rest];
  items.splice(insertAt, 0, aboutItem, refundItem, termsItem, disclaimersItem, privacyItem);

  return { ...column, items };
}

export function Footer({
  contact,
  seo,
}: {
  contact?: ContactSettings;
  seo?: Pick<PublicSeoConfig, "social">;
}) {
  const { footer } = useSiteMenus();
  const footerColumns = footer.map((column) =>
    enrichShopColumn(enrichAccountColumn(enrichUsefulLinksColumn(column))),
  );

  return (
    <footer className="site-footer mt-8 border-t bg-surface text-foreground-muted">
      <div className={`${HOME_CONTAINER_CLS} py-12 md:py-14`}>
        <div className="site-footer-main flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-20 xl:gap-28 2xl:gap-36">
          <div className="site-footer-brand w-full shrink-0 lg:max-w-sm xl:max-w-md">
            <div className="site-footer-logo -ml-3 sm:-ml-4 md:-ml-5 lg:-ml-6 [&_.text-foreground]:!text-white">
              <SiteLogo href={null} showWave size="default" />
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-foreground-muted">
              UniQbd offers a seamless online shopping experience with an easy,
              hassle-free checkout process. All products are delivered through
              trusted and secure payment gateways.
            </p>
            {contact ? (
              <div className="site-footer-social">
                <ContactSocialIconRow
                  contact={contact}
                  seo={seo}
                  align="start"
                  emailBehavior="open-form"
                />
              </div>
            ) : null}
          </div>

          <nav
            className="site-footer-nav grid w-full gap-x-0 gap-y-0 sm:grid-cols-2 sm:gap-x-20 sm:gap-y-6 md:grid-cols-3 md:gap-x-24 md:gap-y-8 lg:ml-auto lg:w-auto lg:max-w-none lg:flex lg:flex-nowrap lg:justify-end lg:gap-x-32 lg:gap-y-0 xl:gap-x-40 2xl:gap-x-48"
            aria-label="Footer"
          >
            {footerColumns.map((column) => (
              <FooterNavColumn
                key={`${column.title}-${column.items[0]?.href ?? "empty"}`}
                column={column}
              />
            ))}
          </nav>
        </div>

        <div className="site-footer-bottom mt-12 flex flex-col items-center justify-between gap-4 pt-6 text-sm sm:flex-row">
          <p className="text-subtle">{SITE_COPYRIGHT}</p>
          <div className="site-footer-payment-logos">
            <Image
              src="/images/uniqbd-payment-gateway.png"
              alt="Accepted payment methods: bKash, Nagad, Rocket, Upay, and Bank Transfer"
              width={640}
              height={96}
              className="site-footer-payment-logos__img"
              priority={false}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
