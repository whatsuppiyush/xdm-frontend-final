#!/usr/bin/env python3
"""
User-specific account pool system for parallel scraping
Allows 50+ users to scrape simultaneously without blocking each other
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from dataclasses import dataclass
from collections import defaultdict
import hashlib

from twscrape import API, AccountsPool

@dataclass
class UserAccountPool:
    user_id: str
    accounts: List[Dict]
    last_used: datetime
    active_jobs: Set[str]
    reserved_until: Optional[datetime] = None

class MultiUserAccountManager:
    def __init__(self):
        self.user_pools: Dict[str, UserAccountPool] = {}
        self.global_accounts: List[Dict] = []
        self.account_assignment_strategy = "round_robin"  # or "hash_based"
        self.max_concurrent_jobs_per_user = 3
        self.account_reservation_time = timedelta(minutes=20)
        
    def add_global_accounts(self, accounts: List[Dict]):
        """Add accounts to global pool for distribution"""
        self.global_accounts.extend(accounts)
        print(f"Added {len(accounts)} accounts to global pool. Total: {len(self.global_accounts)}")
    
    def get_user_hash(self, user_id: str) -> int:
        """Generate consistent hash for user ID"""
        return int(hashlib.md5(user_id.encode()).hexdigest(), 16)
    
    def assign_accounts_to_user(self, user_id: str, job_id: str) -> List[Dict]:
        """Assign dedicated accounts to a user for their scraping job"""
        
        if not self.global_accounts:
            print(f"❌ No global accounts available for user {user_id}")
            return []
        
        # Check if user already has a pool
        if user_id in self.user_pools:
            pool = self.user_pools[user_id]
            
            # Check if pool is still valid and not overloaded
            if (len(pool.active_jobs) < self.max_concurrent_jobs_per_user and 
                (not pool.reserved_until or datetime.now() < pool.reserved_until)):
                
                pool.active_jobs.add(job_id)
                pool.last_used = datetime.now()
                pool.reserved_until = datetime.now() + self.account_reservation_time
                
                print(f"✅ Reusing existing pool for user {user_id} (jobs: {len(pool.active_jobs)})")
                return pool.accounts
        
        # Assign new accounts to user
        accounts_per_user = max(1, len(self.global_accounts) // 10)  # At least 1, max 10% of total
        
        if self.account_assignment_strategy == "hash_based":
            # Consistent assignment based on user hash
            user_hash = self.get_user_hash(user_id)
            start_idx = user_hash % len(self.global_accounts)
            assigned_accounts = []
            
            for i in range(accounts_per_user):
                idx = (start_idx + i) % len(self.global_accounts)
                assigned_accounts.append(self.global_accounts[idx])
                
        else:  # round_robin
            # Find least used accounts
            account_usage = defaultdict(int)
            for pool in self.user_pools.values():
                for account in pool.accounts:
                    account_name = account.get('twitterAccountName', 'unknown')
                    account_usage[account_name] += len(pool.active_jobs)
            
            # Sort accounts by usage (least used first)
            available_accounts = sorted(
                self.global_accounts, 
                key=lambda acc: account_usage.get(acc.get('twitterAccountName', 'unknown'), 0)
            )
            
            assigned_accounts = available_accounts[:accounts_per_user]
        
        # Create user pool
        self.user_pools[user_id] = UserAccountPool(
            user_id=user_id,
            accounts=assigned_accounts,
            last_used=datetime.now(),
            active_jobs={job_id},
            reserved_until=datetime.now() + self.account_reservation_time
        )
        
        print(f"🎯 Assigned {len(assigned_accounts)} accounts to user {user_id}")
        return assigned_accounts
    
    def release_user_job(self, user_id: str, job_id: str):
        """Release a job from user's pool"""
        if user_id in self.user_pools:
            pool = self.user_pools[user_id]
            pool.active_jobs.discard(job_id)
            
            # If no active jobs, extend reservation slightly for potential reuse
            if not pool.active_jobs:
                pool.reserved_until = datetime.now() + timedelta(minutes=5)
                
            print(f"🔓 Released job {job_id} for user {user_id} (remaining jobs: {len(pool.active_jobs)})")
    
    def cleanup_expired_pools(self):
        """Clean up expired user pools"""
        now = datetime.now()
        expired_users = []
        
        for user_id, pool in self.user_pools.items():
            if (not pool.active_jobs and 
                pool.reserved_until and 
                now > pool.reserved_until):
                expired_users.append(user_id)
        
        for user_id in expired_users:
            del self.user_pools[user_id]
            print(f"🧹 Cleaned up expired pool for user {user_id}")
    
    def get_pool_status(self) -> Dict:
        """Get current status of all user pools"""
        self.cleanup_expired_pools()
        
        status = {
            'total_global_accounts': len(self.global_accounts),
            'active_user_pools': len(self.user_pools),
            'total_active_jobs': sum(len(pool.active_jobs) for pool in self.user_pools.values()),
            'users': {}
        }
        
        for user_id, pool in self.user_pools.items():
            status['users'][user_id] = {
                'accounts_assigned': len(pool.accounts),
                'active_jobs': len(pool.active_jobs),
                'last_used': pool.last_used.isoformat(),
                'reserved_until': pool.reserved_until.isoformat() if pool.reserved_until else None
            }
        
        return status

# Global instance
account_manager = MultiUserAccountManager()

async def get_user_accounts(user_id: str, job_id: str = None) -> List[Dict]:
    """Get accounts assigned to a specific user"""
    if job_id is None:
        job_id = f"job_{uuid.uuid4().hex[:8]}"
    
    return account_manager.assign_accounts_to_user(user_id, job_id)

def release_user_accounts(user_id: str, job_id: str):
    """Release accounts when job is complete"""
    account_manager.release_user_job(user_id, job_id)

def initialize_global_accounts(accounts: List[Dict]):
    """Initialize the global account pool"""
    account_manager.add_global_accounts(accounts)

def get_system_status():
    """Get current system status"""
    return account_manager.get_pool_status() 