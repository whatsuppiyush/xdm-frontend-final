#!/usr/bin/env python3
"""
Optimized Twitter scraper that extracts DM availability from followers API response
Eliminates the need for separate DM availability checks
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Set
from dataclasses import dataclass
import concurrent.futures
from contextlib import aclosing

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
    account_name: str = ""
    followers_requests_made: int = 0

class OptimizedTwitterScraper:
    def __init__(self):
        self.accounts: List[AccountInfo] = []
        self.max_consecutive_failures = 3
        self.rate_limit_window = timedelta(minutes=15)
        self.min_delay_between_requests = 0.5
        self.max_delay_between_requests = 1.5
        self.batch_size = 200
        self.max_concurrent_accounts = 3

    async def setup_accounts_from_db_data(self, accounts_data: List[Dict]) -> bool:
        """Setup accounts from database data with improved error handling"""
        log.info(f"Setting up {len(accounts_data)} accounts from database...")
        
        setup_tasks = []
        for i, account_data in enumerate(accounts_data):
            setup_tasks.append(self._setup_single_account(i, account_data))
        
        results = await asyncio.gather(*setup_tasks, return_exceptions=True)
        
        successful_accounts = 0
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                log.error(f"Account {i+1} setup failed: {result}")
            elif result:
                successful_accounts += 1
        
        log.info(f"Successfully setup {successful_accounts}/{len(accounts_data)} accounts")
        return successful_accounts > 0

    async def _setup_single_account(self, index: int, account_data: Dict) -> bool:
        """Setup a single account"""
        try:
            cookies = account_data.get('cookies', [])
            account_name = account_data.get('twitterAccountName', f'DB_Account_{index+1}')
            
            if not cookies:
                log.warning(f"No cookies found for account {account_name}")
                return False
            
            pool = AccountsPool()
            api = API(pool)
            
            temp_username = f"_db_user_{uuid.uuid4().hex[:8]}"
            
            if isinstance(cookies, list) and len(cookies) > 0:
                if isinstance(cookies[0], dict) and 'name' in cookies[0]:
                    cookies_dict = {cookie['name']: cookie['value'] for cookie in cookies}
                else:
                    cookies_dict = cookies[0] if isinstance(cookies[0], dict) else {}
            else:
                cookies_dict = cookies if isinstance(cookies, dict) else {}
            
            cookies_str = json.dumps(cookies_dict)
            
            await api.pool.add_account(
                username=temp_username,
                password="_temp_pass_",
                email=f"_temp_email_{index}@example.com",
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
                    last_used=datetime.now() - timedelta(hours=1),
                    account_name=account_name
                )
                self.accounts.append(account_info)
                log.info(f"✓ Account {index+1} ({account_name}) setup successful")
                return True
            else:
                log.error(f"✗ Account {index+1} ({account_name}) setup failed: Could not find account in pool")
                return False
                
        except Exception as e:
            log.error(f"✗ Account {index+1} setup failed: {e}")
            return False

    async def get_available_account(self) -> Optional[AccountInfo]:
        """Get an available account with improved selection logic"""
        if not self.accounts:
            return None
        
        now = datetime.now()
        
        available_accounts = []
        for account in self.accounts:
            if not account.is_active:
                continue
                
            if account.rate_limit_reset and now < account.rate_limit_reset:
                continue
                
            if account.consecutive_failures >= self.max_consecutive_failures:
                continue
                
            if account.followers_requests_made >= 15:
                if not account.rate_limit_reset:
                    account.rate_limit_reset = account.last_used + self.rate_limit_window
                continue
                
            available_accounts.append(account)
        
        if not available_accounts:
            next_available = None
            for account in self.accounts:
                if account.rate_limit_reset and (not next_available or account.rate_limit_reset < next_available):
                    next_available = account.rate_limit_reset
            
            if next_available:
                wait_time = (next_available - now).total_seconds()
                if wait_time < 300:
                    log.info(f"Waiting {wait_time:.1f} seconds for account to become available...")
                    await asyncio.sleep(wait_time + 10)
                    
                    for account in self.accounts:
                        if account.rate_limit_reset and now >= account.rate_limit_reset:
                            account.rate_limit_reset = None
                            account.followers_requests_made = 0
                    
                    return await self.get_available_account()
            
            return None
        
        available_accounts.sort(key=lambda x: (x.followers_requests_made, x.last_used))
        selected_account = available_accounts[0]
        
        time_since_last_use = (now - selected_account.last_used).total_seconds()
        if time_since_last_use < self.min_delay_between_requests:
            delay = random.uniform(self.min_delay_between_requests, self.max_delay_between_requests)
            await asyncio.sleep(delay)
        
        selected_account.last_used = now
        selected_account.followers_requests_made += 1
        
        return selected_account

    def extract_dm_availability_from_raw_response(self, raw_response: dict) -> Dict[str, bool]:
        """Extract DM availability from raw Twitter API response"""
        dm_status = {}
        
        try:
            if 'data' in raw_response:
                data = raw_response['data']
                
                if 'user' in data and 'result' in data['user']:
                    timeline = data['user']['result'].get('timeline', {})
                    timeline_v2 = timeline.get('timeline', {})
                    instructions = timeline_v2.get('instructions', [])
                    
                    for instruction in instructions:
                        if instruction.get('type') == 'TimelineAddEntries':
                            entries = instruction.get('entries', [])
                            
                            for entry in entries:
                                content = entry.get('content', {})
                                if content.get('entryType') == 'TimelineTimelineItem':
                                    item_content = content.get('itemContent', {})
                                    if item_content.get('itemType') == 'TimelineUser':
                                        user_results = item_content.get('user_results', {})
                                        result = user_results.get('result', {})
                                        
                                        # Get user ID from rest_id or legacy.id_str
                                        user_id = result.get('rest_id') or result.get('legacy', {}).get('id_str')
                                        
                                        if user_id:
                                            # Try new GraphQL structure first (dm_permissions.can_dm)
                                            can_dm = result.get('dm_permissions', {}).get('can_dm', None)
                                            
                                            # Fallback to legacy structure if not found
                                            if can_dm is None:
                                                can_dm = result.get('legacy', {}).get('can_dm', False)
                                            
                                            dm_status[user_id] = can_dm
        except Exception as e:
            log.debug(f"Error extracting DM availability from raw response: {e}")
        
        return dm_status

    async def get_followers_with_dm_status(self, api: API, user_id: str, limit: int) -> List[Dict[str, Any]]:
        """Get followers with DM status in a single API call"""
        followers_with_dm = []
        count = 0
        
        try:
            async with aclosing(api.followers_raw(user_id, limit=limit)) as response_gen:
                async for raw_response in response_gen:
                    if raw_response.status_code != 200:
                        log.warning(f"API returned status {raw_response.status_code}")
                        continue
                    
                    response_data = raw_response.json()
                    dm_status_map = self.extract_dm_availability_from_raw_response(response_data)
                    
                    async for follower in api.followers(user_id, limit=limit):
                        follower_id = str(follower.id)
                        can_dm = dm_status_map.get(follower_id, None)
                        
                        if can_dm is True:
                            follower_data = self.extract_user_data(follower)
                            if follower_data:
                                followers_with_dm.append(follower_data)
                                count += 1
                                
                                if count >= limit:
                                    return followers_with_dm
                        
                        if count % 50 == 0 and count > 0:
                            log.info(f"Found {count} DM-available followers so far...")
                            
        except Exception as e:
            log.warning(f"Error in get_followers_with_dm_status: {e}")
            
        return followers_with_dm

    def extract_user_data(self, user_obj) -> Optional[Dict[str, Any]]:
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
                return None
                
            return user_data
        except Exception as e:
            log.error(f"Error extracting user data: {e}")
            return None

    async def scrape_batch_concurrent(self, username: str, limit: int) -> List[Dict[str, Any]]:
        """Scrape followers using multiple accounts concurrently"""
        try:
            if not self.accounts:
                log.error("No accounts available for scraping")
                return []
            
            first_account = await self.get_available_account()
            if not first_account:
                log.error("No available accounts")
                return []
            
            log.info(f"Looking up user @{username}...")
            user = await first_account.api.user_by_login(username)
            
            if not user:
                log.error(f"User @{username} not found")
                return []
            
            log.info(f"Found user: {getattr(user, 'displayname', user.username)} (@{user.username}) with {getattr(user, 'followersCount', 0):,} followers")
            
            all_followers = []
            batch_limit = limit // min(len(self.accounts), self.max_concurrent_accounts)
            
            if batch_limit < 50:
                batch_limit = limit
                concurrent_accounts = 1
            else:
                concurrent_accounts = min(len(self.accounts), self.max_concurrent_accounts)
            
            log.info(f"Using {concurrent_accounts} accounts concurrently, {batch_limit} followers per account")
            
            tasks = []
            for i in range(concurrent_accounts):
                account = await self.get_available_account()
                if account:
                    task = self._scrape_batch_for_account(account, user.id, batch_limit, i)
                    tasks.append(task)
            
            if not tasks:
                log.error("No accounts available for concurrent scraping")
                return []
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    log.error(f"Batch {i} failed: {result}")
                elif isinstance(result, list):
                    all_followers.extend(result)
                    log.info(f"Batch {i} completed: {len(result)} followers")
            
            unique_followers = self._deduplicate_followers(all_followers)
            
            if len(unique_followers) > limit:
                unique_followers = unique_followers[:limit]
            
            log.info(f"Scraping complete! Found {len(unique_followers)} unique DM-available followers")
            return unique_followers
            
        except Exception as e:
            log.error(f"Error during concurrent scraping: {e}")
            return []

    async def _scrape_batch_for_account(self, account: AccountInfo, user_id: str, limit: int, batch_index: int) -> List[Dict[str, Any]]:
        """Scrape a batch of followers using a specific account"""
        try:
            log.info(f"Batch {batch_index}: Starting with account {account.account_name}")
            
            followers = await self.get_followers_with_dm_status(account.api, user_id, limit)
            
            log.info(f"Batch {batch_index}: Found {len(followers)} DM-available followers")
            return followers
            
        except Exception as e:
            log.error(f"Batch {batch_index} error with account {account.account_name}: {e}")
            account.consecutive_failures += 1
            return []

    def _deduplicate_followers(self, followers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate followers based on user ID"""
        seen_ids: Set[str] = set()
        unique_followers = []
        
        for follower in followers:
            user_id = follower.get('id', '')
            if user_id and user_id not in seen_ids:
                seen_ids.add(user_id)
                unique_followers.append(follower)
        
        return unique_followers

