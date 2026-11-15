# VX fork CI

Run `bash ci/vx-check.sh` in the prepared, digest-pinned CI image.
The trusted workflow lives in private dauge-gpt/vx_ahu_project.
No self-hosted runner is registered on this public fork.
Unity admits at most two Linux runners from different repositories, one job per repository.
Both OpenPLC forks use the AHU runner and share the vx_ahu_project admission slot.
Before dispatch, review active/admitted queued runs and unfinished job chains, including wirenboard.
Allow AHU only when one slot is free and no other AHU run is admitted; coordinate with other operators.
This review is procedural, not an atomic host semaphore; wirenboard settings are unchanged.
Keep two build tasks and one CTest worker per job, with 24 GiB as the combined soft host budget.
Upstream workflows are preserved, inactive, in .github/upstream-workflows.
Enable no upstream release/PR automation without review.
The reports directory must be empty; the private wrapper provides a fresh one.
check_reports.py validates measured counts and writes test-summary.json.
Missing reports or tests fail; declared upstream exclusions remain explicit.
This baseline check does not qualify WB/Windows/Android or the VX integration.

The archive-schema correction below is a VX fork change. Upstream's separate
openplc-web mirror is outside this migration checkout and has not been changed
or qualified; the upstream mirroring guidance in CLAUDE.md is not a claim of
byte identity for this fork after the correction.

The compiler is an integrity-pinned npm dependency; see [COMPILER-LOCK.md](COMPILER-LOCK.md)
for release provenance, installation checks and report paths.

## 2026-11-15: compiler lock and local baseline investigation

The former setup script accepted only a matching package version and performed
an out-of-lock `npm install --no-save`. STruCpp 0.7.0 and all seven production
dependencies now have exact archive URLs and integrity in `package-lock.json`;
setup verifies the clean npm installation. The compiler path comments and
installation documentation were corrected to match this behavior.

The architecture gate used undeclared `npx tsx`, which fetched a mutable latest
package. Its first local run failed opening a tsx IPC socket (`EPERM`) before
checking architecture. The gate now uses the existing locked `ts-node` and its
CommonJS filesystem path; the architecture check passes. The lint glob is quoted
to keep shell expansion from changing its scope across environments.

The full local Jest run found two archive-validation failures: Zod accumulated
the size error and still evaluated a repeated-group regexp, which raised a
`RangeError` in the Jest VM instead of returning a validation error. The schema
now rejects oversized input before checking even-length, nonempty ASCII hex,
using a character check without the repeated group. The existing limit remains
16,777,216 hex characters (8 MiB decoded). The two failing suites and five new
boundary regressions pass in a targeted run of 3 suites / 45 tests. The full
pre-fix run and post-fix targeted run are recorded separately; the full suite
has not been rerun against the final change.

Production builds now run main then renderer, with at most two minifier workers
in each phase. Webpack's asset-processing hook runs the JS and CSS minimizers in
series. This implements the job's resource limit; it does not prove the cause of
the earlier renderer exit 1, which supplied no compiler error or signal.
One bounded diagnostic rerun captured `SIGKILL` after about 6 minutes 36 seconds,
before final Webpack statistics; its 15-minute timeout was not reached. The host
exposes about 10 GiB RAM, but kernel/cgroup termination details are unavailable,
so memory pressure remains a hypothesis. Renderer qualification stays open.

Local Node 22.14.0/npm 10.9.2 checks and the generic ST-to-C++ smoke are recorded
in [the evidence summary](evidence/node22-2026-11-15/summary.json). The check host
is not unity and is not the prepared image. A local result is not a final fork
baseline or WB qualification. Existing lint warnings, stale Browserslist data,
the Tailwind broad-glob warning, and the separate `release/app` native dependency
installation remain explicit limitations; no dependency refresh was mixed into
this change.
