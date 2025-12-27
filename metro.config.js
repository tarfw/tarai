const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Handle TypeScript files in expo and other packages
// Put .ts/.tsx before .js/.jsx so metro tries them first
const baseSourceExts = config.resolver.sourceExts || [];
config.resolver.sourceExts = [
  'ts',
  'tsx',
  'mjs',
  'js',
  'jsx',
  'json',
  'cjs',
  ...baseSourceExts.filter(ext => !['ts', 'tsx', 'mjs', 'js', 'jsx', 'json', 'cjs'].includes(ext)),
];

module.exports = config;
