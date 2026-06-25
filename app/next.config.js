/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Barretenberg (bb.js) ships WASM and uses top-level await.
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };
    if (!isServer) {
      // bb.js + snarkjs reference Node built-ins that don't exist in the browser.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        os: false,
        readline: false,
        constants: false,
        stream: false,
        worker_threads: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
