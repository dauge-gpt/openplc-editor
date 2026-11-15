'use strict'

// Uses only Node built-ins: validate inputs before npm ci runs.
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const read = (root, name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
const digest = (root, name) =>
  crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(root, name)))
    .digest('hex')

function verifyCompiler(root, { installed = true } = {}) {
  const pin = read(root, 'binary-versions.json').strucpp
  assert.match(pin.version, /^v\d+\.\d+\.\d+$/, 'compiler version must be an exact release')
  assert.equal(pin.repository, 'Autonomy-Logic/STruCpp', 'unexpected compiler repository')
  assert.match(pin.sha256, /^[a-f0-9]{64}$/, 'compiler SHA256 is required')
  assert.ok(Number.isSafeInteger(pin.size) && pin.size > 0, 'compiler release size is required')
  const version = pin.version.slice(1)
  const url = `https://github.com/${pin.repository}/releases/download/${pin.version}/strucpp-${version}.tgz`
  const integrity = `sha256-${Buffer.from(pin.sha256, 'hex').toString('base64')}`
  const manifest = read(root, 'package.json')
  const lock = read(root, 'package-lock.json')
  assert.equal(lock.lockfileVersion, 3, 'expected npm lockfile version 3')
  assert.equal(manifest.dependencies.strucpp, url, 'manifest compiler URL differs from pin')
  assert.equal(lock.packages[''].dependencies.strucpp, url, 'lock compiler URL differs from pin')
  const compiler = lock.packages['node_modules/strucpp']
  assert.ok(compiler, 'compiler is absent from dependency lock')
  assert.equal(compiler.version, version, 'locked compiler version differs from pin')
  assert.equal(compiler.resolved, url, 'locked compiler archive differs from pin')
  assert.equal(compiler.integrity, integrity, 'locked compiler digest differs from pin')

  const packages = []
  const seen = new Set()
  function visit(name) {
    if (seen.has(name)) return
    seen.add(name)
    assert.match(name, /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/, 'invalid dependency name')
    const key = `node_modules/${name}`
    const entry = lock.packages[key]
    assert.ok(entry, `missing compiler dependency in lock: ${name}`)
    assert.match(entry.version, /^\d+\.\d+\.\d+$/, `dependency version is not exact: ${name}`)
    if (name !== 'strucpp') {
      assert.equal(
        entry.resolved,
        `https://registry.npmjs.org/${name}/-/${name.split('/').pop()}-${entry.version}.tgz`,
        `unexpected compiler dependency source: ${name}`,
      )
    }
    assert.match(entry.integrity, /^sha(?:256|512)-[A-Za-z0-9+/]+={0,2}$/, `missing dependency integrity: ${name}`)
    const [algorithm, encodedDigest] = entry.integrity.split('-')
    const decodedDigest = Buffer.from(encodedDigest, 'base64')
    assert.equal(decodedDigest.length, algorithm === 'sha256' ? 32 : 64, `invalid dependency digest length: ${name}`)
    assert.equal(decodedDigest.toString('base64'), encodedDigest, `invalid dependency digest encoding: ${name}`)
    assert.ok(!entry.link, `linked compiler dependency: ${name}`)
    // This release has a flat production graph. Reject shadow packages rather
    // than reporting a top-level copy while Node loads a nested dependency.
    assert.ok(
      !Object.keys(lock.packages).some((p) => p.startsWith(`${key}/node_modules/`)),
      `nested compiler dependencies require review: ${name}`,
    )
    if (installed) {
      const actual = read(root, `${key}/package.json`)
      assert.equal(actual.name, name, `installed dependency name differs: ${name}`)
      assert.equal(actual.version, entry.version, `installed dependency version differs: ${name}`)
      assert.deepEqual(
        actual.dependencies || {},
        entry.dependencies || {},
        `installed dependency graph differs: ${name}`,
      )
      assert.ok(!fs.existsSync(path.join(root, key, 'node_modules')), `nested installed compiler dependencies: ${name}`)
    }
    packages.push({ name, version: entry.version, resolved: entry.resolved, integrity: entry.integrity })
    for (const dep of Object.keys(entry.dependencies || {}).sort()) visit(dep)
  }
  visit('strucpp')
  if (installed) {
    for (const required of ['dist/index.js', 'dist/node/cli.js', 'src/runtime/include', 'libs']) {
      assert.ok(
        fs.existsSync(path.join(root, 'node_modules/strucpp', required)),
        `missing compiler resource: ${required}`,
      )
    }
  }
  return {
    schema: 'vx.openplc.compiler-lock/1',
    status: 'pass',
    installed,
    version,
    compiler_sha256: pin.sha256,
    package_json_sha256: digest(root, 'package.json'),
    package_lock_sha256: digest(root, 'package-lock.json'),
    binary_versions_sha256: digest(root, 'binary-versions.json'),
    packages: packages.sort((a, b) => a.name.localeCompare(b.name)),
    limitation:
      'Archive integrity is enforced by npm ci. This report does not qualify generated PLC programs or WB hardware.',
  }
}

module.exports = { verifyCompiler }

if (require.main === module) {
  try {
    console.log(
      JSON.stringify(
        verifyCompiler(path.resolve(__dirname, '..'), {
          installed: !process.argv.includes('--lock-only'),
        }),
        null,
        2,
      ),
    )
  } catch (error) {
    console.error(`Compiler lock verification failed: ${error.message}`)
    process.exitCode = 1
  }
}
