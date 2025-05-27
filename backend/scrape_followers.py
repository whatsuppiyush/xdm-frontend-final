
import asyncio
import json
import sys
import os
from twscrape import API
from twscrape.logger import set_log_level

# Set environment variable to raise exception instead of waiting for rate limits
os.environ['TWS_RAISE_WHEN_NO_ACCOUNT'] = 'false'

async def setup_account_with_cookies():
    """Setup account with your provided cookies"""
    api = API("accounts.db")
    set_log_level("INFO")
    
    cookies = [
        {
            "domain": ".x.com",
            "expirationDate": 1760875744.895804,
            "hostOnly": False,
            "httpOnly": True,
            "name": "auth_token",
            "path": "/",
            "sameSite": "no_restriction",
            "secure": True,
            "session": False,
            "storeId": None,
            "value": "40d29c58db4a465d30970a75fbec390342b46a4d"
        },
        {
            "domain": ".x.com",
            "expirationDate": 1757234266.661659,
            "hostOnly": False,
            "httpOnly": False,
            "name": "guest_id",
            "path": "/",
            "sameSite": "no_restriction",
            "secure": True,
            "session": False,
            "storeId": None,
            "value": "v1%3A174168226651653399"
        },
        {
            "domain": ".x.com",
            "expirationDate": 1763877868.314745,
            "hostOnly": False,
            "httpOnly": False,
            "name": "twid",
            "path": "/",
            "sameSite": "no_restriction",
            "secure": True,
            "session": False,
            "storeId": None,
            "value": "u%3D1910222177271705600"
        },
        {
            "domain": ".x.com",
            "hostOnly": False,
            "httpOnly": True,
            "name": "_twitter_sess",
            "path": "/",
            "sameSite": None,
            "secure": True,
            "session": True,
            "storeId": None,
            "value": "BAh7CyIKZmxhc2hJQzonQWN0aW9uQ29udHJvbGxlcjo6Rmxhc2g6OkZsYXNo%250ASGFzaHsABjoKQHVzZWR7ADoPY3JlYXRlZF9hdGwrCF2ux8SWAToMY3NyZl9p%250AZCIlN2I1YzQzMzY1ZTNjM2FmOTI5M2Y0Mzg1YjQyYWE2YzQ6B2lkIiVlZGJm%250AYTRlYTMyNjkwYTdmNmZjZmZjYzM3NmIzMTQ1NTofbGFzdF9wYXNzd29yZF9j%250Ab25maXJtYXRpb24iFTE3NDgyNjUyNjk5NTYwMDA6HnBhc3N3b3JkX2NvbmZp%250Acm1hdGlvbl91aWQiGDE5MTAyMjIxNzcyNzE3MDU2MDA%253D--052c29ce71830e80b00ddcb5b7107ec6914ed5d7"
        },
        {
            "domain": ".x.com",
            "expirationDate": 1748327665.543925,
            "hostOnly": False,
            "httpOnly": True,
            "name": "__cf_bm",
            "path": "/",
            "sameSite": "no_restriction",
            "secure": True,
            "session": False,
            "storeId": None,
            "value": "KvvxgKMHlWYLYmelCOk8FOfVA5oBoAjUXjewAI1qzcQ-1748325865-1.0.1.1-2jCKj0Vds.WbcVNCgYn_grJTXzfaSiB8.9kSQKsPV5ZzaNM9npmDTDgDpQ6JikP9gInpI4gvm_dAbDNxa5_xoyyhm3wNUKW8R1OI94FmKbQ"
        },
        {
            "domain": ".x.com",
            "expirationDate": 1760875745.649402,
            "hostOnly": False,
            "httpOnly": False,
            "name": "ct0",
            "path": "/",
            "sameSite": "lax",
            "secure": True,
            "session": False,
            "storeId": None,
            "value": "3680925910b02d54d36ca4d8c4dec9c8760774565e7e17b3cd2104548b7caaa9fdc4c0ba7b45df75ec2bcda04c8a990d3d402099d740a8f8f60a0b96150debfce7660c51d8f7201f0200ecb962f50a28"
        },
        {
            "domain": ".x.com",
            "expirationDate": 1748930667.685838,
            "hostOnly": False,
            "httpOnly": False,
            "name": "d_prefs",
            "path": "/",
            "sameSite": None,
            "secure": True,
            "session": False,
            "storeId": None,
            "value": "MjoxLGNvbnNlbnRfdmVyc2lvbjoyLHRleHRfdmVyc2lvbjoxMDAw"
        },
        {
            "domain": ".x.com",
            "expirationDate": 1762611038.952596,
            "hostOnly": False,
            "httpOnly": False,
            "name": "dnt",
            "path": "/",
            "sameSite": "no_restriction",
            "secure": True,
            "session": False,
            "storeId": None,
            "value": "1"
        },
        {
            "domain": ".x.com",
            "expirationDate": 1763877864.479735,
            "hostOnly": False,
            "httpOnly": False,
            "name": "guest_id_ads",
            "path": "/",
            "sameSite": "no_restriction",
            "secure": True,
            "session": False,
            "storeId": None,
            "value": "v1%3A174168226651653399"
        },
        {
            "domain": ".x.com",
            "expirationDate": 1763877864.479794,
            "hostOnly": False,
            "httpOnly": False,
            "name": "guest_id_marketing",
            "path": "/",
            "sameSite": "no_restriction",
            "secure": True,
            "session": False,
            "storeId": None,
            "value": "v1%3A174168226651653399"
        },
        {
            "domain": ".x.com",
            "expirationDate": 1760875744.895512,
            "hostOnly": False,
            "httpOnly": True,
            "name": "kdt",
            "path": "/",
            "sameSite": None,
            "secure": True,
            "session": False,
            "storeId": None,
            "value": "553Vg9EYm3MAZGaE80p3iqVPdFwjcF3WOEjyzKh7"
        },
        {
            "domain": ".x.com",
            "expirationDate": 1763815906.064639,
            "hostOnly": False,
            "httpOnly": False,
            "name": "personalization_id",
            "path": "/",
            "sameSite": "no_restriction",
            "secure": True,
            "session": False,
            "storeId": None,
            "value": "\"v1_wQIQaJuKXr5bLjJ6MtsXFw==\""
        }
    ]
    
    cookies_str = json.dumps(cookies)
    
    try:
        await api.pool.add_account(
            username="scraper_account_1",
            password="dummy_password", 
            email="dummy1@example.com",
            email_password="dummy_email_pass",
            cookies=cookies_str
        )
        await api.pool.add_account(
            username="scraper_account_2",
            password="dummy_password", 
            email="dummy2@example.com",
            email_password="dummy_email_pass",
            cookies=cookies_str
        )
        await api.pool.add_account(
            username="scraper_account_3",
            password="dummy_password", 
            email="dummy3@example.com",
            email_password="dummy_email_pass",
            cookies=cookies_str
        )
        print("✓ Multiple accounts setup complete")
    except Exception as e:
        print(f"Account setup: {e}")
    
    return api

