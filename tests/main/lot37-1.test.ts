import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { expectedActual, locationIn, parseCargoTest, parseGoTest, parseJestJson, parseJunit, parsePlaywrightJson, rebase, totalsOf } from '../../src/shared/lib/testReports'

/** v3.7 lot 1: each test tool's report, read (real Vitest and Cargo outputs, the others as documented) */
const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', 'tests', name), 'utf-8')

describe('v3.7: Vitest and Jest', () => {
  it('reads a real Vitest report: suites, statuses, the failure, expected and received, where', () => {
    const files = parseJestJson(fixture('vitest.json'), 'C:/work/shop')!
    expect(files.map(f => f.file)).toEqual(['tests/main/zz-sample.test.ts'])
    const [adds, discount, objects, later] = files[0].tests
    expect(adds).toMatchObject({ name: 'adds the items', suite: 'cart › total', status: 'passed' })
    expect(discount).toMatchObject({
      status: 'failed', message: expect.stringContaining('expected 90 to be 85'), expected: '85', actual: '90',
      location: { file: 'tests/main/zz-sample.test.ts', line: 6 }
    })
    expect(objects).toMatchObject({ expected: '{ a: 2 }', actual: '{ a: 1 }', location: { line: 7 } })
    expect(later.status).toBe('skipped')
    expect(totalsOf(files)).toEqual({ passed: 1, failed: 2, skipped: 1 })
  })

  it('reads Jest\'s Expected / Received, and a file that does not load', () => {
    const json = JSON.stringify({ testResults: [
      { name: '/p/src/a.test.js', assertionResults: [{ ancestorTitles: [], title: 'sums', status: 'failed', duration: 3, failureMessages: ['Error: expect(received).toBe(expected) // Object.is equality\n\nExpected: 3\nReceived: 4\n    at Object.<anonymous> (/p/src/a.test.js:5:17)'], location: { line: 4 } }] },
      { name: '/p/src/b.test.js', message: 'SyntaxError: Unexpected token (3:4)', assertionResults: [] }
    ] })
    const [a, b] = parseJestJson(json, '/p')!
    expect(a.tests[0]).toMatchObject({ expected: '3', actual: '4', location: { file: 'src/a.test.js', line: 4 } })
    expect(b.tests[0]).toMatchObject({ name: '(file)', status: 'failed', message: expect.stringContaining('SyntaxError') })
    expect(parseJestJson('not json', '/p')).toBeNull()
  })
})

describe('v3.7: Playwright', () => {
  it('reads nested suites, the last retry, a skipped test', () => {
    const json = JSON.stringify({ suites: [{ title: 'login.spec.ts', file: 'login.spec.ts', specs: [], suites: [{ title: 'login', file: 'login.spec.ts', specs: [
      { title: 'works', file: 'login.spec.ts', line: 3, tests: [{ status: 'expected', results: [{ status: 'passed', duration: 120 }] }] },
      { title: 'refuses', file: 'login.spec.ts', line: 9, tests: [{ status: 'unexpected', results: [{ status: 'failed', duration: 80, error: { message: 'Error: expect(locator).toHaveText(expected)\n\nExpected: "Bad password"\nReceived: "Welcome"' } }] }] },
      { title: 'later', file: 'login.spec.ts', line: 15, tests: [{ status: 'skipped', results: [] }] }
    ] }] }] })
    const [f] = parsePlaywrightJson(json, '/p')!
    expect(f.file).toBe('login.spec.ts')
    expect(f.tests.map(t => [t.name, t.suite, t.status])).toEqual([['works', 'login', 'passed'], ['refuses', 'login', 'failed'], ['later', 'login', 'skipped']])
    expect(f.tests[1]).toMatchObject({ expected: '"Bad password"', actual: '"Welcome"', location: { file: 'login.spec.ts', line: 9 } })
  })
})

describe('v3.7: JUnit (PHPUnit, pytest)', () => {
  it('reads PHPUnit: nested suites, a failure with its expected value, an error, a skip', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites><testsuite name="Project Test Suite" tests="4"><testsuite name="App\\Tests\\CartTest" file="C:\\p\\tests\\CartTest.php">
<testcase name="testAdds" class="App\\Tests\\CartTest" classname="App.Tests.CartTest" file="C:\\p\\tests\\CartTest.php" line="12" time="0.002"/>
<testcase name="testDiscount" class="App\\Tests\\CartTest" classname="App.Tests.CartTest" file="C:\\p\\tests\\CartTest.php" line="18" time="0.003"><failure type="PHPUnit\\Framework\\ExpectationFailedException">App\\Tests\\CartTest::testDiscount
Failed asserting that 90 is identical to 85.

C:\\p\\tests\\CartTest.php:21</failure></testcase>
<testcase name="testBoom" file="C:\\p\\tests\\CartTest.php" line="25" time="0"><error type="Error">Error: Call to undefined method Cart::nope()

C:\\p\\tests\\CartTest.php:26</error></testcase>
<testcase name="testLater" file="C:\\p\\tests\\CartTest.php" line="30" time="0"><skipped/></testcase>
</testsuite></testsuite></testsuites>`
    const [f] = parseJunit(xml, 'C:\\p')!
    expect(f.file).toBe('tests/CartTest.php')
    expect(f.tests.map(t => t.status)).toEqual(['passed', 'failed', 'failed', 'skipped'])
    expect(f.tests[1]).toMatchObject({ expected: '85', actual: '90', location: { file: 'tests/CartTest.php', line: 21 }, durationMs: 3 })
    expect(f.tests[2].message).toContain('Call to undefined method')
  })

  it('reads pytest (xunit1: file and line), its assert', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?><testsuites><testsuite name="pytest" errors="0" failures="1" skipped="1" tests="3">
<testcase classname="tests.test_cart" file="tests/test_cart.py" line="3" name="test_adds" time="0.001" />
<testcase classname="tests.test_cart" file="tests/test_cart.py" line="7" name="test_discount" time="0.002"><failure message="assert 90 == 85">def test_discount():
&gt;       assert total([100], 0.15) == 85
E       assert 90 == 85

tests/test_cart.py:9: AssertionError</failure></testcase>
<testcase classname="tests.test_api" name="test_later" time="0"><skipped type="pytest.skip" message="not yet" /></testcase>
</testsuite></testsuites>`
    const files = parseJunit(xml, '/p')!
    expect(files.map(f => f.file)).toEqual(['tests/test_cart.py', 'tests/test_api.py'])
    expect(files[0].tests[1]).toMatchObject({ status: 'failed', expected: '85', actual: '90', location: { file: 'tests/test_cart.py', line: 9 } })
    expect(files[1].tests[0].status).toBe('skipped')
  })
})

