/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static exports
  output: 'standalone',
  // Increase body parser size limit for chat uploads
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

module.exports = nextConfig;
