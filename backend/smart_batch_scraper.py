#!/usr/bin/env python3
"""
Optimized smart batch scraper for fast DM-available follower discovery
Uses concurrent processing and aggressive optimizations for maximum speed
Enhanced with queue-based rate limit handling
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
import random
import contextlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Set
from dataclasses import dataclass
from collections import deque
import time

from twscrape import API, AccountsPool, User
from twscrape.logger import set_log_level

# Completely suppress all logging
import os
os.environ['TWS_RAISE_WHEN_NO_ACCOUNT'] = '1'  # Don't wait for rate limits (use '1' not 'true')

# Disable all logging
logging.disable(logging.CRITICAL)
log = logging.getLogger(__name__)

# Suppress all library logs
for logger_name in ['twscrape', 'httpx', 'httpcore', 'asyncio', 'urllib3']:
    logging.getLogger(logger_name).disabled = True
    logging.getLogger(logger_name).setLevel(logging.CRITICAL + 1)

@dataclass
class AccountInfo:
    username: str
    api: API
    last_used: datetime
    rate_limit_reset: Optional[datetime] = None
    consecutive_failures: int = 0
    is_active: bool = True
    account_name: str = ""
    followers_requests: int = 0
    dm_check_requests: int = 0
    in_queue: bool = False
    queue_until: Optional[datetime] = None

@dataclass
class QueuedRequest:
    account: AccountInfo
    request_type: str
    queued_at: datetime
    retry_after: datetime

@contextlib.contextmanager
def suppress_stderr():
    """Temporarily suppress stderr to hide library logs - disabled to prevent issues"""
    # Just yield without suppression to avoid I/O issues
    yield

class SmartBatchScraper:
    def __init__(self):
        self.accounts: List[AccountInfo] = []
        self.max_consecutive_failures = 3
        self.rate_limit_window = timedelta(minutes=15)
        self.min_delay_between_requests = 0.05
        self.max_delay_between_requests = 0.15
        self.batch_size = 200
        self.dm_check_batch_size = 50
        self.concurrent_dm_checks = 10
        self.followers_accounts: List[AccountInfo] = []  # Dedicated for followers API
        self.dm_check_accounts: List[AccountInfo] = []   # Dedicated for DM checks
        
        # Queue system for rate-limited accounts
        self.rate_limit_queue: deque[QueuedRequest] = deque()
        self.queue_check_interval = 30  # Check queue every 30 seconds
        self.max_queue_wait = timedelta(minutes=20)  # Max time to keep account in queue
        
    async def setup_accounts_from_db_data(self, accounts_data: List[Dict]) -> bool:
        """Setup accounts from database data with smart distribution"""
        print(f"Setting up {len(accounts_data)} accounts...", file=sys.stderr)
        
        for i, account_data in enumerate(accounts_data):
            try:
                cookies = account_data.get('cookies', [])
                account_name = account_data.get('twitterAccountName', f'Account_{i+1}')
                
                if not cookies:
                    continue
                
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
                
                try:
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
                        last_used=datetime.now() - timedelta(hours=1),
                        account_name=account_name
                    )
                    self.accounts.append(account_info)
                    print(f"✓ Account {account_name} ready", file=sys.stderr)
                    
                except Exception as setup_error:
                    print(f"Setup error for {account_name}: {str(setup_error)[:50]}", file=sys.stderr)
                    continue
                    
            except Exception as e:
                print(f"✗ Account {i+1} failed: {str(e)[:50]}", file=sys.stderr)
        
        # Distribute accounts for different purposes
        active_accounts = [a for a in self.accounts if a.is_active]
        total_accounts = len(active_accounts)
        
        if total_accounts == 0:
            print("No active accounts available after setup", file=sys.stderr)
            return False
        elif total_accounts == 1:
            # Single account - use for both
            self.followers_accounts = active_accounts.copy()
            self.dm_check_accounts = active_accounts.copy()
        elif total_accounts == 2:
            # Two accounts - one for each purpose
            self.followers_accounts = [active_accounts[0]]
            self.dm_check_accounts = [active_accounts[1]]
        elif total_accounts == 3:
            # Three accounts - 2 for followers, 1 for DM checks (better balance)
            self.followers_accounts = active_accounts[:2]
            self.dm_check_accounts = [active_accounts[2]]
        else:
            # Multiple accounts - distribute optimally
            # Use 1/2 for followers (less rate limited), 1/2 for DM checks (more rate limited)
            followers_count = max(1, total_accounts // 2)
            self.followers_accounts = active_accounts[:followers_count]
            self.dm_check_accounts = active_accounts[followers_count:]
        
        print(f"Account distribution: {len(self.followers_accounts)} for followers, {len(self.dm_check_accounts)} for DM checks", file=sys.stderr)
        return total_accounts > 0

    def add_account_to_queue(self, account: AccountInfo, request_type: str, retry_after_minutes: int = 15):
        """Add account to rate limit queue"""
        retry_after = datetime.now() + timedelta(minutes=retry_after_minutes)
        account.in_queue = True
        account.queue_until = retry_after
        account.rate_limit_reset = retry_after
        
        queued_request = QueuedRequest(
            account=account,
            request_type=request_type,
            queued_at=datetime.now(),
            retry_after=retry_after
        )
        
        self.rate_limit_queue.append(queued_request)
        print(f"⏳ Account {account.account_name} queued for {request_type} until {retry_after.strftime('%H:%M:%S')}", file=sys.stderr)

    def process_queue(self) -> List[AccountInfo]:
        """Process the rate limit queue and return accounts ready to use"""
        now = datetime.now()
        ready_accounts = []
        
        if len(self.rate_limit_queue) == 0:
            return ready_accounts
        
        print(f"🔍 Processing queue with {len(self.rate_limit_queue)} accounts at {now.strftime('%H:%M:%S')}", file=sys.stderr)
        
        # Process queue and remove expired entries
        while self.rate_limit_queue:
            queued_request = self.rate_limit_queue[0]
            wait_remaining = (queued_request.retry_after - now).total_seconds()
            
            # Check if account is ready
            if now >= queued_request.retry_after:
                # Account is ready, remove from queue
                self.rate_limit_queue.popleft()
                account = queued_request.account
                account.in_queue = False
                account.queue_until = None
                account.rate_limit_reset = None
                account.consecutive_failures = 0  # Reset failures on successful queue processing
                ready_accounts.append(account)
                print(f"✅ Account {account.account_name} ready from queue for {queued_request.request_type}", file=sys.stderr)
            elif now - queued_request.queued_at > self.max_queue_wait:
                # Account has been in queue too long, remove it
                self.rate_limit_queue.popleft()
                account = queued_request.account
                account.in_queue = False
                account.queue_until = None
                account.is_active = False  # Deactivate account that's been stuck too long
                print(f"❌ Account {account.account_name} removed from queue (timeout)", file=sys.stderr)
            else:
                # Account not ready yet, stop processing (queue is ordered by time)
                print(f"⏳ Account {queued_request.account.account_name} still waiting: {wait_remaining:.0f}s remaining", file=sys.stderr)
                break
        
        if ready_accounts:
            print(f"✅ Released {len(ready_accounts)} accounts from queue", file=sys.stderr)
        
        return ready_accounts

    def get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status"""
        now = datetime.now()
        queue_info = {
            'total_queued': len(self.rate_limit_queue),
            'ready_soon': 0,
            'next_ready': None
        }
        
        for queued_request in self.rate_limit_queue:
            time_until_ready = (queued_request.retry_after - now).total_seconds()
            if time_until_ready <= 60:  # Ready within 1 minute
                queue_info['ready_soon'] += 1
            
            if queue_info['next_ready'] is None or queued_request.retry_after < queue_info['next_ready']:
                queue_info['next_ready'] = queued_request.retry_after
        
        return queue_info

    def is_likely_dm_available(self, user_obj) -> bool:
        """Optimized heuristics for DM availability"""
        try:
            followers_count = getattr(user_obj, 'followersCount', 0) or getattr(user_obj, 'followers_count', 0) or 0
            following_count = getattr(user_obj, 'followingCount', 0) or getattr(user_obj, 'friends_count', 0) or 0
            verified = getattr(user_obj, 'verified', False)
            protected = getattr(user_obj, 'protected', False)
            
            if protected:
                return False
            
            if verified:
                return True
            
            if followers_count > 100000:
                return False
            
            if followers_count < 1:
                return False
            
            if following_count == 0 and followers_count > 0:
                return True
            
            if following_count > 0:
                ratio = following_count / max(followers_count, 1)
                if ratio > 100 or (ratio < 0.005 and followers_count > 5000):
                    return False
            
            return True
            
        except Exception:
            return True

    async def get_available_account_for_followers(self) -> Optional[AccountInfo]:
        """Get account available for followers API calls with queue processing"""
        # Process queue first
        ready_accounts = self.process_queue()
        
        # Add ready accounts back to appropriate pools
        for account in ready_accounts:
            if account in self.accounts and account not in self.followers_accounts:
                # Re-distribute accounts if needed
                pass
        
        return await self._get_available_account('followers', self.followers_accounts)

    async def get_available_account_for_dm_check(self) -> Optional[AccountInfo]:
        """Get account available for DM check API calls with queue processing"""
        # Process queue first
        ready_accounts = self.process_queue()
        
        return await self._get_available_account('dm_check', self.dm_check_accounts)

    async def _get_available_account(self, request_type: str, account_pool: List[AccountInfo]) -> Optional[AccountInfo]:
        """Get an available account for specific request type from dedicated pool with queue support"""
        if not account_pool:
            return None
        
        now = datetime.now()
        available_accounts = []
        
        for account in account_pool:
            if not account.is_active or account.in_queue:
                continue
                
            if account.rate_limit_reset and now < account.rate_limit_reset:
                continue
                
            if account.consecutive_failures >= self.max_consecutive_failures:
                continue
            
            # More generous rate limits since we have dedicated pools and queue system
            if request_type == 'followers' and account.followers_requests >= 50:
                continue
            elif request_type == 'dm_check' and account.dm_check_requests >= 250:
                continue
                
            available_accounts.append(account)
        
        if not available_accounts:
            # Check queue status
            queue_status = self.get_queue_status()
            if queue_status['total_queued'] > 0:
                if queue_status['next_ready']:
                    wait_time = (queue_status['next_ready'] - now).total_seconds()
                    print(f"⏳ No {request_type} accounts available. {queue_status['total_queued']} in queue, next ready in {wait_time:.0f}s", file=sys.stderr)
                    
                    # Wait a bit if account will be ready soon
                    if wait_time <= 60:
                        print(f"⏱️  Waiting {wait_time:.0f}s for next account...", file=sys.stderr)
                        await asyncio.sleep(wait_time + 5)
                        return await self._get_available_account(request_type, account_pool)
            
            return None
        
        # Sort by usage to distribute load evenly
        if request_type == 'followers':
            available_accounts.sort(key=lambda x: (x.followers_requests, x.last_used))
        else:
            available_accounts.sort(key=lambda x: (x.dm_check_requests, x.last_used))
        
        selected_account = available_accounts[0]
        
        # Shorter delays since we have multiple accounts and queue system
        time_since_last_use = (now - selected_account.last_used).total_seconds()
        if time_since_last_use < self.min_delay_between_requests:
            delay = random.uniform(self.min_delay_between_requests, self.max_delay_between_requests)
            await asyncio.sleep(delay)
        
        selected_account.last_used = now
        
        if request_type == 'followers':
            selected_account.followers_requests += 1
        else:
            selected_account.dm_check_requests += 1
        
        print(f"🔄 Using {selected_account.account_name} for {request_type} (usage: {selected_account.followers_requests if request_type == 'followers' else selected_account.dm_check_requests})", file=sys.stderr)
        return selected_account

    async def get_followers_batch(self, user_id: str, limit: int, seen_user_ids: Set[str] = None, cursor: str = None) -> tuple[List[Any], str]:
        """Get a batch of followers using available accounts with rotation and cursor support"""
        followers = []
        current_cursor = cursor # Use a new variable for the current batch's cursor
        next_cursor_for_return = cursor # This will be updated if a new cursor is found
        
        if seen_user_ids is None:
            seen_user_ids = set()
        
        if not self.followers_accounts:
            print("No followers accounts available", file=sys.stderr)
            return followers, next_cursor_for_return
        
        available_accounts = [acc for acc in self.followers_accounts if not acc.in_queue and acc.is_active]
        
        if not available_accounts:
            print("All followers accounts are in queue or inactive", file=sys.stderr)
            return followers, next_cursor_for_return
        
        for account_info in available_accounts:
            if len(followers) >= limit:
                break
            
            try:
                count = 0
                remaining_needed = limit - len(followers)
                print(f"📥 Fetching followers using {account_info.account_name} (need {remaining_needed} more, cursor: {str(current_cursor)[:20]}...)", file=sys.stderr)
                
                fetch_limit = remaining_needed * 5 # Keep a higher fetch limit
                fetched_this_call = 0
                processed_this_call = 0

                # Use followers_raw and iterate through responses
                async for resp in account_info.api.followers_raw(user_id, limit=fetch_limit, cursor=current_cursor):
                    if resp.status_code == 200:
                        raw_data = resp.json()
                        # Path to entries and cursor can vary, this is a common structure
                        # Assuming instructions -> timelineAddEntries -> entries
                        # Or instructions -> replaceEntry -> entry (for some cursor types)
                        entries = []
                        timeline_instructions = raw_data.get('data', {}).get('user', {}).get('result', {}).get('timeline_v2', {}).get('timeline', {}).get('instructions', [])
                        
                        for instruction in timeline_instructions:
                            if instruction.get('type') == 'TimelineAddEntries':
                                entries.extend(instruction.get('entries', []))
                            elif instruction.get('type') == 'TimelinePinEntry': # Pinned tweet, skip
                                pass 

                        new_cursor_found_in_batch = False
                        for entry in entries:
                            entry_id = entry.get('entryId', '')
                            if entry_id.startswith('cursor-bottom-') or entry_id.startswith('sq-cursor-bottom'):
                                new_cursor_value = entry.get('content', {}).get('value')
                                if new_cursor_value:
                                    next_cursor_for_return = new_cursor_value
                                    new_cursor_found_in_batch = True
                                    # print(f"DEBUG: Found new bottom cursor: {str(next_cursor_for_return)[:30]}...", file=sys.stderr)
                                continue # Skip cursor entries from user processing
                            
                            # Extract user from itemContent or content
                            item_content = entry.get('content', {}).get('itemContent', {})
                            if not item_content:
                                item_content = entry.get('content', {}).get('content', {}).get('itemContent', {})
                            
                            user_results = item_content.get('user_results', {}).get('result', {})
                            if user_results:
                                legacy_user_data = user_results.get('legacy', {})
                                if legacy_user_data:
                                    fetched_this_call +=1
                                    # Simulate a User object or adapt extract_user_data
                                    # For simplicity, creating a mock object with necessary fields
                                    from types import SimpleNamespace
                                    follower = SimpleNamespace(
                                        id=user_results.get('rest_id'),
                                        # Map other fields as needed by is_likely_dm_available and extract_user_data
                                        # This requires knowing what fields those functions expect.
                                        # For now, we'll assume 'id' is primary for seen_user_ids and is_likely_dm_available handles missing fields.
                                        username=legacy_user_data.get('screen_name'),
                                        followersCount=legacy_user_data.get('followers_count'),
                                        followingCount=legacy_user_data.get('friends_count'),
                                        verified=user_results.get('is_blue_verified'), # or legacy_user_data.get('verified')
                                        protected=legacy_user_data.get('protected')
                                    )
                                    
                                    if follower.id:
                                        follower_id_str = str(follower.id)
                                        if follower_id_str in seen_user_ids:
                                            continue
                                        
                                        if self.is_likely_dm_available(follower):
                                            if not any(str(f.id) == follower_id_str for f in followers):
                                                followers.append(follower)
                                                seen_user_ids.add(follower_id_str)
                                                count += 1
                                                processed_this_call += 1
                                                if len(followers) >= limit:
                                                    break
                                        else:
                                            seen_user_ids.add(follower_id_str) # Still mark as seen
                        
                        if len(followers) >= limit or not new_cursor_found_in_batch:
                            # If we have enough or no new cursor, stop this account's turn
                            if not new_cursor_found_in_batch and fetched_this_call > 0 :
                                print(f"⚠️ No new cursor found in batch from {account_info.account_name}, might be end.", file=sys.stderr)
                            break 
                        else:
                            current_cursor = next_cursor_for_return # Use the new cursor for the next raw API call with THIS account

                    elif resp.status_code == 429: # Rate limit
                        print(f"🚫 Rate limit hit on {account_info.account_name} (raw fetch), adding to queue", file=sys.stderr)
                        self.add_account_to_queue(account_info, 'followers', 15)
                        break # Stop using this account for now
                    else:
                        print(f"❌ HTTP Error {resp.status_code} with {account_info.account_name} (raw fetch): {str(resp.text)[:100]}", file=sys.stderr)
                        account_info.consecutive_failures += 1
                        break # Stop using this account for now
                
                print(f"✅ Got {count} new followers from {account_info.account_name} (fetched raw {fetched_this_call}, processed {processed_this_call})", file=sys.stderr)
                account_info.followers_requests += 1
                account_info.last_used = datetime.now()
                account_info.consecutive_failures = 0
                
                if count >= remaining_needed // 2 and len(followers) > 0:
                    break
                if count < remaining_needed // 10 and fetched_this_call > 0:
                    print(f"⚠️ Low new follower rate ({count}/{fetched_this_call}) from {account_info.account_name}, trying next account", file=sys.stderr)
                    continue
            
            except Exception as e:
                error_msg = str(e)
                if "rate limit" in error_msg.lower() or "429" in error_msg or "No account available" in error_msg:
                    print(f"🚫 Rate limit hit on {account_info.account_name}, adding to queue", file=sys.stderr)
                    self.add_account_to_queue(account_info, 'followers', 15)
                    continue
                else:
                    print(f"❌ Error with {account_info.account_name}: {error_msg[:150]} at line {e.__traceback__.tb_lineno if e.__traceback__ else 'N/A'}", file=sys.stderr)
                    account_info.consecutive_failures += 1
        
        return followers, next_cursor_for_return

    async def check_single_dm_availability(self, api: API, user_id: str) -> tuple[str, Optional[bool]]:
        """Check DM availability for a single user"""
        try:
            with suppress_stderr():
                response = await api.user_by_id_raw(user_id)
                if response.status_code == 200:
                    data = response.json()
                    user_result = data.get('data', {}).get('user', {}).get('result', {})
                    
                    can_dm = user_result.get('dm_permissions', {}).get('can_dm', None)
                    
                    if can_dm is None:
                        can_dm = user_result.get('legacy', {}).get('can_dm', None)
                    
                    return user_id, can_dm
                else:
                    return user_id, None
                
        except Exception:
            return user_id, None

    async def check_dm_availability_concurrent(self, user_ids: List[str]) -> Dict[str, bool]:
        """Check DM availability using multiple accounts with smart distribution and queue handling"""
        dm_status = {}
        
        if not self.dm_check_accounts:
            print("No DM check accounts available", file=sys.stderr)
            return dm_status
        
        # Get available accounts (not in queue)
        available_accounts = [acc for acc in self.dm_check_accounts if not acc.in_queue and acc.is_active]
        
        if not available_accounts:
            print("All DM check accounts are in queue or inactive", file=sys.stderr)
            return dm_status
        
        # Distribute user IDs across available accounts
        account_batches = []
        users_per_account = len(user_ids) // len(available_accounts)
        remainder = len(user_ids) % len(available_accounts)
        
        start_idx = 0
        for i, account in enumerate(available_accounts):
            batch_size = users_per_account + (1 if i < remainder else 0)
            if batch_size > 0:
                batch_users = user_ids[start_idx:start_idx + batch_size]
                account_batches.append((account, batch_users))
                start_idx += batch_size
        
        print(f"🔍 Distributing {len(user_ids)} DM checks across {len(account_batches)} available accounts", file=sys.stderr)
        
        # Process each account's batch concurrently
        async def process_account_batch(account: AccountInfo, batch_users: List[str]):
            batch_results = {}
            semaphore = asyncio.Semaphore(3)  # Limit concurrent requests per account
            
            async def check_with_semaphore(user_id: str):
                async with semaphore:
                    try:
                        return await self.check_single_dm_availability(account.api, user_id)
                    except Exception as e:
                        if "rate limit" in str(e).lower() or "429" in str(e):
                            print(f"🚫 Rate limit hit on {account.account_name} during DM check", file=sys.stderr)
                            self.add_account_to_queue(account, 'dm_check', 15)
                            return user_id, None
                        return user_id, None
            
            # Process in smaller sub-batches
            sub_batch_size = 15
            for i in range(0, len(batch_users), sub_batch_size):
                if account.in_queue:  # Account was rate limited, stop processing
                    break
                    
                sub_batch = batch_users[i:i + sub_batch_size]
                tasks = [check_with_semaphore(user_id) for user_id in sub_batch]
                
                try:
                    results = await asyncio.gather(*tasks, return_exceptions=True)
                    
                    for result in results:
                        if isinstance(result, tuple):
                            user_id, can_dm = result
                            batch_results[user_id] = can_dm
                            if can_dm is True:
                                print(f"✅ DM available: {user_id} ({account.account_name})", file=sys.stderr)
                    
                    # Small delay between sub-batches
                    if i + sub_batch_size < len(batch_users) and not account.in_queue:
                        await asyncio.sleep(0.3)
                        
                except Exception as e:
                    print(f"❌ Sub-batch failed on {account.account_name}: {str(e)[:50]}", file=sys.stderr)
                    break
            
            return batch_results
        
        # Run all account batches concurrently
        try:
            batch_tasks = [process_account_batch(account, batch_users) for account, batch_users in account_batches]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            # Combine results from all accounts
            for result in batch_results:
                if isinstance(result, dict):
                    dm_status.update(result)
                    
        except Exception as e:
            print(f"❌ Multi-account DM checking failed: {str(e)[:50]}", file=sys.stderr)
        
        return dm_status

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
        except Exception:
            return None

    async def scrape_smart_batch(self, username: str, limit: int, resume_cursor: str = None) -> List[Dict[str, Any]]:
        """Optimized main scraping function with queue-based rate limit handling"""
        try:
            if not self.followers_accounts:
                print("No accounts available for followers API", file=sys.stderr)
                return []
            
            print(f"🔍 Looking up @{username}...", file=sys.stderr)
            user = None
            
            # Try each followers account to find the user
            for account in self.followers_accounts:
                if account.in_queue or not account.is_active:
                    continue
                    
                try:
                    user = await account.api.user_by_login(username)
                    if user:
                        print(f"✅ Found user using {account.account_name}", file=sys.stderr)
                        break
                except Exception as e:
                    print(f"❌ User lookup failed with {account.account_name}: {str(e)[:50]}", file=sys.stderr)
                    continue
            
            if not user:
                print(f"❌ User @{username} not found with any account", file=sys.stderr)
                return []
            
            print(f"🎯 Target: @{user.username} ({getattr(user, 'followersCount', 0):,} followers)", file=sys.stderr)
            print(f"📊 Goal: Process {limit} total followers and return DM-available ones", file=sys.stderr)
            
            all_dm_followers = []
            seen_user_ids = set()
            total_processed = 0  # Track total followers processed, not just DM-available
            cursor = resume_cursor  # Resume from where we left off
            consecutive_empty_batches = 0
            consecutive_queue_waits = 0  # Track how long we've been waiting
            
            if resume_cursor:
                print(f"🔄 Resuming from cursor: {resume_cursor[:20]}...", file=sys.stderr)
            
            while total_processed < limit:
                # ALWAYS process queue first to check for ready accounts
                ready_accounts = self.process_queue()
                
                # Re-add ready accounts to their pools if needed
                for account in ready_accounts:
                    # For single account setups, the account should already be in both pools
                    # Just make sure it's marked as active and not in queue
                    account.is_active = True
                    account.in_queue = False
                    account.consecutive_failures = 0
                    print(f"🔄 Account {account.account_name} is now ready and active", file=sys.stderr)
                
                # Check if we have any active accounts
                active_followers_accounts = len([a for a in self.followers_accounts if a.is_active and not a.in_queue])
                active_dm_accounts = len([a for a in self.dm_check_accounts if a.is_active and not a.in_queue])
                
                # Debug account states (only log if there are issues)
                if active_followers_accounts == 0 and len(self.followers_accounts) > 0:
                    for i, account in enumerate(self.followers_accounts):
                        queue_until = account.queue_until.strftime('%H:%M:%S') if account.queue_until else 'N/A'
                        status = "ACTIVE" if (account.is_active and not account.in_queue) else f"INACTIVE(active={account.is_active}, in_queue={account.in_queue}, queue_until={queue_until})"
                        print(f" Follower account {i+1} ({account.account_name}): {status}", file=sys.stderr)
                
                if active_followers_accounts == 0:
                    queue_status = self.get_queue_status()
                    if queue_status['total_queued'] > 0:
                        consecutive_queue_waits += 1
                        wait_time = (queue_status['next_ready'] - datetime.now()).total_seconds() if queue_status['next_ready'] else 30
                        
                        print(f"⏳ All followers accounts in queue. Next ready in {wait_time:.0f}s (wait #{consecutive_queue_waits})", file=sys.stderr)
                        print(f"📊 Current progress: {len(all_dm_followers)} DM followers found from {total_processed} processed", file=sys.stderr)
                        
                        # More patient with longer waits - allow up to 20 minutes of waiting
                        max_wait_cycles = 20 if wait_time > 300 else 10  # More patience for long waits
                        
                        if consecutive_queue_waits > max_wait_cycles:
                            print(f"⚠️  Extended queue wait detected ({consecutive_queue_waits} cycles). Returning current results.", file=sys.stderr)
                            if len(all_dm_followers) > 0:
                                print(f"💾 Returning partial results: {len(all_dm_followers)} DM followers found so far", file=sys.stderr)
                                return all_dm_followers
                            else:
                                print(f"❌ No results found yet, continuing to wait...", file=sys.stderr)
                        
                        # Smart wait - for long waits, wait longer intervals
                        if wait_time > 600:  # More than 10 minutes
                            wait_duration = min(wait_time + 30, 300)  # Wait up to 5 minutes at a time
                            print(f"⏰ Long rate limit detected. Waiting {wait_duration:.0f}s before next check...", file=sys.stderr)
                        else:
                            wait_duration = min(wait_time + 10, 60) if wait_time > 0 else 30
                        
                        await asyncio.sleep(wait_duration)
                        continue
                    else:
                        print("❌ No active followers accounts available and none in queue, stopping", file=sys.stderr)
                        break
                else:
                    consecutive_queue_waits = 0  # Reset wait counter when accounts are available
                
                batch_limit = min(self.batch_size, limit - total_processed)
                
                followers_batch, cursor = await self.get_followers_batch(user.id, batch_limit, seen_user_ids, cursor)
                
                if not followers_batch:
                    consecutive_empty_batches += 1
                    if consecutive_empty_batches >= 3:
                        print("⚠️  Multiple empty batches, likely reached end of available followers", file=sys.stderr)
                        break
                    continue
                else:
                    consecutive_empty_batches = 0
                
                print(f"📊 Processing batch of {len(followers_batch)} followers", file=sys.stderr)
                
                # Update total processed count
                total_processed += len(followers_batch)
                
                user_ids = [str(follower.id) for follower in followers_batch]
                
                # Re-check DM account availability after processing queue
                active_dm_accounts = len([a for a in self.dm_check_accounts if a.is_active and not a.in_queue])
                
                if not self.dm_check_accounts or active_dm_accounts == 0:
                    print(f"⚠️  No DM check accounts available, skipping DM verification for this batch", file=sys.stderr)
                    print(f"📊 Skipped {len(followers_batch)} followers (no DM verification possible)", file=sys.stderr)
                    continue
                
                print(f"🔍 Checking DM availability for {len(user_ids)} users using {active_dm_accounts} available accounts...", file=sys.stderr)
                
                try:
                    dm_status_map = await self.check_dm_availability_concurrent(user_ids)
                    
                    # Process verified DM-available users
                    dm_verified_count = 0
                    for follower in followers_batch:
                        follower_id = str(follower.id)
                        can_dm = dm_status_map.get(follower_id)
                        
                        if can_dm is True:
                            follower_data = self.extract_user_data(follower)
                            if follower_data:
                                # Don't check seen_user_ids here since these are DM-verified
                                all_dm_followers.append(follower_data)
                                dm_verified_count += 1
                                print(f"✅ Added DM-verified: {follower_data['id']} ({follower_data.get('username', 'unknown')})", file=sys.stderr)
                    
                    print(f"📈 Added {dm_verified_count} DM-verified users from {len(followers_batch)} processed", file=sys.stderr)
                    
                    # Only return verified DM-available users, no heuristics
                    print(f"✅ Only verified DM-available users added: {dm_verified_count} from {len(followers_batch)} processed", file=sys.stderr)
                
                except Exception as e:
                    print(f"❌ DM check failed, skipping this batch: {str(e)[:50]}", file=sys.stderr)
                    print(f"📊 Skipped {len(followers_batch)} followers (DM verification failed)", file=sys.stderr)
                
                print(f"📊 Progress: {len(all_dm_followers)} DM followers found from {total_processed}/{limit} total processed", file=sys.stderr)
                
                # Show account and queue status
                queue_status = self.get_queue_status()
                print(f"📊 Account status: {active_followers_accounts}/{len(self.followers_accounts)} followers accounts, {active_dm_accounts}/{len(self.dm_check_accounts)} DM check accounts available", file=sys.stderr)
                if queue_status['total_queued'] > 0:
                    next_ready_str = queue_status['next_ready'].strftime('%H:%M:%S') if queue_status['next_ready'] else 'unknown'
                    print(f"⏳ Queue status: {queue_status['total_queued']} accounts queued, next ready at {next_ready_str}", file=sys.stderr)
                
                # Check if we're making progress
                if len(followers_batch) < batch_limit // 5:
                    print(f"⚠️  Small batch size ({len(followers_batch)}) may indicate approaching end of unique followers", file=sys.stderr)
                    
                # Check if we've processed enough followers
                if total_processed >= limit:
                    print(f"✅ Reached target: processed {total_processed} followers, found {len(all_dm_followers)} DM-available", file=sys.stderr)
                    break
            
            print(f"🎉 Completed! Found {len(all_dm_followers)} DM-available followers from {total_processed} total processed", file=sys.stderr)
            return all_dm_followers
            
        except Exception as e:
            print(f"❌ Scraping error: {str(e)[:100]}", file=sys.stderr)
            # Return partial results if we have any
            if len(all_dm_followers) > 0:
                print(f"💾 Returning partial results due to error: {len(all_dm_followers)} DM followers", file=sys.stderr)
                return all_dm_followers
            return []

