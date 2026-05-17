---
name: npm-release
description: Guides design.md npm releases through Release Please and GitHub Release publish to npm.
---

# npm-release

Release `@shanepadgett/design.md` from this repo.

## Model

- Release Please is version source of truth.
- `.github/workflows/release-please.yml` runs only by manual `workflow_dispatch`.
- Release Please reads conventional commits since last `v*` tag and opens/updates a release PR.
- Release PR updates `package.json`, `package-lock.json`, `.release-please-manifest.json`, and `CHANGELOG.md`.
- Because Release Please workflow is manual-only, merging release PR updates `main` but does not automatically publish GitHub Release.
- After release PR merge, run Release Please manually a second time on `main`; that publishes GitHub Release with tag `v<version>`.
- GitHub Release publish triggers `.github/workflows/npm-publish.yml`.
- Target: npmjs.org, not GitHub Packages.
- Auth: npm provenance + GitHub OIDC trusted publishing.
- Release Please uses `secrets.RELEASE_PLEASE_TOKEN`, a fine-grained PAT with repository `Contents: Read and write` and `Pull requests: Read and write`, so releases it creates can trigger npm publish workflow.
- Do not manually bump versions or create raw tags in normal flow.
- Do not manually create GitHub Release unless repairing Release Please after user confirmation.
- Normal release flow is: ask user -> trigger Release Please -> inspect release PR -> ask user -> merge release PR -> ask user -> trigger Release Please again -> confirm GitHub Release -> monitor npm publish.

## Versioning

- Version bump comes from conventional commits since last release tag.
- `fix:` -> patch.
- `feat:` -> minor.
- breaking changes (`!` or `BREAKING CHANGE:`) -> major.
- Non-conventional commits may be ignored for version bump/release notes.
- Tag must start with `v` and match `package.json` version after release PR merge.

## Safety

- Inspect repo state first.
- Dirty tree -> stop unless user is explicitly editing release tooling/docs.
- No release/tag until user confirms target commit and intended Release Please PR.
- No manual version edits unless user explicitly wants to bypass Release Please.
- No `NPM_TOKEN` unless workflow changes require it.
- Missing npm trusted publishing -> stop. Tell user to configure it.

## Preflight

Run read-only checks:

```bash
git status --short
git branch --show-current
git remote -v
git tag --list --sort=-creatordate | head -10
git log --oneline --decorate -20
node -p "require('./package.json').name + '@' + require('./package.json').version"
node -p "require('./package-lock.json').packages[''].version"
```

Confirm:

- branch is `main`
- tree is clean
- package name is `@shanepadgett/design.md`
- `package.json`, `package-lock.json`, and `.release-please-manifest.json` versions match current release state
- latest tag is current published release tag
- commits since latest tag use conventional commits for desired bump
- `.github/workflows/release-please.yml` exists
- `.github/workflows/npm-publish.yml` exists
- `RELEASE_PLEASE_TOKEN` repository secret exists for Release Please
- npm trusted publishing is configured for repo/package/workflow

Useful read-only checks:

```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
gh pr list --state open --search "Release Please" --json number,title,url,headRefName
gh run list --workflow "Release Please" --limit 5
```

## Open or update release PR

Release Please does not run on every push. The skill triggers it only when the user asks to release.

If no release PR exists and commits since last tag should produce a release, ask user before state-changing commands:

> Trigger Release Please on `main` to open/update the computed release PR?

Then trigger Release Please:

```bash
gh workflow run "Release Please" --ref main
```

Poll bounded:

```bash
for attempt in $(seq 1 20); do
  RUN_ID=$(gh run list --workflow "Release Please" --limit 1 --json databaseId --jq '.[0].databaseId')
  STATUS=$(gh run view "$RUN_ID" --json status,conclusion --jq '.status + " " + (.conclusion // "")')
  echo "Release Please run $RUN_ID: $STATUS"

  if echo "$STATUS" | grep -q '^completed success$'; then
    exit 0
  fi

  if echo "$STATUS" | grep -q '^completed '; then
    gh run view "$RUN_ID" --log-failed
    exit 1
  fi

  sleep 15
done

echo "Timed out waiting for Release Please. Check GitHub Actions manually."
exit 2
```

Then inspect release PR:

```bash
gh pr list --state open --search "Release Please" --json number,title,url,headRefName
gh pr view <number> --json title,body,files,commits
```

Confirm PR version and changelog match intended release. If wrong, fix commit history or Release Please config before merging.

## Merge release PR

Ask user before merging.

Preferred:

```bash
gh pr merge <number> --squash --delete-branch
```

After merge, Release Please does not publish GitHub Release automatically because workflow only runs by `workflow_dispatch`. Ask user before the second state-changing command:

> Run Release Please again on `main` to publish GitHub Release `v<version>`?

Then trigger Release Please again:

```bash
gh workflow run "Release Please" --ref main
```

Poll bounded with same Release Please polling loop from "Open or update release PR".

Then confirm GitHub Release exists:

```bash
gh release view v<version> --json tagName,name,publishedAt,url
```

Do not create duplicate release manually.

If `gh` unavailable, tell user to merge release PR in GitHub UI and wait for Release Please to publish release.

## Monitor npm publish

After GitHub Release publish:

1. Watch GitHub Actions workflow `Publish npm`.
2. Confirm version validation passes.
3. Confirm build/typecheck/test pass.
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

Use tool timeout around 360 seconds. If shell tool times out or polling cannot find run, give GitHub Actions page as manual next step. Do not guess result.

Auth/OIDC failure -> tell user to configure npm trusted publishing:

- package: `@shanepadgett/design.md`
- repository: `shanepadgett/design.md`
- workflow: `.github/workflows/npm-publish.yml`

Then publish new patch version through Release Please. Do not overwrite published npm versions.

## Manual repair only

Only after user confirms Release Please cannot create/publish release:

```bash
VERSION=$(node -p "require('./package.json').version")
gh release create "v${VERSION}" --target main --title "v${VERSION}" --generate-notes
```

Manual release requires:

- `package.json` version matches `package-lock.json` root version
- `.release-please-manifest.json` version matches
- tag does not already exist
- npm version is not already published

## Failures

- No release PR: confirm conventional commits since last tag; trigger Release Please manually if needed.
- Wrong bump: fix commit messages or add an empty conventional commit, then rerun Release Please.
- Version mismatch: do not edit by hand in normal flow; fix/recreate release PR.
- Existing npm version: bump next version through Release Please. npm versions are immutable.
- Failed CI/test: fix code first; Release Please updates release PR after merge to `main`.
- Wrong tag/release before npm publish: delete GitHub Release/tag only after user confirms.
- Wrong version already published: deprecate bad version or publish corrected next version. Never republish same version.