async def scrape_followers(username: str, limit: int = 100):
    """Scrape followers for a given username"""
    print(f"🚀 Starting follower scraping for @{username}")
    print(f"📊 Target: {limit} followers")
    print("-" * 50)
    
    api = await setup_account_with_cookies()
    
    try:
        print(f"🔍 Looking up user @{username}...")
        user = await api.user_by_login(username)
        if not user:
            print(f"❌ User @{username} not found")
            return []
        
        print(f"✓ Found: {user.displayname} (@{user.username})")
        print(f"👥 Total followers: {user.followersCount:,}")
        print(f"📝 Bio: {(getattr(user, 'rawDescription', None) or 'No bio')[:100]}...")
        print()
        
        followers_data = []
        count = 0
        
        print(f"🔄 Scraping followers...")
        try:
            async for follower in api.followers(user.id, limit=limit):
                count += 1
                follower_info = {
                    "id": str(follower.id),
                    "name": getattr(follower, 'displayname', '') or "",
                    "username": getattr(follower, 'username', '') or "",
                    "bio": getattr(follower, 'rawDescription', '') or "",
                    "followers": getattr(follower, 'followersCount', 0) or 0,
                    "following": getattr(follower, 'followingCount', 0) or 0,
                    "verified": getattr(follower, 'verified', False) or False,
                    "profile_image": getattr(follower, 'profileImageUrl', '') or "",
                    "protected": getattr(follower, 'protected', None),
                    "can_dm": "check_required",  # Requires separate API call to check
                    "status": "Active"
                }
                followers_data.append(follower_info)
                
                if count % 25 == 0:
                    print(f"  📈 Progress: {count}/{limit} followers scraped...")
        except Exception as e:
            if "rate limit" in str(e).lower() or "no account available" in str(e).lower():
                print(f"⏰ Rate limit hit after {count} followers. Saving current progress...")
            else:
                print(f"❌ Error during scraping: {e}")
                raise
        
        print(f"✅ Scraping complete! Total: {len(followers_data)} followers")
        return followers_data
        
    except Exception as e:
        print(f"❌ Error scraping followers: {e}")
        return []

def save_followers(followers, username):
    """Save followers to JSON file"""
    filename = f"{username}_followers_{len(followers)}.json"
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(followers, f, indent=2, ensure_ascii=False)
        print(f"💾 Saved {len(followers)} followers to {filename}")
        return filename
    except Exception as e:
        print(f"❌ Error saving file: {e}")
        return None

def print_sample_followers(followers, count=5):
    """Print sample of scraped followers"""
    print(f"\n📋 Sample of {min(count, len(followers))} followers:")
    print("-" * 80)
    for i, follower in enumerate(followers[:count], 1):
        verified = "✓" if follower['verified'] else ""
        print(f"{i:2d}. {follower['name']} (@{follower['username']}) {verified}")
        print(f"    👥 {follower['followers']:,} followers | 📝 {follower['bio'][:60]}...")
        print()

async def main():
    if len(sys.argv) < 2:
        print("Usage: python scrape_followers.py <username> [limit]")
        print("Example: python scrape_followers.py elonmusk 500")
        sys.exit(1)
    
    username = sys.argv[1].replace('@', '')
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 100
    
    print("🐦 Twitter Follower Scraper using twscrape")
    print("=" * 50)
    
    followers = await scrape_followers(username, limit)
    
    if followers:
        print_sample_followers(followers)
        
        filename = save_followers(followers, username)
        if filename:
            print(f"\n🎉 Success! Scraped {len(followers)} followers from @{username}")
            print(f"📁 Data saved to: {filename}")
        
        print(f"\n📊 Summary:")
        print(f"  • Target user: @{username}")
        print(f"  • Followers scraped: {len(followers)}")
        print(f"  • Verified accounts: {sum(1 for f in followers if f['verified'])}")
        print(f"  • Average follower count: {sum(f['followers'] for f in followers) // len(followers):,}")
        print(f"  • DM check: Use 'python check_dm_availability.py --file {username}_followers_{len(followers)}.json'")
    else:
        print("❌ No followers were scraped. Check the username and try again.")

if __name__ == "__main__":
    asyncio.run(main()) 