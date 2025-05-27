#!/usr/bin/env python3
"""
Debug script to test DM availability checking
"""

import asyncio
import json
import sys
from twscrape import API
from twscrape.logger import set_log_level

async def debug_dm_check():
    """Debug DM availability checking"""
    api = API("accounts.db")
    set_log_level("DEBUG")
    
    # Test with a smaller account more likely to allow DMs
    username = "jack"  # Twitter founder, but smaller account
    
    try:
        print(f"🔍 Testing DM availability for @{username}...")
        
        # Get user first
        user = await api.user_by_login(username)
        if not user:
            print(f"❌ User @{username} not found")
            return
        
        print(f"✓ Found user: {user.displayname} (@{user.username})")
        print(f"  User ID: {user.id}")
        print(f"  Followers: {user.followersCount:,}")
        
        # Test DM availability check
        print(f"\n🔍 Checking DM availability...")
        response = await api.user_by_id_raw(user.id)
        
        print(f"API Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Print the structure we're looking for
            print(f"\n📋 Response structure analysis:")
            
            user_result = data.get('data', {}).get('user', {}).get('result', {})
            print(f"  user_result keys: {list(user_result.keys())}")
            
            # Check new structure (dm_permissions.can_dm)
            dm_permissions = user_result.get('dm_permissions', {})
            print(f"  dm_permissions: {dm_permissions}")
            can_dm_new = dm_permissions.get('can_dm', None)
            print(f"  dm_permissions.can_dm: {can_dm_new}")
            
            # Check legacy structure (legacy.can_dm)
            legacy = user_result.get('legacy', {})
            can_dm_legacy = legacy.get('can_dm', None)
            print(f"  legacy.can_dm: {can_dm_legacy}")
            
            # Final result
            can_dm = can_dm_new if can_dm_new is not None else can_dm_legacy
            print(f"\n✅ Final DM availability: {can_dm}")
            
            # Save raw response for inspection
            with open('debug_response.json', 'w') as f:
                json.dump(data, f, indent=2)
            print(f"📁 Raw response saved to debug_response.json")
            
        else:
            print(f"❌ API request failed with status {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_dm_check()) 