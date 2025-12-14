import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Relaxed rules for alpha phase
  {
    rules: {
      // Allow require() in config files
      "@typescript-eslint/no-require-imports": "off",
      // Allow explicit any for now
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow unused vars (prefix with _ to silence)
      "@typescript-eslint/no-unused-vars": "warn",
      // Allow setState in useEffect (common pattern for initialization)
      "react-hooks/set-state-in-effect": "off",
      // Allow missing deps in useEffect (will fix incrementally)
      "react-hooks/exhaustive-deps": "warn",
      // Allow img tags (will migrate to next/image later)
      "@next/next/no-img-element": "warn",
      // Allow impure functions during render (Date.now, etc.)
      "react-hooks/purity": "off",
      // Allow mutations in hooks
      "react-hooks/immutability": "off",
      // Allow anonymous default exports
      "import/no-anonymous-default-export": "off",
      // Allow unescaped quotes in JSX
      "react/no-unescaped-entities": "off",
      // Allow refs access patterns
      "react-hooks/refs": "off",
      // Relax rules-of-hooks for dynamic patterns (warn instead of error)
      "react-hooks/rules-of-hooks": "warn",
      // Allow component creation patterns
      "react-hooks/static-components": "off",
    },
  },
]);

export default eslintConfig;
