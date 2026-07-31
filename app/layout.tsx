import "./globals.css";

export const metadata = {
  title: "Métricas — Biohacker Latino",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <nav>
          <a href="/">Resumen</a>
          <a href="/tendencias">Tendencias</a>
          <a href="/contenido">Contenido</a>
          <a href="/analisis">Análisis</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
