/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained build that can run with just `node server.js`
  // Required for the Docker multi-stage build in frontend/Dockerfile
  output: "standalone",
};

export default nextConfig;
