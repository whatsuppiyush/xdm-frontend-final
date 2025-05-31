# Twitter Rate Limit Management Guide

## Overview

Twitter's API has strict rate limits that can significantly impact scraping performance. This guide explains how to handle rate limits effectively using multiple accounts and proper strategies.

## Understanding Twitter Rate Limits

### Current Rate Limits (as of 2024)
- **Followers endpoint**: 15 requests per 15-minute window per account
- **User lookup**: 300 requests per 15-minute window per account  
- **User details**: 300 requests per 15-minute window per account
- **Rate limits reset every 15 minutes**

### Rate Limit Response
When you hit a rate limit, Twitter returns:
- HTTP Status Code: `429 Too Many Requests`
- Headers indicating when limits reset
- Error message: "Rate limit exceeded"

## Solutions Implemented

### 1. Multi-Account Strategy

**Files:**
- `multi_account_scraper.py` - Main scraper with account rotation
- `improved_scraper.py` - Enhanced single-account scraper
- `account_manager.py` - Account management utility

**Benefits:**
- Multiply your effective rate limit by number of accounts
- Automatic account rotation when limits hit
- Graceful fallback when accounts are unavailable

### 2. Intelligent Account Rotation

**Features:**
- Tracks last usage time for each account
- Monitors rate limit reset times
- Implements exponential backoff
- Disables accounts after consecutive failures

**Algorithm:**
```python
# Select least recently used available account
available_accounts.sort(key=lambda x: x.last_used)
selected_account = available_accounts[0]

# Add delay between requests on same account
if time_since_last_use < min_delay:
    await asyncio.sleep(random_delay)
```

### 3. Error Handling & Recovery

**Rate Limit Handling:**
```python
if "rate limit" in error_str or "429" in error_str:
    account.rate_limit_reset = now + timedelta(minutes=15)
    account.consecutive_failures += 1
    retry_with_different_account()
```

**Exponential Backoff:**
```python
backoff_delay = min(2 ** retry_count, 60)
await asyncio.sleep(backoff_delay)
```

## Setup Instructions

### 1. Install Dependencies

```bash
pip install twscrape==0.17.0
```

### 2. Add Multiple Twitter Accounts

**Option A: Interactive Setup**
```bash
cd backend
python account_manager.py setup
```

**Option B: Manual Addition**
```bash
python account_manager.py add cookies1.json account1
python account_manager.py add cookies2.json account2
python account_manager.py add cookies3.json account3
```

### 3. Test Your Accounts

```bash
python account_manager.py list
python account_manager.py test account1
```

### 4. Use Multi-Account Scraper

```bash
python multi_account_scraper.py username 100 --accounts-json '[
  {"cookies": [...], "twitterAccountName": "Account1"},
  {"cookies": [...], "twitterAccountName": "Account2"}
]'
```

## Best Practices

### Account Management
1. **Use 3-5 different Twitter accounts** for optimal performance
2. **Each account should have different cookies** (different browsers/sessions)
3. **Regularly validate account status** to ensure they're still active
4. **Monitor for suspended accounts** and replace as needed

### Request Patterns
1. **Add delays between requests** (1-3 seconds minimum)
2. **Batch requests intelligently** to maximize efficiency
3. **Implement circuit breakers** for failing accounts
4. **Use exponential backoff** for temporary failures

### Monitoring
1. **Log rate limit events** for analysis
2. **Track account usage patterns** to optimize rotation
3. **Monitor success/failure rates** per account
4. **Set up alerts** for when all accounts are rate limited

## Configuration Options

### Environment Variables
```bash
TWS_PROXY=socks5://user:pass@127.0.0.1:1080  # Global proxy
TWS_WAIT_EMAIL_CODE=30                        # Email verification timeout
TWS_RAISE_WHEN_NO_ACCOUNT=false              # Wait vs raise on no accounts
```

### Scraper Configuration
```python
class MultiAccountTwitterScraper:
    max_consecutive_failures = 3           # Disable account after N failures
    rate_limit_window = timedelta(minutes=15)  # Twitter's reset window
    min_delay_between_requests = 1         # Minimum delay between requests
    max_delay_between_requests = 3         # Maximum delay between requests
```

## Troubleshooting

### Common Issues

**"No account available for queue"**
- All accounts are rate limited
- Wait for rate limit reset (15 minutes)
- Add more accounts to your pool

**"Authorization error"**
- Account cookies have expired
- Account has been suspended
- Update cookies or remove account

**"All accounts are rate limited"**
- Normal behavior with heavy usage
- Scraper will wait for next available account
- Consider adding more accounts

### Debugging

**Enable debug logging:**
```bash
python multi_account_scraper.py username 100 --accounts-json '...' --debug
```

**Check account status:**
```bash
python account_manager.py list
python account_manager.py test account_name
```

## Performance Expectations

### With Single Account
- ~15 followers per 15 minutes (rate limit)
- Frequent waiting periods
- High chance of interruption

### With 5 Accounts
- ~75 followers per 15 minutes
- Minimal waiting periods
- Continuous operation possible

### Optimal Setup
- **5+ Twitter accounts** with valid cookies
- **Proxy rotation** (optional but recommended)
- **Monitoring and alerting** for account health

## Integration with Your App

The improved scrapers are already integrated into your Next.js API:

1. **API automatically fetches** user's Twitter accounts from database
2. **Falls back to single account** if no stored accounts found
3. **Handles rate limits gracefully** with proper error messages
4. **Logs detailed information** for debugging

### API Usage
```typescript
// Your existing API call works the same
const response = await fetch('/api/twitter/scrape-followers', {
  method: 'POST',
  body: JSON.stringify({
    profileUrl: 'https://twitter.com/username',
    count: 100,
    cookies: twitterCookies,
    userId: currentUserId
  })
});
```

## Monitoring Dashboard (Future Enhancement)

Consider adding:
- Real-time account status display
- Rate limit countdown timers
- Success/failure rate charts
- Account rotation visualization

## Legal and Ethical Considerations

- **Respect Twitter's Terms of Service**
- **Use reasonable request rates**
- **Don't abuse the platform**
- **Consider using official Twitter API** for production applications

## Support

For issues with rate limiting:
1. Check the logs for specific error messages
2. Verify account status with `account_manager.py`
3. Ensure you have multiple valid accounts
4. Consider adding delays or reducing request frequency 