/**
 * Shown when Prisma fails to connect (e.g. Postgres not running or wrong DATABASE_URL port).
 */
export function DatabaseUnavailableNotice() {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-auto p-8">
      <div className="mx-auto max-w-xl space-y-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-fg">
        <h1 className="text-base font-semibold text-amber-200">数据库未连接 / Database unreachable</h1>
        <p className="text-fg-muted">
          Prisma 无法连上你在 <code className="rounded bg-bg-elevated px-1 py-0.5 font-mono text-xs">DATABASE_URL</code>{" "}
          里配置的主机（常见为 <code className="font-mono text-xs">localhost:5434</code> 与 Docker Compose 映射一致）。
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-fg-muted">
          <li>
            若使用 Docker：先启动 <strong className="text-fg">Docker Desktop</strong>，再在项目根目录执行{" "}
            <code className="whitespace-pre-wrap rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-xs">
              docker compose up -d db
            </code>
          </li>
          <li>
            确认 <code className="rounded bg-bg-elevated px-1 font-mono text-xs">.env</code> 里{" "}
            <code className="font-mono text-xs">DATABASE_URL</code> 的端口与 compose 暴露端口一致（本仓库默认把 Postgres
            映射到宿主 <code className="font-mono text-xs">5434</code>，见 <code className="font-mono text-xs">docker-compose.yml</code>）。
          </li>
          <li>若本机已有 Postgres 在 <code className="font-mono text-xs">5432</code>，可把 URL 改为 5432 并保证库名、用户、密码正确。</li>
        </ol>
        <p className="text-xs text-fg-subtle">
          If you use Docker: start Docker Desktop, then run{" "}
          <code className="rounded bg-bg-elevated px-1 font-mono">docker compose up -d db</code>. Match{" "}
          <code className="font-mono">DATABASE_URL</code> host/port to your Postgres (this repo maps{" "}
          <code className="font-mono">5434→5432</code> in compose).
        </p>
      </div>
    </main>
  );
}
