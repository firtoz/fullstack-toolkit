const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Strategy 1: Use bun workspaces command
function getPackagesFromBun() {
  try {
    const output = execSync('bun pm ls', { 
      encoding: 'utf8', 
      stdio: 'pipe',
      cwd: __dirname 
    });
    
    // Parse workspace packages from bun output
    const packages = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Look for workspace packages (format: ├── @scope/package-name@workspace:packages/package-name)
      const workspaceMatch = line.match(/[@]([^/]+)\/([^@]+)@workspace:/);
      if (workspaceMatch) {
        const packageName = workspaceMatch[2]; // Extract package-name from @scope/package-name
        packages.push(packageName);
      }
    }
    
    return packages.length > 0 ? packages : null;
  } catch (error) {
    console.warn('Could not detect packages via bun:', error.message);
    return null;
  }
}

// Strategy 2: Parse package.json workspaces
function getPackagesFromWorkspaces() {
  try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (!packageJson.workspaces) return null;
    
    const workspacePatterns = Array.isArray(packageJson.workspaces) 
      ? packageJson.workspaces 
      : packageJson.workspaces.packages || [];
    
    const packages = [];
    
    for (const pattern of workspacePatterns) {
      // Handle simple patterns like "packages/*"
      if (pattern.endsWith('/*')) {
        const baseDir = pattern.slice(0, -2);
        const fullPath = path.join(__dirname, baseDir);
        
        if (fs.existsSync(fullPath)) {
          const dirs = fs.readdirSync(fullPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
          
          packages.push(...dirs);
        }
      }
      // Handle specific package paths like "packages/specific-package"
      else {
        const packagePath = path.join(__dirname, pattern);
        if (fs.existsSync(packagePath)) {
          const packageName = path.basename(pattern);
          packages.push(packageName);
        }
      }
    }
    
    return packages.length > 0 ? packages : null;
  } catch (error) {
    console.warn('Could not detect packages via workspaces:', error.message);
    return null;
  }
}

// Strategy 3: Fallback to filesystem discovery
function getPackagesFromFilesystem() {
  try {
    const packagesDir = path.join(__dirname, 'packages');
    
    if (!fs.existsSync(packagesDir)) return [];
    
    const packages = fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    return packages;
  } catch (error) {
    console.warn('Could not detect packages via filesystem:', error.message);
    return [];
  }
}

// Multi-strategy package discovery
function getWorkspacePackages() {
  console.log('🔍 Detecting workspace packages...');
  
  // Try bun first
  const bunPackages = getPackagesFromBun();
  if (bunPackages) {
    console.log('✅ Found packages via bun:', bunPackages);
    return bunPackages;
  }
  
  // Try package.json workspaces
  const workspacePackages = getPackagesFromWorkspaces();
  if (workspacePackages) {
    console.log('✅ Found packages via workspaces:', workspacePackages);
    return workspacePackages;
  }
  
  // Fallback to filesystem
  const filesystemPackages = getPackagesFromFilesystem();
  if (filesystemPackages.length > 0) {
    console.log('✅ Found packages via filesystem:', filesystemPackages);
    return filesystemPackages;
  }
  
  console.warn('⚠️  No packages detected, using empty array');
  return [];
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
      workspacePackages, // 🚀 Multi-strategy package discovery!
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