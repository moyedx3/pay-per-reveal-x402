# Branching Strategy

## Current Setup

```
main (v1.0-mvp) ← Stable MVP version
  └── experimental ← You are here! Test new features safely
```

## Branches

### `main`
- **Status**: Stable MVP ✅
- **Tag**: `v1.0-mvp`
- **Features**: 
  - Configurable articles via JSON
  - Pay-per-reveal words
  - Repeated word instances (pay once, reveal all)
  - Korean/international language support
  - Smart word matching

### `experimental`
- **Status**: Active development 🧪
- **Purpose**: Test new features and ideas
- **Safe to break**: Yes! Main is protected

## Workflow

### Working on Experiments
You're already on `experimental` branch. Just code!

```bash
# Check current branch
git branch

# Make changes, commit as you go
git add .
git commit -m "experiment: trying new feature"
```

### Going Back to Stable MVP
```bash
# Switch back to stable version
git checkout main

# Or checkout the exact MVP tag
git checkout v1.0-mvp
```

### Merging Successful Experiments
```bash
# When experiment works and you want to keep it
git checkout main
git merge experimental
git tag -a v1.1 -m "Added: your new feature"
```

### Discarding Failed Experiments
```bash
# If experiment didn't work out
git checkout main
git branch -D experimental  # Delete the experimental branch
git checkout -b experimental  # Start fresh
```

### Creating New Experiment Branches
```bash
# For different experiments
git checkout main
git checkout -b experiment-feature-name
```

## Quick Commands

```bash
# See all branches
git branch

# See all tags (saved versions)
git tag -l

# Switch branches
git checkout <branch-name>

# Compare branches
git diff main experimental

# See what changed in experimental
git log main..experimental --oneline
```

## Recommended: Multiple Experiment Branches

For different experiments:
```bash
git checkout main
git checkout -b experiment-multiple-articles
# Work on multi-article feature...

git checkout main  
git checkout -b experiment-database
# Try database integration...

git checkout main
git checkout -b experiment-analytics
# Add analytics...
```

Keep `main` as your stable baseline!

## Emergency: Get Back to MVP

If things go wrong:
```bash
# Nuclear option - back to MVP, lose all changes
git checkout main
git reset --hard v1.0-mvp
```

## Push to Remote (Optional)

If you want to backup or share:
```bash
# Push all branches
git push origin main
git push origin experimental

# Push tags
git push origin v1.0-mvp
```

---

**Current Branch**: `experimental` 🧪
**Last Stable**: `main` (v1.0-mvp) ✅

Happy experimenting! 🚀

