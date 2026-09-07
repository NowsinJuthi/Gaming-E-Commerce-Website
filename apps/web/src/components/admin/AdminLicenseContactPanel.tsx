"use client";

import { LICENSE_VENDOR } from "@/lib/license-vendor";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { KeyIcon } from "@/components/admin/icons";

export function AdminLicenseContactPanel() {
  return (
    <ProductFormOrderCard
      icon={<KeyIcon className="h-4 w-4" />}
      title="Contact administrator"
      subtitle="Need a license key? Reach us on WhatsApp, Facebook or uniqbd.com."
    >
      <div className="space-y-2">
        <a
          className="admin-license-contact-row"
          href={LICENSE_VENDOR.whatsappLink}
          target="_blank"
          rel="noreferrer"
        >
          <span className="admin-license-contact-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 20.4 5 21l.7-2.6A8.5 8.5 0 1 1 12 20.5a8.4 8.4 0 0 1-4.5-1.1Z"
              />
              <path strokeLinecap="round" d="M9.2 9.8c.3 1.6 1.6 3 3.2 3.4" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="admin-license-contact-label">WhatsApp</span>
            <span className="admin-license-contact-value">{LICENSE_VENDOR.whatsapp}</span>
          </span>
        </a>
        <a
          className="admin-license-contact-row"
          href={LICENSE_VENDOR.facebookLink}
          target="_blank"
          rel="noreferrer"
        >
          <span className="admin-license-contact-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.6 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.4 1.4-1.4H16.6V5.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4v2.6H8v2.8h2.5V21h3.1Z" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="admin-license-contact-label">Facebook</span>
            <span className="admin-license-contact-value">{LICENSE_VENDOR.facebook}</span>
          </span>
        </a>
        <a
          className="admin-license-contact-row"
          href={LICENSE_VENDOR.websiteLink}
          target="_blank"
          rel="noreferrer"
        >
          <span className="admin-license-contact-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="8.5" />
              <path
                strokeLinecap="round"
                d="M3.5 12h17M12 3.5c2.4 2.4 3.7 5.4 3.7 8.5s-1.3 6.1-3.7 8.5M12 3.5C9.6 5.9 8.3 8.9 8.3 12s1.3 6.1 3.7 8.5"
              />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="admin-license-contact-label">Website</span>
            <span className="admin-license-contact-value">{LICENSE_VENDOR.website}</span>
          </span>
        </a>
      </div>
    </ProductFormOrderCard>
  );
}
