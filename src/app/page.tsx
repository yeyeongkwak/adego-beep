export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Adego Beep</h1>
      <p className="max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
        Adelaide transit — rebuild in progress. GTFS updater lives in{' '}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
          scripts/update-gtfs.ts
        </code>
      </p>
    </main>
  )
}
