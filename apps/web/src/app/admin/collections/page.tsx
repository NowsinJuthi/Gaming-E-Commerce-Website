"use client";

import { CatalogCollectionsPage } from "@/components/admin/catalog-collections-page";
import {
  bulkMovieCollections,
  listMovieCollections,
  updateMovieCollection,
} from "@/lib/catalog-api";

export default function AdminCollectionsPage() {
  return (
    <CatalogCollectionsPage
      kind="movie"
      title="Movie collections"
      description="Browse titles, edit in a popup, and run bulk publish / feature / trending actions."
      emptyHint="Add a title from Add Manually Movies."
      yearLabel="releaseYear"
      load={listMovieCollections}
      bulk={bulkMovieCollections}
      save={updateMovieCollection}
    />
  );
}
