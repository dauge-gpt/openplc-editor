'use strict'

const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { verifyCompiler } = require('./verify-compiler-lock.cjs')

const source = path.resolve(__dirname, '..')
const read = (root, name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
function write(root, name, value) {
  const file = path.join(root, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value))
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vx-compiler-lock-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  for (const name of ['binary-versions.json', 'package.json', 'package-lock.json']) {
    fs.copyFileSync(path.join(source, name), path.join(root, name))
  }
  const lock = read(root, 'package-lock.json')
  for (const entry of verifyCompiler(root, { installed: false }).packages) {
    write(root, `node_modules/${entry.name}/package.json`, {
      name: entry.name,
      version: entry.version,
      dependencies: lock.packages[`node_modules/${entry.name}`].dependencies,
    })
  }
  for (const name of ['dist/index.js', 'dist/node/cli.js', 'src/runtime/include/test.h', 'libs/test.stlib']) {
    const file = path.join(root, 'node_modules/strucpp', name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '')
  }
  return root
}

test('reviewed lock closes the eight-package compiler production graph', () => {
  const report = verifyCompiler(source, { installed: false })
  assert.equal(report.version, '0.7.0')
  assert.equal(report.packages.length, 8)
  assert.equal(report.installed, false)
  assert.match(report.package_lock_sha256, /^[a-f0-9]{64}$/)
})

for (const [name, mutate, expected] of [
  [
    'compiler digest drift',
    (p) => {
      p['node_modules/strucpp'].integrity = `sha256-${'A'.repeat(43)}=`
    },
    /digest differs/,
  ],
  [
    'compiler source drift',
    (p) => {
      p['node_modules/strucpp'].resolved += '?unreviewed'
    },
    /archive differs/,
  ],
  [
    'missing transitive dependency',
    (p) => {
      delete p['node_modules/lodash-es']
    },
    /missing compiler dependency/,
  ],
  [
    'missing transitive integrity',
    (p) => {
      delete p['node_modules/chevrotain'].integrity
    },
    /string|integrity/,
  ],
  [
    'truncated transitive integrity',
    (p) => {
      p['node_modules/chevrotain'].integrity = 'sha512-YQ=='
    },
    /digest length/,
  ],
  [
    'unreviewed dependency source',
    (p) => {
      p['node_modules/chevrotain'].resolved = 'https://example.org/archive.tgz'
    },
    /unexpected.*source/,
  ],
  [
    'nested dependency shadow',
    (p) => {
      p['node_modules/strucpp/node_modules/chevrotain'] = p['node_modules/chevrotain']
    },
    /nested compiler/,
  ],
]) {
  test(`rejects ${name} before installation`, (t) => {
    const root = fixture(t)
    const lock = read(root, 'package-lock.json')
    mutate(lock.packages)
    write(root, 'package-lock.json', lock)
    assert.throws(() => verifyCompiler(root, { installed: false }), expected)
  })
}

test('rejects a manifest that bypasses the reviewed compiler URL', (t) => {
  const root = fixture(t)
  const manifest = read(root, 'package.json')
  manifest.dependencies.strucpp = 'latest'
  write(root, 'package.json', manifest)
  assert.throws(() => verifyCompiler(root, { installed: false }), /manifest compiler URL/)
})

test('checks installed dependency versions, graph and resources without changing the lock', (t) => {
  const root = fixture(t)
  const before = fs.readFileSync(path.join(root, 'package-lock.json'))
  assert.equal(verifyCompiler(root).installed, true)
  assert.deepEqual(fs.readFileSync(path.join(root, 'package-lock.json')), before)
  const dep = read(root, 'node_modules/chevrotain/package.json')
  write(root, 'node_modules/chevrotain/package.json', { ...dep, version: '11.0.4' })
  assert.throws(() => verifyCompiler(root), /installed dependency version/)
  write(root, 'node_modules/chevrotain/package.json', { ...dep, dependencies: {} })
  assert.throws(() => verifyCompiler(root), /installed dependency graph/)
  write(root, 'node_modules/chevrotain/package.json', dep)
  fs.rmSync(path.join(root, 'node_modules/strucpp/dist/index.js'))
  assert.throws(() => verifyCompiler(root), /missing compiler resource/)
})

test('npm ci enforces SHA256 before a dependency install script can execute', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vx-npm-integrity-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const packageDir = path.join(root, 'package')
  const consumer = path.join(root, 'consumer')
  const marker = path.join(root, 'install-ran')
  const env = { ...process.env, npm_config_cache: path.join(root, 'cache'), VX_COMPILER_TEST_SENTINEL: marker }
  function npm(args, cwd) {
    return spawnSync('npm', args, { cwd, env, encoding: 'utf8', timeout: 60000 })
  }
  write(packageDir, 'package.json', {
    name: 'vx-integrity-fixture',
    version: '1.0.0',
    scripts: { install: "node -e \"require('node:fs').writeFileSync(process.env.VX_COMPILER_TEST_SENTINEL, 'ran')\"" },
  })
  const pack = npm(['pack', '--ignore-scripts', '--json'], packageDir)
  assert.equal(pack.status, 0, pack.stderr)
  const archive = path.join(packageDir, JSON.parse(pack.stdout)[0].filename)
  const integrity = `sha256-${crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('base64')}`
  const dep = `file:${archive}`
  write(consumer, 'package.json', {
    name: 'vx-consumer',
    version: '1.0.0',
    dependencies: { 'vx-integrity-fixture': dep },
  })
  const lock = {
    name: 'vx-consumer',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { name: 'vx-consumer', version: '1.0.0', dependencies: { 'vx-integrity-fixture': dep } },
      'node_modules/vx-integrity-fixture': {
        version: '1.0.0',
        resolved: dep,
        integrity: `sha256-${'A'.repeat(43)}=`,
        hasInstallScript: true,
      },
    },
  }
  write(consumer, 'package-lock.json', lock)
  const rejected = npm(['ci', '--offline', '--no-audit', '--no-fund'], consumer)
  assert.notEqual(rejected.status, 0)
  assert.match(rejected.stderr, /EINTEGRITY/)
  assert.equal(fs.existsSync(marker), false, 'unverified dependency lifecycle must not run')
  lock.packages['node_modules/vx-integrity-fixture'].integrity = integrity
  write(consumer, 'package-lock.json', lock)
  const accepted = npm(['ci', '--offline', '--no-audit', '--no-fund'], consumer)
  assert.equal(accepted.status, 0, accepted.stderr)
  assert.equal(fs.readFileSync(marker, 'utf8'), 'ran')
})
