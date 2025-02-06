import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const screenshotsDir = path.join(process.cwd(), 'screenshots');
        const metadataPath = path.join(screenshotsDir, 'latest.json');

        // Check if metadata file exists
        if (!fs.existsSync(metadataPath)) {
            return NextResponse.json({ error: 'No screenshots available' }, { status: 404 });
        }

        // Read metadata to get latest screenshot path
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        const latestScreenshotPath = metadata.latestScreenshot;

        // Check if the screenshot file exists
        if (!fs.existsSync(latestScreenshotPath)) {
            return NextResponse.json({ 
                error: 'Screenshot file not found',
                metadata 
            }, { status: 404 });
        }

        // Read the screenshot file
        const imageBuffer = fs.readFileSync(latestScreenshotPath);

        // Get the filename from the path
        const filename = path.basename(latestScreenshotPath);

        // Create response with appropriate headers
        const response = new NextResponse(imageBuffer, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename=${filename}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        return response;
    } catch (error) {
        console.error('Error fetching screenshot:', error);
        return NextResponse.json(
            { error: 'Failed to fetch screenshot', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

// Add endpoint to get screenshot metadata
export async function HEAD() {
    try {
        const metadataPath = path.join(process.cwd(), 'screenshots', 'latest.json');
        
        if (!fs.existsSync(metadataPath)) {
            return new NextResponse(null, { status: 404 });
        }

        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        
        return new NextResponse(null, { 
            status: 200,
            headers: {
                'x-screenshot-timestamp': metadata.timestamp,
                'x-screenshot-error': metadata.error
            }
        });
    } catch (error) {
        return new NextResponse(null, { status: 500 });
    }
} 