async def scrape_with_smart_batch(username: str, limit: int, accounts_data: List[Dict], user_id: str = None, job_id: str = None) -> List[Dict[str, Any]]:
    """Optimized main scraping function with queue-based rate limit handling and multi-user support"""
    scraper = SmartBatchScraper()
    
    # Add user context for better logging
    user_context = f"User {user_id}" if user_id else "Unknown user"
    job_context = f"Job {job_id}" if job_id else "No job ID"
    
    print(f"🚀 Starting scrape for {user_context} ({job_context})", file=sys.stderr)
    
    if not await scraper.setup_accounts_from_db_data(accounts_data):
        print(f"❌ Failed to setup accounts for {user_context}", file=sys.stderr)
        return []
    
    try:
        followers = await scraper.scrape_smart_batch(username, limit)
        print(f"✅ Completed scrape for {user_context}: {len(followers)} followers found", file=sys.stderr)
        return followers
        
    except Exception as e:
        print(f"❌ Scraping failed for {user_context}: {str(e)[:100]}", file=sys.stderr)
        return []

async def main():
    parser = argparse.ArgumentParser(description="Optimized Twitter follower scraper with queue-based rate limit handling")
    parser.add_argument("username", help="Twitter username to scrape (without @)")
    parser.add_argument("limit", type=int, nargs="?", default=100, help="Max number of DM-available followers to scrape")
    parser.add_argument("--accounts-json", type=str, required=True, help="JSON string of Twitter accounts from database")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    
    args = parser.parse_args()
    
    if args.debug:
        logging.disable(logging.NOTSET)
        set_log_level("INFO")
        for logger_name in ['twscrape', 'httpx', 'httpcore']:
            logging.getLogger(logger_name).disabled = False
            logging.getLogger(logger_name).setLevel(logging.INFO)
    else:
        set_log_level("CRITICAL")
        try:
            from twscrape.logger import logger as tws_logger
            tws_logger.disabled = True
        except:
            pass
    
    username = args.username.lstrip('@')
    
    try:
        accounts_data = json.loads(args.accounts_json)
        
        if not isinstance(accounts_data, list):
            print("Error: accounts-json must be a list", file=sys.stderr)
            sys.exit(1)
        
        # Send progress to stderr so it doesn't interfere with JSON output
        print(f"🚀 Starting scraper for @{username}, target: {args.limit} followers", file=sys.stderr)
        print(f"📱 Using {len(accounts_data)} Twitter accounts", file=sys.stderr)
        
        followers = await scrape_with_smart_batch(username, args.limit, accounts_data, "cli_user", "cli_job")
        
        # Only JSON output to stdout for API parsing
        print(json.dumps(followers, indent=2))
        
        print(f"✅ Scraping completed. Found {len(followers)} DM-available followers", file=sys.stderr)
        
    except json.JSONDecodeError:
        print("Error: Invalid JSON in accounts parameter", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Scraping failed: {str(e)[:100]}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 