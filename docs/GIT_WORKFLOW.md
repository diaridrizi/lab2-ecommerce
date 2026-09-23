# Git workflow

## First-time setup (already done in this folder)

```bash
git init
git add .
git commit -m "chore: initial project setup"
```

## Put it on GitHub / GitLab

1. Create an **empty** repository on GitHub (no README, no .gitignore).
2. Connect and push:

```bash
git remote add origin https://github.com/<your-user>/lab2-ecommerce.git
git branch -M main
git push -u origin main
```

3. Add your teammates as collaborators (Settings → Collaborators).

## Branching (feature branches)

- `main` — always working, what you present.
- `develop` *(optional)* — integration branch for the team.
- `feature/<ticket>-<short-name>` — one branch per task, e.g. `feature/SHOP-12-product-search`.
- `fix/<ticket>-<short-name>` — bug fixes.

```bash
git checkout main
git pull
git checkout -b feature/SHOP-12-product-search
# ...work...
git add .
git commit -m "feat(products): add search by name"
git push -u origin feature/SHOP-12-product-search
# open a Pull Request on GitHub → a teammate reviews → merge
```

## Commit messages (Conventional Commits)

```
feat: new feature            feat(cart): allow changing quantity
fix: bug fix                 fix(checkout): prevent negative stock
docs: documentation          docs: add API table to README
refactor: code change        refactor(api): extract asyncHandler
style / test / chore
```

Put the ticket key in the branch name or commit (e.g. `SHOP-12`) so Jira/Trello can link commits to tasks.

## Rules for the team

- Never commit `.env` or `node_modules` (already in `.gitignore`).
- Pull before you start working: `git pull`.
- Small commits, one idea each.
- Every change to `main` goes through a Pull Request with at least one review.
