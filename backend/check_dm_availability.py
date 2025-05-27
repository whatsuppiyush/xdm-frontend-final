#!/usr/bin/env python3
"""
Check DM availability for specific Twitter users
"""

import asyncio
import json
import sys
from twscrape import API
from twscrape.logger import set_log_level

async def check_dm_for_users(usernames):
    """Check DM availability for a list of usernames"""
    api = API("accounts.db")
    set_log_level("INFO")
    
    results = []
    
    for username in usernames:
        try:
            print(f"🔍 Checking DM availability for @{username}...")
            
            # Get raw user data
            response = await api.user_by_login_raw(username)
            
            if response.status_code == 200:
                data = response.json()
                can_dm = data.get('data', {}).get('user', {}).get('result', {}).get('legacy', {}).get('can_dm', None)
                
                # Get basic user info
                user = await api.user_by_login(username)
                if user:
                    result = {
                        "username": username,
                        "name": user.displayname,
                        "followers": user.followersCount,
                        "verified": user.verified,
                        "protected": getattr(user, 'protected', None),
                        "can_dm": can_dm,
                        "dm_status": "✅ DM Available" if can_dm else "❌ DM Blocked" if can_dm is False else "❓ Unknown"
                    }
                    results.append(result)
                    
                    print(f"  ✓ @{username}: {result['dm_status']}")
                else:
                    print(f"  ❌ User @{username} not found")
            else:
                print(f"  ❌ Failed to get raw data for @{username} (status: {response.status_code})")
                
        except Exception as e:
            print(f"  ❌ Error checking @{username}: {e}")
    
    return results

async def check_dm_from_file(filename):
    """Check DM availability for users from a followers JSON file"""
    try:
        with open(filename, 'r') as f:
            followers_data = json.load(f)
        
        print(f"📁 Loaded {len(followers_data)} followers from {filename}")
        
        # Check DM for first 50 followers as example (or all if fewer)
        sample_size = min(50, len(followers_data))
        sample_followers = followers_data[:sample_size]
        
        usernames = [follower['username'] for follower in sample_followers]
        
        print(f"🔍 Checking DM availability for first {sample_size} followers (this may take a few minutes)...")
        results = await check_dm_for_users(usernames)
        
        # Update the original data
        updated_data = followers_data.copy()
        for i, result in enumerate(results):
            if i < len(updated_data):
                updated_data[i]['can_dm'] = result['can_dm']
        
        # Save updated file
        updated_filename = filename.replace('.json', '_with_dm.json')
        with open(updated_filename, 'w') as f:
            json.dump(updated_data, f, indent=2)
        
        print(f"\n📊 DM Availability Summary:")
        dm_available = sum(1 for r in results if r['can_dm'] == True)
        dm_blocked = sum(1 for r in results if r['can_dm'] == False)
        dm_unknown = sum(1 for r in results if r['can_dm'] is None)
        
        print(f"  ✅ DM Available: {dm_available}")
        print(f"  ❌ DM Blocked: {dm_blocked}")
        print(f"  ❓ Unknown: {dm_unknown}")
        print(f"  📁 Updated data saved to: {updated_filename}")
        
    except FileNotFoundError:
        print(f"❌ File {filename} not found")
    except Exception as e:
        print(f"❌ Error processing file: {e}")

async def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python check_dm_availability.py <username1> [username2] ...")
        print("  python check_dm_availability.py --file <followers_file.json>")
        print("\nExamples:")
        print("  python check_dm_availability.py WhatsUpPiyush ZenJayCfa")
        print("  python check_dm_availability.py --file WhatsUpPiyush_followers_50.json")
        sys.exit(1)
    
    print("📨 Twitter DM Availability Checker")
    print("=" * 50)
    
    if sys.argv[1] == "--file":
        if len(sys.argv) < 3:
            print("❌ Please specify a filename")
            sys.exit(1)
        await check_dm_from_file(sys.argv[2])
    else:
        usernames = sys.argv[1:]
        results = await check_dm_for_users(usernames)
        
        if results:
            print("\n📊 Results:")
            print("-" * 60)
            for result in results:
                print(f"@{result['username']:15} | {result['dm_status']:15} | {result['followers']:,} followers")

if __name__ == "__main__":
    asyncio.run(main()) 