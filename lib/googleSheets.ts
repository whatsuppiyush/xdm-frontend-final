import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { GoogleSpreadsheetRow } from 'google-spreadsheet';

// Google Sheets document ID from the URL
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1ZpmOsKRlwo342RyNZZ8vNKRwhJ6Zd1x3B0R0uG88xwk';
const SHEET_ID = 0; // Using the first sheet (gid=0)

// Function to push user data to Google Sheets
export async function pushUserToGoogleSheet(userData: { 
  email: string; 
  name?: string | null;
  provider?: string | null;
}) {
  try {
    // Load the service account credentials from environment variables
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    // Initialize the Google Spreadsheet
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    // Get the first sheet
    const sheet = doc.sheetsById[SHEET_ID];
    
    try {
      // First, try to get the header values
      await sheet.loadHeaderRow();
      
      // If we get here, headers exist, but check if they're empty
      if (!sheet.headerValues || sheet.headerValues.length === 0) {
        await sheet.setHeaderRow(['Email', 'Name', 'Provider', 'SignupDate']);
        console.log('Initialized sheet headers');
      }
    } catch (error) {
      // If there's an error loading headers, they probably don't exist
      // So we'll set them up
      await sheet.setHeaderRow(['Email', 'Name', 'Provider', 'SignupDate']);
      console.log('Initialized sheet headers');
    }
    
    // Format the data for the sheet
    const newRow = {
      Email: userData.email,
      Name: userData.name || '',
      Provider: userData.provider || 'credentials',
      SignupDate: new Date().toISOString(),
    };

    // Add the row to the sheet
    await sheet.addRow(newRow);
    
    console.log(`User ${userData.email} added to Google Sheet successfully`);
    return true;
  } catch (error) {
    console.error('Error pushing user data to Google Sheet:', error);
    // Don't throw the error, just log it so it doesn't block signup
    return false;
  }
}
