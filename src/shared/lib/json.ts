/**
 * JSON read from another tool or from a project's file (an audit report, a package.json): its shape is not ours to
 * promise, so each reader checks the fields it uses (optional chaining, typeof, Array.isArray). The one place
 * where the code allows `any`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- external JSON, every field is checked where it is read
export type ParsedJson = any
