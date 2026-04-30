/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: "openweathermap.org" },
      { hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
