#!/usr/bin/env python3
"""
Debug script to check the target user and sample followers
"""

import asyncio
import json
import sys
from twscrape import API
from twscrape.logger import set_log_level

async def debug_target_user():
    """Debug the target user and sample followers"""
    api = API("accounts.db")
    set_log_level("INFO")
    
    # The user ID from the logs
    user_id = "11768582"
    
    try:
        print(f"🔍 Checking target user ID: {user_id}")
        
        # Get user info
        user = await api.user_by_id(user_id)
        if not user:
            print(f"❌ User {user_id} not found")
            return
        
        print(f"✓ Target user: {user.displayname} (@{user.username})")
        print(f"  Followers: {user.followersCount:,}")
        print(f"  Following: {getattr(user, 'followingCount', getattr(user, 'friendsCount', 'Unknown')):,}")
        print(f"  Verified: {getattr(user, 'verified', 'Unknown')}")
        
        # Get a sample of followers
        print(f"\n🔍 Sampling first 10 followers...")
        
        followers_checked = 0
        dm_available_count = 0
        
        async for follower in api.followers(user_id, limit=10):
            followers_checked += 1
            
            # Check DM availability
            try:
                response = await api.user_by_id_raw(follower.id)
                if response.status_code == 200:
                    data = response.json()
                    user_result = data.get('data', {}).get('user', {}).get('result', {})
                    
                    # Try new structure first
                    can_dm = user_result.get('dm_permissions', {}).get('can_dm', None)
                    
                    # Fallback to legacy
                    if can_dm is None:
                        can_dm = user_result.get('legacy', {}).get('can_dm', None)
                    
                    dm_status = "✅ DM Available" if can_dm else "❌ DM Blocked" if can_dm is False else "❓ Unknown"
                    
                    if can_dm:
                        dm_available_count += 1
                    
                    print(f"  {followers_checked}. @{follower.username} ({follower.followersCount:,} followers) - {dm_status}")
                    
                else:
                    print(f"  {followers_checked}. @{follower.username} - ❌ API Error ({response.status_code})")
                    
            except Exception as e:
                print(f"  {followers_checked}. @{follower.username} - ❌ Error: {e}")
            
            # Small delay to avoid rate limits
            await asyncio.sleep(0.5)
        
        print(f"\n📊 Results:")
        print(f"  Total followers checked: {followers_checked}")
        print(f"  DM-available followers: {dm_available_count}")
        print(f"  DM availability rate: {(dm_available_count/followers_checked)*100:.1f}%")
        
        if dm_available_count == 0:
            print(f"\n💡 Suggestion: This target user's followers may not allow DMs.")
            print(f"   Try targeting a different user with more 'normal' followers.")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_target_user()) 