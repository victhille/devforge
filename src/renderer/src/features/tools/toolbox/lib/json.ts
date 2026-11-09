/** A copy of a JSON value with the keys of every object in alphabetical order (arrays keep their order) */
export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>)
      .sort((a, b) => a.localeCompare(b, 'en'))
      .map(k => [k, sortKeys((value as Record<string, unknown>)[k])]))
  }
  return value
}
