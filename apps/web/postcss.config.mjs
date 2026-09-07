/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === "production"
      ? {
          cssnano: {
            preset: [
              "default",
              {
                discardComments: { removeAll: true },
                // feTurbulence noise SVG in globals.css breaks postcss-svgo parsing.
                svgo: false,
              },
            ],
          },
        }
      : {}),
  },
};

export default config;
