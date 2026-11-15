/**
 * Verify the compiler installed by npm ci from the reviewed dependency lock.
 * Kept as the setup/postinstall entrypoint; it never downloads or installs packages.
 */

import path from 'path'

const { verifyCompiler } = require('./verify-compiler-lock.cjs')

try {
  if (process.argv.includes('--force')) {
    throw new Error('--force no longer installs an untracked compiler; run npm ci to reinstall the locked toolchain')
  }
  const result = verifyCompiler(path.resolve(__dirname, '..'))
  console.log(`[download-binaries] verified locked STruCpp ${result.version} (${result.packages.length} packages)`)
} catch (error) {
  console.error('[download-binaries] Compiler verification failed:', error)
  process.exit(1)
}
