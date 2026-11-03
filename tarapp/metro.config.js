const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

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
