// Beehiiv API V2 integration
// Documentation: https://developers.beehiiv.com

/**
 * Pushes a user to Beehiiv publication
 * @param userData Object containing user data (email and name)
 * @returns Promise resolving to success status
 */
export async function pushUserToBeehiiv(userData: { 
  email: string; 
  name?: string | null;
  provider?: string | null;
}) {
  try {
    // Beehiiv API key should be stored in environment variables
    const apiKey = process.env.BEEHIIV_API_KEY;
    
    if (!apiKey) {
      throw new Error('Beehiiv API key is not configured');
    }

    // Beehiiv Publication IDs from the dashboard
    // API V2: pub_0dcba469-42d0-45f4-8250-9d38726249fa
    // API V1: 0dcba469-42d0-45f4-8250-9d38726249fa
    const publicationId = process.env.BEEHIIV_PUBLICATION_ID || 'pub_0dcba469-42d0-45f4-8250-9d38726249fa';

    // Create the subscriber in Beehiiv
    const createSubscriberEndpoint = 'https://api.beehiiv.com/v2/publications/' + publicationId + '/subscriptions';
    
    // Split the name into first and last name
    const firstName = userData.name?.split(' ')[0] || '';
    const lastName = userData.name?.split(' ').slice(1).join(' ') || '';
    
    // Simplified payload based on Beehiiv API V2 requirements
    // Removing potentially problematic fields
    const payload = {
      email: userData.email,
      referring_site: 'X-DM Signup',
      first_name: firstName,
      last_name: lastName,
      utm_source: userData.provider || 'credentials',
      send_welcome_email: true
    };
    
    console.log('Sending subscriber to Beehiiv with simplified payload:', payload);
    
    const response = await fetch(createSubscriberEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    // Log the full response for debugging
    let responseText = '';
    try {
      responseText = await response.text();
      console.log('Beehiiv raw response:', responseText);
      
      const responseData = JSON.parse(responseText);
      
      if (!response.ok) {
        // If the subscriber already exists, we can consider this a success
        if (response.status === 409) {
          console.log(`Subscriber ${userData.email} already exists in Beehiiv, considered successful`);
          return true;
        }
        throw new Error(`Beehiiv API error: ${responseData.message || response.statusText}`);
      }
      
      console.log(`User ${userData.email} added to Beehiiv publication successfully`);
      return true;
    } catch (parseError) {
      console.error('Error parsing Beehiiv response:', parseError);
      throw new Error(`Beehiiv API error: ${responseText || response.statusText}`);
    }
  } catch (error) {
    console.error('Error pushing user data to Beehiiv:', error);
    // Don't throw the error, just log it so it doesn't block signup
    return false;
  }
} 