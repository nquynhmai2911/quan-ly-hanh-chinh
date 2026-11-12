import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      {
        source: "/tasks",
        destination: "/dashboard?tab=tasks",
        permanent: false,
      },
      {
        source: "/reports",
        destination: "/dashboard?tab=reports",
        permanent: false,
      },
      {
        source: "/admin/roles",
        destination: "/admin/users?tab=roles",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
