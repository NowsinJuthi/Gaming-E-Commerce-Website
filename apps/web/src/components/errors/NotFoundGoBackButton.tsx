"use client";

export function NotFoundGoBackButton() {
  return (
    <button
      type="button"
      className="btn-secondary btn-secondary-sm"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          window.history.back();
          return;
        }
        window.location.assign("/");
      }}
    >
      Go Back
    </button>
  );
}
