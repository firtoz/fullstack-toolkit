# Contributing to Router Toolkit

## Commit Message Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation. All commit messages are validated by commitlint.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature (triggers minor version bump)
- **fix**: A bug fix (triggers patch version bump)
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Examples

```bash
# New feature (0.3.0 → 0.4.0)
git commit -m "feat: add new hook for dynamic routing"

# Bug fix (0.3.0 → 0.3.1)
git commit -m "fix: resolve memory leak in useCachedFetch"

# Breaking change (0.3.0 → 1.0.0)
git commit -m "feat!: redesign API for better type safety"

# With scope and body
git commit -m "feat(hooks): add useDynamicSubmitter hook

Add new hook for handling dynamic form submissions with automatic
validation and loading states."

# Documentation
git commit -m "docs: update README with new hook examples"
```

### Breaking Changes

To indicate a breaking change, add `!` after the type or add `BREAKING CHANGE:` in the footer:

```bash
git commit -m "feat!: remove deprecated useLegacyFetch hook"
# or
git commit -m "feat: update API design

BREAKING CHANGE: useFetch now returns different interface"
```

## Automated Releases

This project uses semantic-release for automated versioning and publishing:

- **feat**: Minor version bump (0.3.0 → 0.4.0)
- **fix**: Patch version bump (0.3.0 → 0.3.1)
- **Breaking changes**: Major version bump (0.3.0 → 1.0.0)

Releases are automatically:
- Published to npm
- Tagged in GitHub
- Added to GitHub Releases with changelog
- Changelog updated in repository

## Development Workflow

1. Make your changes
2. Commit with conventional format (validated by git hook)
3. Push to main branch
4. Automated release will be triggered if needed

The commit hook will prevent invalid commit messages from being committed. 