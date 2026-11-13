#!/usr/bin/env bash
# Baseline fork check. Run only in the prepared, digest-pinned editor image.
set -euo pipefail
export CI=true
export npm_config_jobs=2
export OMP_NUM_THREADS=2
report_tool="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/check_reports.py"
python3 "$report_tool" init editor reports
finish() {
  status=$?
  trap - EXIT
  baseline=()
  if [[ -f ci/test-counts-baseline.json ]]; then baseline=(--expected-counts ci/test-counts-baseline.json); fi
  if ! python3 "$report_tool" finish editor reports --exit-code "$status" "${baseline[@]}"; then
    if (( status == 0 )); then status=1; fi
  fi
  exit "$status"
}
trap finish EXIT
node --version | tee reports/node.txt
node -e 'if (process.versions.node.split(".")[0] !== "22") process.exit(1)'
npm ci 2>&1 | tee reports/npm-ci.log
npx --no-install tsc --noEmit 2>&1 | tee reports/types.log
npm run lint 2>&1 | tee reports/lint.log
npm run validate:arch 2>&1 | tee reports/architecture.log
npx --no-install jest --config jest.config.json --listTests --runInBand --json > reports/jest-plan.json
npx --no-install jest --config jest.config.json --collectCoverage --runInBand --ci --json --outputFile=reports/jest.json 2>&1 | tee reports/unit.log
npm run build 2>&1 | tee reports/build.log
