'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ReportViewer } from '@/components/lint/report-viewer'

interface Run {
  prompt_body: string
  model_id: string
  generated_html: string | null
  lintReport: any | null
  created_at: number
}

export default function SharedRunPage() {
  const { slug } = useParams<{ slug: string }>()
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/runs/share/${slug}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setRun(data?.run ?? null))
      .catch(() => setRun(null))
      .finally(() => setLoading(false))
  }, [slug])

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-8">
      <header className="mb-8">
        <Link href="/" className="font-mono text-lg font-semibold text-text-primary">
          design-tester-lab
        </Link>
      </header>

      {loading ? (
        <p className="text-text-secondary">Loading run...</p>
      ) : !run ? (
        <p className="text-text-secondary">Run not found or not shared</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="font-mono text-xl font-semibold">{run.model_id}</h1>
            <time className="text-sm text-text-muted">{new Date(run.created_at).toLocaleString()}</time>
          </div>

          {run.generated_html && (
            <section className="overflow-hidden rounded-lg border border-border bg-white">
              <iframe
                srcDoc={run.generated_html}
                sandbox="allow-scripts"
                className="h-[500px] w-full border-0"
                title="Generated UI preview"
              />
            </section>
          )}

          <ReportViewer report={run.lintReport} />

          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-2 font-mono text-sm font-semibold">Prompt</h2>
            <pre className="whitespace-pre-wrap font-mono text-sm text-text-secondary">{run.prompt_body}</pre>
          </section>
        </div>
      )}
    </main>
  )
}
