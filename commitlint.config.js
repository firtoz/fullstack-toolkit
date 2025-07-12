const fs = require('fs');
const path = require('path');

// Dynamically discover workspace packages
function getWorkspacePackages() {
  const packagesDir = path.join(__dirname, 'packages');
  
  try {
    const packages = fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    return packages;
  } catch (error) {
    console.warn('Could not read packages directory:', error.message);
    return [];
  }
}

// Get valid scopes from workspace packages
const workspacePackages = getWorkspacePackages();

module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    // Ignore semantic-release commits
    (commit) => commit.includes('chore(release)'),
    // Ignore merge commits
    (commit) => commit.includes('Merge branch'),
    (commit) => commit.includes('Merge pull request'),
  ],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New features
        'fix',      // Bug fixes
        'docs',     // Documentation changes
        'style',    // Code style changes (formatting, etc.)
        'refactor', // Code refactoring
        'perf',     // Performance improvements
        'test',     // Adding or updating tests
        'build',    // Build system changes
        'ci',       // CI/CD changes
        'chore',    // Maintenance tasks
        'revert',   // Reverting commits
      ],
    ],
    'scope-enum': [
      2,
      'always',
      workspacePackages, // 🚀 Dynamic package discovery!
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    'body-leading-blank': [1, 'always'],
    'body-max-line-length': [2, 'always', 100],
    'footer-leading-blank': [1, 'always'],
    'footer-max-line-length': [2, 'always', 100],
  },
}; 