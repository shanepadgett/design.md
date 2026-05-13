---
name: npm-release
description: Guides design.md npm releases. Use for preparing, creating, or monitoring GitHub Release publish to npm.
---

# npm-release

Release `@shanepadgett/design.md` from this repo.

## Model

- GitHub Release publish triggers `.github/workflows/npm-publish.yml`.
- Target: npmjs.org, not GitHub Packages.
- Auth: npm provenance + GitHub OIDC trusted publishing.
- Tag must start with `v` and match `package.json` version.
- Do not create raw tag only. Create/publish GitHub Release.

## Safety

- Inspect repo state first.
- Dirty tree -> stop.
- No release/tag until user confirms final version + target commit.
- No `NPM_TOKEN` unless workflow changes require it.
- Missing npm trusted publishing -> stop. Tell user to configure it.

## Preflight

Run read-only checks:

```bash
git status --short
git branch --show-current
git remote -v
node -p "require('./package.json').name + '@' + require('./package.json').version"
```

Confirm:

- branch is `main`
- tree is clean
- package name is `@shanepadgett/design.md`
- version is intended release version
- `package-lock.json` root version matches `package.json`
- `.github/workflows/npm-publish.yml` exists
- npm trusted publishing is configured for repo/package

If needed:

```bash
node -p "require('./package-lock.json').packages[''].version"
```

## Create release

Ask user before state-changing commands.

Preferred with GitHub CLI:

```bash
VERSION=$(node -p "require('./package.json').version")
gh release create "v${VERSION}" --target main --title "v${VERSION}" --generate-notes
```

If `gh` unavailable, tell user to create GitHub Release manually:

- tag: `v<package.json version>`
- target: `main`
- title: `v<package.json version>`
- notes: generated notes fine
- publish release; do not save draft

## Monitor release

After release publish:

1. Watch GitHub Actions workflow `Publish npm`.
2. Confirm version validation passes.
3. Confirm build/test pass.
4. Confirm `npm publish --provenance --access public` succeeds.
5. Verify npm package:

```bash
npm view @shanepadgett/design.md version
npx --yes @shanepadgett/design.md --help
```

No background-watch. Use bounded polling, short sleeps, clear status.

Preferred GitHub CLI polling:

```bash
for attempt in $(seq 1 20); do
  RUN_ID=$(gh run list --workflow "Publish npm" --limit 1 --json databaseId --jq '.[0].databaseId')
  STATUS=$(gh run view "$RUN_ID" --json status,conclusion --jq '.status + " " + (.conclusion // "")')
  echo "Publish npm run $RUN_ID: $STATUS"

  if echo "$STATUS" | grep -q '^completed success$'; then
    exit 0
  fi

  if echo "$STATUS" | grep -q '^completed '; then
    gh run view "$RUN_ID" --log-failed
    exit 1
  fi

  sleep 15
done

echo "Timed out waiting for Publish npm. Check GitHub Actions manually."
exit 2
```

Use tool timeout around 360 seconds. If shell tool times out or polling cannot
find run, give GitHub Actions page as manual next step. Do not guess result.

Auth/OIDC failure -> tell user to configure npm trusted publishing:

- package: `@shanepadgett/design.md`
- repository: `shanepadgett/design.md`
- workflow: `.github/workflows/npm-publish.yml`

Then publish new patch version. Do not overwrite published npm versions.

## Failures

- Version mismatch: update package files or create matching release tag.
- Existing npm version: bump next version. npm versions immutable.
- Failed CI/test: fix code first, then create new release.
- Wrong tag/release before npm publish: delete GitHub Release/tag only after user confirms.
- Wrong version already published: deprecate bad version or publish corrected next version. Never republish same version.
