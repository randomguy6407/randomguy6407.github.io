#!/usr/bin/env bash
set -euo pipefail

run_id=${1:?Usage: bash scripts/publish.sh SUCCESSFUL_ACTIONS_RUN_ID}
[[ "$run_id" =~ ^[0-9]+$ ]] || { echo 'Run ID must be numeric.' >&2; exit 1; }
source_repo=randomguy6407/randomguy-blog
site_repo=randomguy6407/randomguy6407.github.io
conclusion=$(gh run view "$run_id" --repo "$source_repo" --json conclusion --jq .conclusion)
[[ "$conclusion" == success ]] || { echo 'The source workflow must pass before publishing.' >&2; exit 1; }
source_sha=$(gh run view "$run_id" --repo "$source_repo" --json headSha --jq .headSha)
mkdir -p work
publish_dir=$(mktemp -d "$PWD/work/publish.XXXXXX")
gh run download "$run_id" --repo "$source_repo" --name website --dir "$publish_dir/artifact"
test -s "$publish_dir/artifact/index.html"
gh repo clone "$site_repo" "$publish_dir/site"
cd "$publish_dir/site"
# The checkout is newly created above and contains generated website files only.
git ls-files -z | xargs -0 -r rm --
cp -a "$publish_dir/artifact/." .
touch .nojekyll
git add -A
if git diff --cached --quiet; then
  echo 'The published files already match this build.'
else
  git -c user.name=randomguy6407 -c user.email=88926424+randomguy6407@users.noreply.github.com \
    commit -m "Publish source $source_sha (Actions run $run_id)"
  git push origin HEAD:main
fi
echo 'Generated files uploaded. Pages must be enabled in the site repository to serve them.'
