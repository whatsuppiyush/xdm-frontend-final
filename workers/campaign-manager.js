const { redis, prisma } = require('./config');
const { checkDailyLimit } = require('./limit-manager');

// Track active campaigns
const ACTIVE_CAMPAIGNS = new Map();

// Poll for active campaigns
async function pollForActiveCampaigns() {
  try {
    // Check if there's a notification about updated campaigns
    const campaignsUpdated = await redis.get('campaigns_updated');
    
    if (campaignsUpdated) {
      console.log(`[POLL] Campaigns update detected at ${new Date(parseInt(campaignsUpdated)).toISOString()}`);
      
      // Get the list of active campaigns
      const activeCampaignsData = await redis.get('active_campaigns');
      
      if (activeCampaignsData) {
        let activeCampaignIds = [];
        try {
          activeCampaignIds = JSON.parse(activeCampaignsData);
          if (!Array.isArray(activeCampaignIds)) {
            console.error('[POLL] Active campaigns data is not an array:', activeCampaignsData);
            activeCampaignIds = [];
          }
        } catch (parseError) {
          console.error('[POLL] Error parsing active campaigns data:', parseError.message);
          console.error('[POLL] Raw data:', activeCampaignsData);
          // Continue with empty array
          activeCampaignIds = [];
        }
        
        console.log(`[POLL] Found ${activeCampaignIds.length} active campaigns`);
        
        // Process each campaign not already being processed
        for (const campaignId of activeCampaignIds) {
          if (!ACTIVE_CAMPAIGNS.has(campaignId)) {
            console.log(`[POLL] Starting new campaign: ${campaignId}`);
            
            // Import CampaignQueue here to avoid circular dependency
            const { CampaignQueue } = require('./campaign-queue');
            const campaignQueue = new CampaignQueue(campaignId);
            await campaignQueue.loadFromRedis();
            
            if (campaignQueue.status === 'Running' && campaignQueue.queue.length > 0) {
              // Start the campaign processing in background
              campaignQueue.process().catch(error => {
                console.error(`[ERROR] Failed to process campaign ${campaignId}:`, error);
              });
            } else {
              console.log(`[POLL] Skipping campaign ${campaignId} with status ${campaignQueue.status} and queue length ${campaignQueue.queue.length}`);
            }
          } else {
            console.log(`[POLL] Campaign ${campaignId} is already being processed`);
          }
        }
        
        // Clear the notification
        await redis.del('campaigns_updated');
      }
    }
  } catch (error) {
    console.error('[POLL] Error polling for active campaigns:', error);
  }
}

// Recover active campaigns function
async function recoverActiveCampaigns() {
  try {
    console.log("[RECOVER] Recovering active campaigns");
    const queueKeys = await redis.keys('queue:*');
    console.log(`[RECOVER] Found ${queueKeys.length} campaign queues in Redis`);
    
    if (queueKeys.length === 0) {
      return { recovered: 0 };
    }
    
    let recoveredCount = 0;
    const activeCampaignIds = [];
    
    for (const queueKey of queueKeys) {
      const campaignId = queueKey.split(':')[1];
      
      if (!campaignId) continue;
      
      const campaign = await prisma.message.findUnique({
        where: { id: campaignId }
      });
      
      if (!campaign) continue;
      
      // Import CampaignQueue here to avoid circular dependency
      const { CampaignQueue } = require('./campaign-queue');
      const campaignQueue = new CampaignQueue(campaignId);
      await campaignQueue.loadFromRedis();
      
      if (campaignQueue.queue.length > 0 && campaignQueue.status !== 'Stopped') {
        console.log(`[RECOVER] Checking campaign ${campaignId} with status ${campaign.status}, queue status: ${campaignQueue.status}`);
        
        // For rate limited campaigns, check if limit has reset
        if (campaign.status === 'Rate Limited') {
          const userId = campaign.userId;
          const limitCheck = await checkDailyLimit(userId);
          
          if (limitCheck.canSend) {
            campaignQueue.status = 'Running';
            await campaignQueue.saveToRedis();
            
            await prisma.message.update({
              where: { id: campaignId },
              data: { status: 'In Progress' }
            });
            
            // Add to active campaigns
            activeCampaignIds.push(campaignId);
            recoveredCount++;
          }
        }
        // For In Progress or Running campaigns, ensure they're added to active list
        else if (campaignQueue.status === 'Running' || campaign.status === 'In Progress') {
          campaignQueue.status = 'Running';
          await campaignQueue.saveToRedis();
          
          activeCampaignIds.push(campaignId);
          recoveredCount++;
        }
      }
    }
    
    // Update the active campaigns list
    if (activeCampaignIds.length > 0) {
      await redis.set('active_campaigns', JSON.stringify(activeCampaignIds));
      await redis.set('campaigns_updated', Date.now().toString());
    }
    
    console.log(`[RECOVER] Recovered ${recoveredCount} campaigns`);
    return { recovered: recoveredCount };
  } catch (error) {
    console.error('[RECOVER] Error recovering campaigns:', error);
    return { recovered: 0, error: error.message };
  }
}

// Start campaign polling
function startCampaignPolling() {
  // Poll every 30 seconds
  setInterval(pollForActiveCampaigns, 30000);
  console.log('[POLL] Campaign polling started (every 30 seconds)');
}

module.exports = {
  ACTIVE_CAMPAIGNS,
  pollForActiveCampaigns,
  recoverActiveCampaigns,
  startCampaignPolling
}; 