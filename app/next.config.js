/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Noir circuit bytecode needs to be available client-side. Allow it.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Barretenberg WASM is huge — keep it as a separate chunk
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    }
    return config;
  },
  // WASM support
  asyncWebAssembly: true,
};

module.exports = nextConfig;