import shared from "@uniqbd/config-eslint";

export default [
  ...shared,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
      "no-empty": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**"],
  },
];
