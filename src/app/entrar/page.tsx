import { LoginForm } from "./LoginForm";

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="VisitaTech" className="mx-auto mb-2 h-16 w-16 rounded-xl object-cover" />
          <div className="mb-2 text-2xl font-bold text-brand-700">VisitaTech</div>
          <p className="text-sm text-muted">Visita Pós-Crédito — acesso da equipe</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
