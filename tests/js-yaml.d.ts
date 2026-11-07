/** js-yaml ships no types: the one function the tests use (symfonyAuth34 reads a generated security.yaml) */
declare module 'js-yaml' {
  export function load(input: string): unknown
}
