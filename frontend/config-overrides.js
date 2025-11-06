module.exports = {
  webpack: function (config, env) {
    return config;
  },
  devServer: function (configFunction) {
    return function (proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);
      config.hot = false;
      config.liveReload = false;
      if (config.client) {
        config.client.overlay = false;
        config.client.progress = false;
      }
      return config;
    };
  }
};
