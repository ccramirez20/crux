import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // La insignia de Next en la esquina. Solo existe en desarrollo —en producción
  // nunca se sirvió— pero se sienta encima de la tabla justo cuando uno está
  // revisando la pantalla en un teléfono, que es como se revisa esto.
  devIndicators: false,
};

export default nextConfig;
