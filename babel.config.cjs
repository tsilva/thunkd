module.exports = function configureBabel(api) {
  api.cache(true);
  return {
    inputSourceMap: false,
    presets: ["babel-preset-expo"],
  };
};