async def scrape_with_optimized_accounts(username: str, limit: int, accounts_data: List[Dict]) -> List[Dict[str, Any]]:
    """Main optimized scraping function"""
    scraper = OptimizedTwitterScraper()
    
    if not await scraper.setup_accounts_from_db_data(accounts_data):
        log.error("Failed to setup any accounts from database")
        return []
    
    try:
        followers = await scraper.scrape_batch_concurrent(username, limit)
        return followers
        
    except Exception as e:
        log.error(f"Error during optimized scraping: {e}")
        return []

async def main():
    parser = argparse.ArgumentParser(description="Optimized Twitter follower scraper with batch processing")
    parser.add_argument("username", help="Twitter username to scrape (without @)")
    parser.add_argument("limit", type=int, nargs="?", default=100, help="Max number of DM-available followers to scrape")
    parser.add_argument("--accounts-json", type=str, required=True, help="JSON string of Twitter accounts from database")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    
    args = parser.parse_args()
    
    if args.debug:
        set_log_level("DEBUG")
        logging.getLogger().setLevel(logging.DEBUG)
    else:
        set_log_level("INFO")
    
    username = args.username.lstrip('@')
    
    try:
        accounts_data = json.loads(args.accounts_json)
        
        if not isinstance(accounts_data, list):
            log.error("accounts-json must be a list of account objects")
            sys.exit(1)
        
        log.info(f"Starting optimized scraper for @{username}, target: {args.limit} followers")
        log.info(f"Using {len(accounts_data)} Twitter accounts from database")
        
        followers = await scrape_with_optimized_accounts(username, args.limit, accounts_data)
        
        print(json.dumps(followers, indent=2))
        
        log.info(f"Optimized scraping completed. Found {len(followers)} DM-available followers")
        
    except json.JSONDecodeError:
        log.error("Invalid JSON in --accounts-json parameter")
        sys.exit(1)
    except Exception as e:
        log.error(f"Optimized scraping failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 