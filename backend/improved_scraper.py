import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

from twscrape import API, AccountsPool, User
from twscrape.logger import set_log_level

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

@dataclass
class AccountInfo:
    username: str
    api: API
    last_used: datetime
    rate_limit_reset: Optional[datetime] = None
    consecutive_failures: int = 0
    is_active: bool = True

class TwitterScraperPool:
    def __init__(self):
        self.accounts: List[AccountInfo] = []
        self.current_account_index = 0
        self.max_consecutive_failures = 3
        self.rate_limit_window = timedelta(minutes=15)
        self.min_delay_between_requests = 2
        self.max_delay_between_requests = 5

    async def setup_accounts_from_cookies(self, cookies_list: List[Dict]) -> bool:
        """Setup multiple accounts from a list of cookie dictionaries"""
        log.info(f"Setting up {len(cookies_list)} accounts...")
        
        for i, cookies in enumerate(cookies_list):
            try:
                pool = AccountsPool()
                api = API(pool)
                
                temp_username = f"_temp_user_{uuid.uuid4().hex[:8]}"
                cookies_str = json.dumps(cookies)
                
                await api.pool.add_account(
                    username=temp_username,
                    password="_temp_pass_",
                    email=f"_temp_email_{i}@example.com",
                    email_password="_",
                    cookies=cookies_str
                )
                
                accounts = await api.pool.get_all()
                account = next((a for a in accounts if a.username == temp_username), None)
                
                if account:
                    await api.pool.login(account)
                    
                    account_info = AccountInfo(
                        username=temp_username,
                        api=api,
                        last_used=datetime.now() - timedelta(hours=1)
                    )
                    self.accounts.append(account_info)
                    log.info(f"✓ Account {i+1} setup successful: {temp_username}")
                else:
                    log.error(f"✗ Account {i+1} setup failed: Could not find account in pool")
                    
            except Exception as e:
                log.error(f"✗ Account {i+1} setup failed: {e}")
        
        active_accounts = len([a for a in self.accounts if a.is_active])
        log.info(f"Successfully setup {active_accounts}/{len(cookies_list)} accounts")
        return active_accounts > 0

    async def get_available_account(self) -> Optional[AccountInfo]:
        """Get an available account that's not rate limited"""
        if not self.accounts:
            return None
        
        now = datetime.now()
        
        # Filter accounts that are active and not rate limited
        available_accounts = []
        for account in self.accounts:
            if not account.is_active:
                continue
                
            if account.rate_limit_reset and now < account.rate_limit_reset:
                continue
                
            if account.consecutive_failures >= self.max_consecutive_failures:
                continue
                
            available_accounts.append(account)
        
        if not available_accounts:
            # Check if any accounts will be available soon
            next_available = None
            for account in self.accounts:
                if account.rate_limit_reset and (not next_available or account.rate_limit_reset < next_available):
                    next_available = account.rate_limit_reset
            
            if next_available:
                wait_time = (next_available - now).total_seconds()
                log.warning(f"All accounts rate limited. Next available in {wait_time:.1f} seconds")
                if wait_time < 300:  # Wait up to 5 minutes
                    await asyncio.sleep(wait_time + 10)
                    return await self.get_available_account()
            
            return None
        
        # Sort by last used time and return the least recently used
        available_accounts.sort(key=lambda x: x.last_used)
        selected_account = available_accounts[0]
        
        # Add delay between requests on same account
        time_since_last_use = (now - selected_account.last_used).total_seconds()
        if time_since_last_use < self.min_delay_between_requests:
            delay = random.uniform(self.min_delay_between_requests, self.max_delay_between_requests)
            await asyncio.sleep(delay)
        
        selected_account.last_used = now
        return selected_account

    async def handle_rate_limit(self, account: AccountInfo, error: Exception):
        """Handle rate limit for a specific account"""
        log.warning(f"Rate limit hit for account {account.username}: {error}")
        account.rate_limit_reset = datetime.now() + self.rate_limit_window
        account.consecutive_failures += 1
        
        if account.consecutive_failures >= self.max_consecutive_failures:
            log.error(f"Account {account.username} disabled due to consecutive failures")
            account.is_active = False

    async def handle_success(self, account: AccountInfo):
        """Reset failure count on successful request"""
        account.consecutive_failures = 0

    async def make_api_request(self, request_func, *args, **kwargs):
        """Make an API request with automatic account rotation and retry logic"""
        max_retries = len(self.accounts) * 2
        retry_count = 0
        
        while retry_count < max_retries:
            account = await self.get_available_account()
            if not account:
                log.error("No available accounts for API request")
                raise Exception("All accounts are rate limited or unavailable")
            
            try:
                result = await request_func(account.api, *args, **kwargs)
                await self.handle_success(account)
                return result
                
            except Exception as e:
                error_str = str(e).lower()
                if "rate limit" in error_str or "429" in error_str:
                    await self.handle_rate_limit(account, e)
                    retry_count += 1
                    continue
                elif "authorization" in error_str or "401" in error_str:
                    log.error(f"Authorization error for account {account.username}: {e}")
                    account.is_active = False
                    retry_count += 1
                    continue
                else:
                    # Non-rate-limit error, propagate it
                    raise e
        
        raise Exception(f"Failed to complete request after {max_retries} retries")

