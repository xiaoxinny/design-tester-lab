import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  // Query all published augmentations, ordered by category then name
  const rows = await getDb().all<{
    id: string
    version: string
    name: string
    description: string | null
    category: string
    conflicts_with: string | null
    requires: string | null
  }>(
    'SELECT id, version, name, description, category, conflicts_with, requires FROM augmentations WHERE published = 1 ORDER BY category, name',
  )

  // Parse JSON fields
  const augmentations = rows.map(row => ({
    id: row.id,
    version: row.version,
    name: row.name,
    description: row.description,
    category: row.category,
    conflictsWith: row.conflicts_with ? JSON.parse(row.conflicts_with) : [],
    requires: row.requires ? JSON.parse(row.requires) : [],
  }))

  return NextResponse.json({ augmentations })
}
