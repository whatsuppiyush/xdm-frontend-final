#!/usr/bin/env python3
"""
Test script for the Twitter follower scraper
"""

import asyncio
import json
import sys
import os

# Add the current directory to the path so we can import the scraper
sys.path.append(os.path.dirname(__file__))

from scrape_followers_dm_only import scrape_followers_dm_only

async def test_scraper():
    """Test the scraper with a small limit"""
    
    # Test cookies (you'll need to replace these with actual cookies)
    test_cookies = [
        {
            "domain": ".x.com",
            "name": "auth_token",
            "value": "your_auth_token_here",
            "path": "/",
            "secure": True,
            "httpOnly": True
        }
    ]
    
    cookies_json = json.dumps(test_cookies)
    
    print("Testing scraper with tesla account...")
    
    try:
        followers = await scrape_followers_dm_only(
            username="tesla",
            limit=5,  # Small limit for testing
            cookies_json_str=cookies_json
        )
        
        print(f"\nFound {len(followers)} followers:")
        for i, follower in enumerate(followers, 1):
            print(f"{i}. {follower}")
            
        # Test JSON serialization
        json_output = json.dumps(followers, indent=2)
        print(f"\nJSON output length: {len(json_output)} characters")
        print("JSON output preview:")
        print(json_output[:500] + "..." if len(json_output) > 500 else json_output)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_scraper()) 