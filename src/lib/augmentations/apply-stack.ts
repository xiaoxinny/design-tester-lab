/**
 * Resolve an augmentation stack to the system-prompt fragment that the
 * generation runner will send to the model.
 *
 * A stack is a list of `{id, version}` pairs (the format stored in
 * `runs.augmentation_stack` and `augmentation_presets.augmentation_stack`).
 * Resolution: for each pair, look up the row in `augmentations`, take
 * the `system_prompt` field, concatenate them in order with a separator.
 *
 * Stack validation (conflicts_with / requires) is a separate concern —
 * callers (UI picker, runner) run `validateStack` before calling this
 * function. The resolver does NOT enforce ordering, conflicts, or
 * requirements; it just returns the joined text.
 */
import { getDb } from '../../db/client';

export interface AugmentationRef {
  id: string;
  version: string;
}

export class AugmentationResolverError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AugmentationResolverError';
    this.statusCode = statusCode;
  }
}

const STACK_SEPARATOR = '\n\n---\n\n';

/**
 * Resolve the stack to a single system-prompt string. Throws if any
 * referenced augmentation does not exist in the table (which means the
 * seed loader and the runner's view of the world have diverged).
 */
export async function resolveStack(stack: AugmentationRef[]): Promise<string> {
  if (stack.length === 0) return '';
  // Look up all rows in one query.
  // Build a parameterized IN clause: (id=?, version=?) OR ... repeated.
  const conditions: string[] = [];
  const params: string[] = [];
  for (const ref of stack) {
    conditions.push('(id = ? AND version = ?)');
    params.push(ref.id, ref.version);
  }
  const sql = `SELECT id, version, system_prompt FROM augmentations WHERE ${conditions.join(' OR ')}`;
  const rows = await getDb().all<{
    id: string;
    version: string;
    system_prompt: string;
  }>(sql, ...params);

  if (rows.length !== stack.length) {
    const found = new Set(rows.map((r) => `${r.id}@${r.version}`));
    const missing = stack
      .map((r) => `${r.id}@${r.version}`)
      .filter((k) => !found.has(k));
    throw new AugmentationResolverError(
      `augmentation not found: ${missing.join(', ')}`,
      400,
    );
  }

  // Preserve the order of the input stack (ORDER BY in the SQL is not
  // meaningful for an OR-chain).
  const byId = new Map(rows.map((r) => [`${r.id}@${r.version}`, r.system_prompt]));
  const parts: string[] = [];
  for (const ref of stack) {
    const prompt = byId.get(`${ref.id}@${ref.version}`);
    if (prompt) parts.push(prompt);
  }
  return parts.join(STACK_SEPARATOR);
}
