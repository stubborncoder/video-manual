---
description: GitHub Pull Request operations
argument-hint: "<list|create|view|checks|merge> [number]"
allowed-tools: ["Bash", "Read"]
---

# GitHub Pull Requests

Manage pull requests for the vDocs repository.

## Commands

### `list`
List open pull requests.

```bash
gh pr list
```

With more details:
```bash
gh pr list --json number,title,author,createdAt,headRefName --template '{{range .}}#{{.number}} {{.title}} ({{.headRefName}}) by {{.author.login}}{{"\n"}}{{end}}'
```

### `create`
Create a new pull request.

First, ensure changes are committed and pushed:
```bash
git push -u origin $(git branch --show-current)
```

Then create PR:
```bash
gh pr create --title "Title" --body "## Summary
- Change 1
- Change 2

## Test Plan
- [ ] Tested locally
- [ ] CI passes"
```

Interactive mode:
```bash
gh pr create
```

### `view [number]`
View PR details.

```bash
gh pr view <number>
```

View in browser:
```bash
gh pr view <number> --web
```

### `checks [number]`
View CI check status for a PR.

```bash
gh pr checks <number>
```

Wait for checks to complete:
```bash
gh pr checks <number> --watch
```

### `merge [number]`
Merge a pull request (after CI passes).

```bash
gh pr merge <number> --squash --delete-branch
```

Options:
- `--squash`: Squash commits
- `--merge`: Create merge commit
- `--rebase`: Rebase and merge
- `--delete-branch`: Delete branch after merge

### `checkout [number]`
Checkout a PR locally for testing.

```bash
gh pr checkout <number>
```

## Workflow

1. Create branch: `git checkout -b feature/my-feature`
2. Make changes and commit
3. Push: `git push -u origin feature/my-feature`
4. Create PR: `/vdocs:gh-pr create`
5. Wait for CI: `/vdocs:gh-pr checks <number>`
6. Merge: `/vdocs:gh-pr merge <number>`

## Tips

- Always wait for CI checks before merging
- Use squash merge for cleaner history
- Delete branch after merge
