/**
 * Metro config — Expo defaults + a resolver tweak to force zustand's CommonJS
 * build on every platform.
 *
 * Why: zustand v5's ESM entry (`esm/middleware.mjs`) uses `import.meta.env.MODE`
 * inside devtools, and Metro's web bundler emits that token raw into a regular
 * <script> tag. The browser then throws "Cannot use 'import.meta' outside a
 * module" and aborts the whole bundle (silent — no console error visible).
 *
 * The zustand package exports a `react-native` conditional pointing at the
 * `.js` (CJS) build. Adding that condition for web makes Metro pick the same
 * import.meta-free file there too.
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force CJS resolution for all packages on web (where ESM transform is broken
// for `import.meta`). Doesn't affect native — `react-native` already wins.
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
