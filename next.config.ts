import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  async redirects() {
    return [
      {
        source: "/timetable",
        destination: "/calendar?view=timetable",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
