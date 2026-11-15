# STruCpp compiler input

The editor installs STruCpp through the root `package.json` and
`package-lock.json`. `npm ci` checks the archive integrity before running package
lifecycle scripts. `scripts/download-binaries.ts`, retained for existing setup,
postinstall and prestart entrypoints, verifies the installed lock graph and
resources; it no longer runs a second `npm install --no-save`. To reinstall use
`npm ci`; the old `--force` setup argument fails with that instruction.

## Reviewed upstream input

| Field | Value |
| --- | --- |
| Release | [STruCpp v0.7.0](https://github.com/Autonomy-Logic/STruCpp/releases/tag/v0.7.0) |
| Source commit | `72dfcb8b1c5a41a68bfbf4b133169189c58f04b3` |
| Annotated tag object | `35ddc5a7afca558ab844e1a7b0dbeb3ed60ef7ea` |
| Asset | `strucpp-0.7.0.tgz`, GitHub asset ID `596368406` |
| Size | `2637939` bytes |
| SHA256 | `8d78ae92d931b87c06145520222d1491206f424c147ec66ea84653cb8b0e1be5` |
| Published | `2026-09-28T20:42:09Z` |

The SHA256 from the official GitHub release asset metadata was independently
checked against the downloaded archive. Its base64 encoding is stored as the
compiler's npm SRI value. The source tag is provenance for the upstream release,
not a claim that a local rebuild was compared byte for byte with the asset.

The seven production dependencies are taken from the
[upstream lock at the release commit](https://github.com/Autonomy-Logic/STruCpp/blob/72dfcb8b1c5a41a68bfbf4b133169189c58f04b3/package-lock.json):
`chevrotain` and the five `@chevrotain/*` packages at `11.0.3`, plus
`lodash-es` at `4.17.21`. Each archive has an exact URL and SHA512 integrity in
the root lock. Updating a version, source or digest is a reviewed lock change.

## Checks and evidence

`ci/vx-check.sh` remains the single fork entrypoint invoked by the private
VxAHUControl dispatcher in the prepared Node 22 image. It writes:

- `reports/compiler-lock-tests.log`: Node built-in regression tests, including a
  local npm tarball fixture proving that a wrong SHA256 fails with `EINTEGRITY`
  before its install script runs; the matching SHA256 permits installation.
- `reports/compiler-lock-input.json`: pin/manifest/lock agreement and complete
  compiler production dependency graph, before installation.
- `reports/compiler-install.json`: the same graph checked against installed
  package names, versions, dependency declarations and required compiler files.

The JSON reports contain SHA256 hashes of `package-lock.json` and
`binary-versions.json`. The installed check is not a second content-hash audit of
`node_modules`; the preceding clean `npm ci` enforces archive integrity. Nested
compiler dependencies are rejected because this reviewed graph is flat.

These checks qualify installation inputs only. A successful Editor baseline,
ST-to-C++ smoke or runtime baseline does not qualify VxAHUControl operation on
the Wirenboard. That validation uses the connected WB 8.5 and the read-only
`wirenboard/wbqt.sh` deployment source through the existing AHU runner/workflow.
No runner or workflow is added to this public fork.

This change locks the compiler graph. The existing Electron postinstall still
installs the separate `release/app` native dependencies; qualifying that native
packaging path and the prepared image remains part of M01. The architecture
check now uses the already locked `ts-node`, replacing an undeclared `npx tsx`
that fetched a mutable latest package during validation.
