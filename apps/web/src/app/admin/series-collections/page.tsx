"use client";

import { CatalogCollectionsPage } from "@/components/admin/catalog-collections-page";
import {
  bulkSeriesCollections,
  listSeriesCollections,
  updateSeriesCollection,
} from "@/lib/catalog-api";

export default function AdminSeriesCollectionsPage() {
  return (
    <CatalogCollectionsPage
      title="Series collections"
      description="Browse series, edit in a popup, and run bulk publish / feature / trending actions."
      emptyHint="Import TV libraries or add a series manually."
      yearLabel="firstAirYear"
      showSeasons
      load={listSeriesCollections}
      bulk={bulkSeriesCollections}
      save={updateSeriesCollection}
    />
  );
}
