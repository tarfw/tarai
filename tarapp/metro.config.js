const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Resolve rivetkit/client to its CJS build (mod.cjs) so Hermes never sees raw
// ESM `import(/* webpackIgnore: true */ moduleName)`, and stub Node's `ws` on
// React Native where global WebSocket is already built in.
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === "rivetkit/client") {
      return {
        filePath: path.resolve(
          __dirname,
          "node_modules/rivetkit/dist/tsup/client/mod.cjs",
        ),
        type: "sourceFile",
      };
    }
    if (moduleName === "ws") {
      return { type: "empty" };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

// This box is out of inotify watches (max_user_watches is exhausted by other
// processes), so poll the filesystem instead of registering watchers.
config.watchFolders = [];
config.server = {
  ...config.server,
  watch: {
    throttledPolling: {
      watch: true,
      interval: 500,
      persistent: true,
    },
  },
};

module.exports = config;
