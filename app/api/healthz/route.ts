import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    const pythonExecutable = process.env.PYTHON_EXECUTABLE || '/usr/bin/python3';
    const backendPath = path.resolve(process.cwd(), 'backend');
    
    // Check if backend directory exists
    const backendExists = fs.existsSync(backendPath);
    
    // Check if Python scripts exist
    const scriptsExist = {
      smartBatchScraper: fs.existsSync(path.resolve(backendPath, 'smart_batch_scraper.py')),
      multiAccountScraper: fs.existsSync(path.resolve(backendPath, 'multi_account_scraper.py')),
      accountManager: fs.existsSync(path.resolve(backendPath, 'account_manager.py')),
      improvedScraper: fs.existsSync(path.resolve(backendPath, 'improved_scraper.py'))
    };

    // Test Python version and dependencies
    let pythonVersion = 'unknown';
    let twscrapeInstalled = false;
    
    try {
      const pythonProcess = spawn(pythonExecutable, ['--version'], { stdio: 'pipe' });
      await new Promise((resolve, reject) => {
        pythonProcess.stdout.on('data', (data) => {
          pythonVersion = data.toString().trim();
        });
        pythonProcess.on('close', (code) => {
          if (code === 0) resolve(code);
          else reject(new Error(`Python version check failed with code ${code}`));
        });
        pythonProcess.on('error', reject);
      });

      // Check if twscrape is installed
      const twscrapeProcess = spawn(pythonExecutable, ['-c', 'import twscrape; print("installed")'], { stdio: 'pipe' });
      await new Promise((resolve) => {
        twscrapeProcess.stdout.on('data', (data) => {
          if (data.toString().includes('installed')) {
            twscrapeInstalled = true;
          }
        });
        twscrapeProcess.on('close', () => resolve(0));
        twscrapeProcess.on('error', () => resolve(0));
      });
    } catch (error) {
      pythonVersion = 'error: ' + (error instanceof Error ? error.message : 'unknown');
    }

    const allScriptsExist = Object.values(scriptsExist).every(exists => exists);
    const isHealthy = backendExists && allScriptsExist && twscrapeInstalled;

    return NextResponse.json({ 
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'xAutoDM',
      version: '1.0.0',
      python: {
        executable: pythonExecutable,
        version: pythonVersion,
        twscrapeInstalled
      },
      backend: {
        path: backendPath,
        exists: backendExists,
        scripts: scriptsExist,
        allScriptsExist
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT || '3000'
      }
    }, { 
      status: isHealthy ? 200 : 503 
    });
  } catch (error) {
    return NextResponse.json({ 
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 