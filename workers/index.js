const express = require('express');
const app = express();

// Import required modules
const { CampaignQueue } = require('./campaign-queue');
const { sendDM } = require('./message-sender');
const { messageTransformFunction } = require('./config');
const { checkDailyLimit, incrementDailyLimit } = require('./limit-manager');
const { BROWSER_INSTANCES } = require('./browser-manager');
const { 
  ACTIVE_CAMPAIGNS, 
  recoverActiveCampaigns, 
  startCampaignPolling,
  resetInvalidCampaignsKey
} = require('./campaign-manager');

// API endpoints - keep only the health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    activeCampaigns: Array.from(ACTIVE_CAMPAIGNS.keys()),
    activeBrowsers: Array.from(BROWSER_INSTANCES.keys())
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Background worker service running on port ${PORT}`);
  
  // Reset invalid active_campaigns key on startup
  await resetInvalidCampaignsKey();
  
  // Recover campaigns on startup
  await recoverActiveCampaigns();
  
  // Start polling for new campaigns
  startCampaignPolling();
});

module.exports = {
  CampaignQueue,
  sendDM,
  messageTransformFunction,
  checkDailyLimit,
  incrementDailyLimit,
  recoverActiveCampaigns
}; 