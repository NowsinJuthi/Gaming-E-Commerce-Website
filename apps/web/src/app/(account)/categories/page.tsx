"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { getCategories, type Category } from "@/lib/api";
import { categoryPath } from "@/lib/seo";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  const roots = categories.filter((c) => !c.parentId);

  return (
    <CustomerPageLayout
      iconKey="categories"
      title="Categories"
      description="Browse by category"
      backHref="/dashboard"
      loading={loading}
      loadingText="Loading categories…"
    >
      {roots.length === 0 ? (
        <div className="panel-3d-empty">
          <p className="text-sm text-foreground-muted">No categories available.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {roots.map((cat) => {
            const children = categories.filter((c) => c.parentId === cat._id);
            return (
              <div key={cat._id} className="panel-3d-stat">
                <Link
                  href={categoryPath(cat.slug)}
                  className="text-lg font-semibold text-foreground hover:text-brand"
                >
                  {cat.name}
                </Link>
                {children.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {children.map((ch) => (
                      <li key={ch._id}>
                        <Link
                          href={categoryPath(ch.slug)}
                          className="text-sm text-foreground-muted hover:text-brand"
                        >
                          {ch.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </CustomerPageLayout>
  );
}
