import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface PluginConfig {
  npmPublish?: boolean;
  access?: 'public' | 'restricted';
}

interface Context {
  logger: {
    log: (message: string) => void;
    error: (message: string) => void;
  };
  cwd: string;
  nextRelease: {
    version: string;
    channel?: string;
  };
  env: {
    npm_package_name?: string;
  };
}

interface PublishResult {
  name: string;
  url: string;
  channel?: string;
}

/**
 * Custom semantic-release plugin that uses `bun publish` instead of `npm publish`
 * This properly handles workspace: dependencies by letting Bun replace them with actual versions
 */
export default {
  /**
   * Verify that we can publish using Bun
   */
  async verifyConditions(pluginConfig: PluginConfig, context: Context): Promise<void> {
    const { logger, cwd } = context;
    
    try {
      // Check if bun is available
      execSync('bun --version', { cwd, stdio: 'pipe' });
      logger.log('✅ Bun is available');
      
      // Check if we can access npm registry (for auth)
      execSync('bun pm whoami', { cwd, stdio: 'pipe' });
      logger.log('✅ NPM authentication is valid');
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Bun publish verification failed: ${message}`);
    }
  },

  /**
   * Prepare the package for publishing
   */
  async prepare(pluginConfig: PluginConfig, context: Context): Promise<void> {
    const { nextRelease, logger, cwd } = context;
    
    logger.log(`📦 Preparing package for publishing version ${nextRelease.version}`);
    
    // Read and update package.json version
    const packageJsonPath = join(cwd, 'package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    
    // Update version in package.json
    packageJson.version = nextRelease.version;
    
    // Write updated package.json
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    logger.log(`✅ Updated package.json version to ${nextRelease.version}`);
  },

  /**
   * Publish the package using bun publish
   */
  async publish(pluginConfig: PluginConfig, context: Context): Promise<PublishResult | undefined> {
    const { nextRelease, logger, cwd, env } = context;
    const { npmPublish = true, access = 'public' } = pluginConfig;
    
    if (!npmPublish) {
      logger.log('📦 Skipping publish (npmPublish: false)');
      return undefined;
    }
    
    logger.log(`🚀 Publishing ${nextRelease.version} using bun publish`);
    
    try {
      // Use bun publish with proper access control
      const publishCmd = `bun publish --access ${access}`;
      
      logger.log(`Running: ${publishCmd}`);
      
      const output = execSync(publishCmd, {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      logger.log(`✅ Published successfully:`);
      logger.log(output);
      
      // Get package name from package.json if not in env
      let packageName = env.npm_package_name;
      if (!packageName) {
        const packageJsonPath = join(cwd, 'package.json');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        packageName = packageJson.name;
      }
      
      return {
        name: 'npm package (@bun)',
        url: `https://www.npmjs.com/package/${packageName}`,
        channel: nextRelease.channel
      };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Publish failed: ${message}`);
      throw new Error(`Failed to publish with bun: ${message}`);
    }
  }
}; 