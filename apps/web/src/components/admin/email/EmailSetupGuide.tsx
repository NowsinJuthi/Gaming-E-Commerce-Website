"use client";

import { MailIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";

export function EmailSetupGuide() {
  return (
    <ProductFormOrderCard
      className="admin-product-form-section"
      icon={<MailIcon className="h-4 w-4" />}
      title="Email setup guide"
      subtitle="SMTP, sender mailboxes, and delivery testing."
    >
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>SMTP server</dt>
        <dd className="text-sm text-foreground-muted">
          Choose a provider preset or enter host, port, and SSL settings. Save
          credentials before testing the connection.
        </dd>
      </div>
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Sender mailboxes</dt>
        <dd className="text-sm text-foreground-muted">
          Configure Default, Orders, Support, System, and Admin From addresses.
          Each channel can use its own SMTP username and password.
        </dd>
      </div>
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Templates</dt>
        <dd className="text-sm text-foreground-muted">
          Customize subjects, body copy, and delivery status in the template
          library. Header logo and accent color apply to every email.
        </dd>
      </div>
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Testing</dt>
        <dd className="text-sm text-foreground-muted">
          Verify SMTP after saving, then send a test email per sender type to
          confirm delivery and From address alignment.
        </dd>
      </div>
    </ProductFormOrderCard>
  );
}
