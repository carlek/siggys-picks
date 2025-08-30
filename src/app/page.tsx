import { SiggysPicksApp } from '@/components/siggys-picks-app';

export default function Home() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center p-0 sm:p-4 bg-muted/30 dark:bg-gray-900/50">
      <div className="w-full h-full sm:h-[calc(100vh-4rem)] sm:max-w-7xl sm:min-h-[700px] sm:rounded-2xl shadow-2xl bg-card overflow-hidden border">
        <SiggysPicksApp />
      </div>
    </main>
  );
}
