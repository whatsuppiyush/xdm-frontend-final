// Instantly.ai API integration
// Documentation: https://developer.instantly.ai/

/**
 * Pushes a user to Instantly.ai campaign
 * @param userData Object containing user data (email and name)
 * @returns Promise resolving to success status
 */
export async function pushUserToInstantly(userData: { 
  email: string; 
  name?: string | null;
}) {
  try {
    // Instantly.ai API key should be stored in environment variables
    const apiKey = process.env.INSTANTLY_API_KEY;
    
    if (!apiKey) {
      throw new Error('Instantly API key is not configured');
    }

    // Instantly.ai campaign ID from the URL
    // https://app.instantly.ai/app/campaign/fad5f176-a928-4d4d-9eed-140b7a2054fa/analytics
    const campaignId = process.env.INSTANTLY_CAMPAIGN_ID || 'fad5f176-a928-4d4d-9eed-140b7a2054fa';
    
    // Split the name into first and last name
    const firstName = userData.name?.split(' ')[0] || '';
    const lastName = userData.name?.split(' ').slice(1).join(' ') || '';
    
    // Create the lead and associate it with the campaign in a single step
    // This approach is similar to the script you provided
    const createLeadEndpoint = 'https://api.instantly.ai/api/v2/leads';
    
    // Prepare the payload with all necessary fields
    const payload = {
      email: userData.email,
      first_name: firstName,
      last_name: lastName,
      campaign: campaignId,  // Associate with campaign directly
      contact_name: userData.name || firstName,
      payload: {
        source: 'X-DM Signup',
        signup_date: new Date().toISOString()
      }
    };
    
    console.log('Sending lead to Instantly.ai with payload:', payload);
    
    const response = await fetch(createLeadEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      // If the lead already exists (409 Conflict), we can consider this a success
      if (response.status === 409) {
        console.log(`Lead ${userData.email} already exists in Instantly.ai, considered successful`);
        return true;
      }
      throw new Error(`Instantly API error: ${responseData.message || response.statusText}`);
    }
    
    console.log(`User ${userData.email} added to Instantly.ai campaign successfully`);
    return true;
  } catch (error) {
    console.error('Error pushing user data to Instantly.ai:', error);
    // Don't throw the error, just log it so it doesn't block signup
    return false;
  }
}