describe('v3.7: Go and Cargo', () => {
  it('reads go test -json: packages as folders, subtests, the failing output, a package that does not build', () => {
    const ev = (o: object) => JSON.stringify(o)
    const stream = [
      ev({ Action: 'run', Package: 'example.com/api/cart', Test: 'TestTotal' }),
      ev({ Action: 'output', Package: 'example.com/api/cart', Test: 'TestTotal', Output: '=== RUN   TestTotal\n' }),
      ev({ Action: 'output', Package: 'example.com/api/cart', Test: 'TestTotal', Output: '    cart_test.go:14: expected 85, got 90\n' }),
      ev({ Action: 'fail', Package: 'example.com/api/cart', Test: 'TestTotal', Elapsed: 0.01 }),
      ev({ Action: 'pass', Package: 'example.com/api/cart', Test: 'TestTotal/empty', Elapsed: 0 }),
      ev({ Action: 'skip', Package: 'example.com/api', Test: 'TestLater', Elapsed: 0 }),
      ev({ Action: 'output', Package: 'example.com/api/broken', Output: '# example.com/api/broken\nbroken/x.go:3:2: undefined: nope\nFAIL\texample.com/api/broken [build failed]\n' }),
      ev({ Action: 'fail', Package: 'example.com/api/broken', Elapsed: 0 })
    ].join('\n')
    const files = parseGoTest(stream, 'example.com/api', '/p')!
    expect(files.map(f => f.file)).toEqual(['cart', '.', 'broken'])
    expect(files[0].tests[0]).toMatchObject({ name: 'TestTotal', status: 'failed', durationMs: 10, location: { file: 'cart/cart_test.go', line: 14 }, message: 'cart_test.go:14: expected 85, got 90' })
    expect(files[0].tests[1]).toMatchObject({ name: 'TestTotal/empty', status: 'passed' })
    expect(files[2].tests[0]).toMatchObject({ name: '(build)', status: 'failed', message: expect.stringContaining('undefined: nope') })
  })

  it('reads a real cargo test output: each target, left and right, where it panicked', () => {
    const files = parseCargoTest(fixture('cargo.txt'), 'C:\\work\\rs')!
    expect(files.map(f => [f.file, f.tests.map(t => `${t.name}:${t.status}`)])).toEqual([
      ['src/lib.rs', ['tests::later:skipped', 'tests::adds:passed', 'tests::fails:failed']],
      ['tests/it.rs', ['integration:passed']]
    ])
    expect(files[0].tests[2]).toMatchObject({ expected: '5', actual: '4', location: { file: 'src/lib.rs', line: 9 } })
  })
})

describe('v3.7: paths written with Windows\' short names', () => {
  it('reads a place under a short folder name, and rebases a path spelled the other way', () => {
    expect(locationIn('Error\n    at C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\shop\\src\\cart.test.ts:6:15', 'C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\shop'))
      .toEqual({ file: 'src/cart.test.ts', line: 6 })
    const files = rebase([{ file: 'C:/Users/runneradmin/Temp/shop/src/a.test.ts', tests: [{ name: 'x', status: 'failed', durationMs: 1, location: { file: 'C:/Users/runneradmin/Temp/shop/src/a.test.ts', line: 3 } }] }], 'C:\\Users\\runneradmin\\Temp\\shop')
    expect(files[0].file).toBe('src/a.test.ts')
    expect(files[0].tests[0].location).toEqual({ file: 'src/a.test.ts', line: 3 })
  })
})

describe('v3.7: expected and received in words', () => {
  it('knows each tool\'s way', () => {
    expect(expectedActual('expected [ 1, 2 ] to deeply equal [ 1, 3 ]')).toEqual({ expected: '[ 1, 3 ]', actual: '[ 1, 2 ]' })
    expect(expectedActual('Failed asserting that two strings are identical.')).toEqual({})
    expect(expectedActual('nothing to see')).toEqual({})
  })
})
