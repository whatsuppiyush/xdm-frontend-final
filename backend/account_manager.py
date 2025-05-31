#!/usr/bin/env python3
"""
Twitter Account Manager for twscrape
Helps manage multiple Twitter accounts to handle rate limits better
"""

import asyncio
import json
import sys
import os
from pathlib import Path
from twscrape import API
from twscrape.logger import set_log_level

async def add_account_from_cookies(cookies_file: str, account_name: str):
    """Add a Twitter account using cookies from a JSON file"""
    api = API("accounts.db")
    set_log_level("INFO")
    
    try:
        with open(cookies_file, 'r') as f:
            cookies = json.load(f)
        
        cookies_str = json.dumps(cookies)
        
        await api.pool.add_account(
            username=account_name,
            password="dummy_password",
            email=f"{account_name}@example.com",
            email_password="dummy_email_pass",
            cookies=cookies_str
        )
        
        print(f"✓ Account '{account_name}' added successfully")
        
        # Try to login
        accounts = await api.pool.get_all()
        account = next((a for a in accounts if a.username == account_name), None)
        
        if account:
            await api.pool.login(account)
            print(f"✓ Account '{account_name}' logged in successfully")
        else:
            print(f"✗ Could not find account '{account_name}' after adding")
            
    except FileNotFoundError:
        print(f"✗ Cookies file not found: {cookies_file}")
    except json.JSONDecodeError:
        print(f"✗ Invalid JSON in cookies file: {cookies_file}")
    except Exception as e:
        print(f"✗ Error adding account '{account_name}': {e}")

async def list_accounts():
    """List all accounts in the database"""
    api = API("accounts.db")
    
    try:
        accounts = await api.pool.get_all()
        
        if not accounts:
            print("No accounts found in database")
            return
        
        print(f"\nFound {len(accounts)} accounts:")
        print("-" * 60)
        print(f"{'Username':<20} {'Active':<8} {'Last Used':<20}")
        print("-" * 60)
        
        for account in accounts:
            active = getattr(account, 'active', 'Unknown')
            last_used = getattr(account, 'last_used', 'Never')
            print(f"{account.username:<20} {str(active):<8} {str(last_used):<20}")
            
    except Exception as e:
        print(f"Error listing accounts: {e}")

async def test_account(account_name: str):
    """Test if an account is working"""
    api = API("accounts.db")
    set_log_level("INFO")
    
    try:
        accounts = await api.pool.get_all()
        account = next((a for a in accounts if a.username == account_name), None)
        
        if not account:
            print(f"✗ Account '{account_name}' not found")
            return
        
        print(f"Testing account '{account_name}'...")
        
        # Try to login
        await api.pool.login(account)
        print(f"✓ Login successful")
        
        # Try a simple API call
        user = await api.user_by_login("twitter")
        if user:
            print(f"✓ API test successful - found @twitter with {user.followersCount:,} followers")
        else:
            print(f"✗ API test failed - could not find @twitter")
            
    except Exception as e:
        print(f"✗ Account test failed: {e}")

async def remove_account(account_name: str):
    """Remove an account from the database"""
    api = API("accounts.db")
    
    try:
        accounts = await api.pool.get_all()
        account = next((a for a in accounts if a.username == account_name), None)
        
        if not account:
            print(f"✗ Account '{account_name}' not found")
            return
        
        await api.pool.delete_account(account.username, account.password)
        print(f"✓ Account '{account_name}' removed successfully")
        
    except Exception as e:
        print(f"✗ Error removing account '{account_name}': {e}")

async def setup_multiple_accounts():
    """Interactive setup for multiple accounts"""
    print("🐦 Twitter Account Setup for Rate Limit Management")
    print("=" * 50)
    print()
    print("This will help you add multiple Twitter accounts to handle rate limits better.")
    print("You'll need cookies from each Twitter account you want to add.")
    print()
    
    account_count = 0
    while True:
        account_count += 1
        print(f"\n--- Account {account_count} ---")
        
        account_name = input(f"Enter name for account {account_count} (or 'done' to finish): ").strip()
        if account_name.lower() == 'done':
            break
        
        cookies_file = input("Enter path to cookies JSON file: ").strip()
        
        if not os.path.exists(cookies_file):
            print(f"✗ File not found: {cookies_file}")
            account_count -= 1
            continue
        
        await add_account_from_cookies(cookies_file, account_name)
        
        # Test the account
        await test_account(account_name)
        
        continue_setup = input("\nAdd another account? (y/n): ").strip().lower()
        if continue_setup != 'y':
            break
    
    print(f"\n✓ Setup complete! Added {account_count - 1} accounts.")
    await list_accounts()

def print_usage():
    """Print usage instructions"""
    print("Twitter Account Manager for twscrape")
    print("=" * 40)
    print()
    print("Usage:")
    print("  python account_manager.py add <cookies_file> <account_name>")
    print("  python account_manager.py list")
    print("  python account_manager.py test <account_name>")
    print("  python account_manager.py remove <account_name>")
    print("  python account_manager.py setup")
    print()
    print("Examples:")
    print("  python account_manager.py add cookies1.json account1")
    print("  python account_manager.py list")
    print("  python account_manager.py test account1")
    print("  python account_manager.py setup")
    print()
    print("Rate Limit Tips:")
    print("- Add 3-5 different Twitter accounts for best results")
    print("- Each account should have different cookies")
    print("- Accounts will be rotated automatically during scraping")
    print("- Twitter rate limits reset every 15 minutes per endpoint")

async def main():
    if len(sys.argv) < 2:
        print_usage()
        return
    
    command = sys.argv[1].lower()
    
    if command == "add":
        if len(sys.argv) != 4:
            print("Usage: python account_manager.py add <cookies_file> <account_name>")
            return
        cookies_file = sys.argv[2]
        account_name = sys.argv[3]
        await add_account_from_cookies(cookies_file, account_name)
        
    elif command == "list":
        await list_accounts()
        
    elif command == "test":
        if len(sys.argv) != 3:
            print("Usage: python account_manager.py test <account_name>")
            return
        account_name = sys.argv[2]
        await test_account(account_name)
        
    elif command == "remove":
        if len(sys.argv) != 3:
            print("Usage: python account_manager.py remove <account_name>")
            return
        account_name = sys.argv[2]
        await remove_account(account_name)
        
    elif command == "setup":
        await setup_multiple_accounts()
        
    else:
        print(f"Unknown command: {command}")
        print_usage()

if __name__ == "__main__":
    asyncio.run(main()) 