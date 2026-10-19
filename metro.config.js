const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// lucide CJS paths need exports off
config.resolver.unstable_enablePackageExports = false;

const CJS = {
  '@tanstack/react-query': 'build/legacy/index.cjs',
  '@tanstack/query-core': 'build/legacy/index.cjs',
};

const RADIX_SUBPATH = {
  '@radix-ui/primitive/is-development': path.join(
    __dirname,
    'metro-shims/radix-is-development.js',
  ),
};

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const rel = CJS[moduleName];
  if (rel) {
    try {
      const from = [context.originModulePath, __dirname].filter(Boolean);
      const pkgDir = path.dirname(
        require.resolve(`${moduleName}/package.json`, { paths: from }),
      );
      return { type: 'sourceFile', filePath: path.join(pkgDir, rel) };
    } catch {
      /* use default resolver */
    }
  }
  const radixFile = RADIX_SUBPATH[moduleName];
  if (radixFile) return { type: 'sourceFile', filePath: radixFile };
  if (defaultResolve) return defaultResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