async def get_user_by_login(api: API, username: str) -> User:
    """Wrapper for user lookup"""
    return await api.user_by_login(username)

async def get_followers(api: API, user_id: str, limit: int):
    """Wrapper for followers API"""
    followers = []
    count = 0
    async for follower in api.followers(user_id, limit=limit):
        followers.append(follower)
        count += 1
        if count >= limit:
            break
    return followers

async def check_dm_availability(api: API, user_id: str) -> Optional[bool]:
    """Check DM availability for a user"""
    try:
        response = await api.user_by_id_raw(user_id)
        if response.status_code == 200:
            data = response.json()
            can_dm = data.get('data', {}).get('user', {}).get('result', {}).get('legacy', {}).get('can_dm', None)
            return can_dm
    except Exception as e:
        log.debug(f"Error checking DM availability for user {user_id}: {e}")
    return None

def extract_user_data(user_obj) -> Optional[Dict[str, Any]]:
    """Extract user data with proper field mapping"""
    try:
        user_data = {
            "id": str(getattr(user_obj, 'id', '') or getattr(user_obj, 'id_str', '')),
            "username": getattr(user_obj, 'username', ''),
            "name": getattr(user_obj, 'displayname', '') or getattr(user_obj, 'name', ''),
            "bio": getattr(user_obj, 'rawDescription', '') or getattr(user_obj, 'description', '') or "No bio available",
            "followers": getattr(user_obj, 'followersCount', 0) or getattr(user_obj, 'followers_count', 0) or 0,
            "following": getattr(user_obj, 'followingCount', 0) or getattr(user_obj, 'friends_count', 0) or 0,
            "status": "Active"
        }
        
        if not user_data["name"] and not user_data["username"]:
            log.warning(f"User object missing basic info: {user_obj}")
            return None
            
        return user_data
    except Exception as e:
        log.error(f"Error extracting user data: {e}")
        return None

async def scrape_followers_with_dm_check(username: str, limit: int, cookies_list: List[Dict]) -> List[Dict[str, Any]]:
    """Main scraping function with improved rate limit handling"""
    scraper_pool = TwitterScraperPool()
    
    # Setup accounts
    if not await scraper_pool.setup_accounts_from_cookies(cookies_list):
        log.error("Failed to setup any accounts")
        return []
    
    try:
        # Get user info
        log.info(f"Looking up user @{username}...")
        user = await scraper_pool.make_api_request(get_user_by_login, username)
        
        if not user:
            log.error(f"User @{username} not found")
            return []
        
        log.info(f"Found user: {getattr(user, 'displayname', user.username)} (@{user.username}) with {getattr(user, 'followersCount', 0):,} followers")
        
        # Get followers
        log.info(f"Scraping up to {limit} DM-available followers...")
        scraped_followers = []
        total_checked = 0
        
        # Get more followers than needed to account for DM filtering
        api_limit = min(limit * 4, 2000)
        
        followers = await scraper_pool.make_api_request(get_followers, user.id, api_limit)
        log.info(f"Retrieved {len(followers)} followers to check for DM availability")
        
        for follower in followers:
            total_checked += 1
            
            if total_checked % 50 == 0:
                log.info(f"Checked {total_checked} followers, found {len(scraped_followers)} DM-available so far...")
            
            # Check DM availability
            try:
                can_dm = await scraper_pool.make_api_request(check_dm_availability, follower.id)
                
                if can_dm:
                    follower_data = extract_user_data(follower)
                    if follower_data:
                        scraped_followers.append(follower_data)
                        
                        if len(scraped_followers) >= limit:
                            log.info(f"Reached target of {limit} DM-available followers")
                            break
                            
            except Exception as e:
                log.warning(f"Error checking DM availability for follower {follower.id}: {e}")
                continue
        
        log.info(f"Scraping complete! Found {len(scraped_followers)} DM-available followers out of {total_checked} checked")
        return scraped_followers
        
    except Exception as e:
        log.error(f"Error during scraping: {e}")
        return []

async def main():
    parser = argparse.ArgumentParser(description="Improved Twitter follower scraper with rate limit handling")
    parser.add_argument("username", help="Twitter username to scrape (without @)")
    parser.add_argument("limit", type=int, nargs="?", default=100, help="Max number of DM-available followers to scrape")
    parser.add_argument("--cookies-json", type=str, required=True, help="JSON string of cookies for authentication")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    
    args = parser.parse_args()
    
    if args.debug:
        set_log_level("DEBUG")
        logging.getLogger().setLevel(logging.DEBUG)
    else:
        set_log_level("INFO")
    
    username = args.username.lstrip('@')
    
    try:
        cookies = json.loads(args.cookies_json)
        # For now, use the same cookies for multiple accounts
        # In production, you'd want different cookies for each account
        cookies_list = [cookies] * 3  # Create 3 accounts with same cookies
        
        log.info(f"Starting improved scraper for @{username}, target: {args.limit} followers")
        
        followers = await scrape_followers_with_dm_check(username, args.limit, cookies_list)
        
        # Output results to stdout as JSON
        print(json.dumps(followers, indent=2))
        
        log.info(f"Scraping completed. Found {len(followers)} DM-available followers")
        
    except json.JSONDecodeError:
        log.error("Invalid JSON in --cookies-json parameter")
        sys.exit(1)
    except Exception as e:
        log.error(f"Scraping failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 