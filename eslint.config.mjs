// ESLint flat config — fokus pada deteksi import/variabel tak terpakai.
// Sengaja konservatif (level "warn") agar tidak menggagalkan CI pada kode lama;
// bisa diperketat bertahap.
import globals from "globals";
import unusedImports from "eslint-plugin-unused-imports";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/public/**",
      "backend/public/**",
      "**/.rate-limiter-state.json",
      "**/*.min.js",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "unused-imports": unusedImports, "react-hooks": reactHooks },
    rules: {
      "unused-imports/no-unused-imports": "warn",
      "no-unused-vars": "off",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "none" },
      ],
      // Diset "warn" agar tidak menggagalkan CI pada kode lama; perketat bertahap.
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
    linterOptions: { reportUnusedDisableDirectives: false },
  },
];
