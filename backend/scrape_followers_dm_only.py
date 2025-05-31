import argparse
import asyncio
import json
import logging
import os
import sys  # Added sys for stdout
from datetime import datetime
import uuid

from twscrape import API, AccountsPool, User, gather, Tweet
from twscrape.logger import set_log_level

# Configure logging
log = logging.getLogger("twscrape")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# Define fields to save for each user
USER_FIELDS_TO_SAVE = [
    "id_str", "name", "username", "description", "location",
    "followers_count", "friends_count", "verified", "protected",
    "created_at", "profile_image_url_https"
]

# Global API object
api = None

async def setup_account_with_cookies(cookies_json_str: str | None = None):
    global api
    # Create a new pool each time for cookie-based auth to ensure clean state
    pool = AccountsPool() 
    api = API(pool)

    if cookies_json_str:
        try:
            _cookies = json.loads(cookies_json_str)
            cookies_param_for_add_account = json.dumps(_cookies) 
            
            temp_username = f"_temp_user_{uuid.uuid4().hex[:8]}"
            temp_password = "_temp_pass_" # Placeholder

            # Add the account (returns None, so fetch from pool after)
            await api.pool.add_account(
                username=temp_username,
                password=temp_password,
                email="_temp_email_@example.com",
                email_password="_", # placeholder
                cookies=cookies_param_for_add_account
            )

            # Fetch the account object from the pool
            accounts = await api.pool.get_all()
            account = next((a for a in accounts if a.username == temp_username), None)
            if not account:
                log.error(f"Account {temp_username} was not found in pool after add_account.")
                return None

            try:
                await api.pool.login(account)
                log.info(f"Successfully logged in with account {account.username} using provided cookies.")
                
                active_accounts = [a for a in await api.pool.get_all() if getattr(a, 'active', False)]
                if active_accounts:
                    log.info(f"Active accounts: {len(active_accounts)}. Using account: {active_accounts[0].username}")
                    return api
                else:
                    log.error("Account added and logged in, but no accounts reported as active.")
                    return None
            except Exception as login_error:
                log.error(f"Failed to login with account {account.username} using provided cookies: {login_error}")
                return None
        except json.JSONDecodeError:
            log.error("Failed to parse --cookies-json. Ensure it's valid JSON.")
            return None
        except Exception as e:
            log.error(f"General error in setup_account_with_cookies: {e}")
            import traceback
            log.error(traceback.format_exc())
            return None
    else:
        # Fallback to DB if no JSON cookies provided
        log.info("No JSON cookies provided, trying to load from accounts.db")
        db_path = os.path.join(os.path.dirname(__file__), "accounts.db")
        if not os.path.exists(db_path):
            log.error(f"accounts.db not found at {db_path}")
            log.error("Please add accounts using `twscrape add_accounts` or provide --cookies-json.")
            return None

        try:
            # For DB mode, we might not want a new pool each time if it's file-based and meant to be persistent.
            # However, for consistency with the cookie flow ensuring a fresh API instance per call:
            db_pool = AccountsPool(db_path)
            api = API(db_pool) # Use the DB-backed pool here
            
            accs = await api.pool.get_all()
            if not accs:
                log.error("No accounts found in accounts.db. Please add some.")
                return None
                
            log.info(f"{len(accs)} accounts loaded from DB")
            
            successful_logins = 0
            for acc_obj in accs:
                try:
                    await api.pool.login(acc_obj) # Login with the specific account object
                    log.info(f"Account {acc_obj.username} from DB logged in successfully.")
                    successful_logins += 1
                except Exception as e:
                    log.error(f"Error logging in with account {acc_obj.username} from DB: {e}")
                    # Optionally delete if login fails consistently
                    # await api.pool.delete_account(acc_obj.username, acc_obj.password)
            
            if successful_logins == 0:
                log.error("No accounts from DB could be logged in. Cannot proceed.")
                return None
            
            log.info(f"{successful_logins} accounts from DB successfully logged in and active.")
            return api
        except Exception as e:
            log.error(f"Error setting up accounts from DB: {e}")
            return None

async def check_dm_availability(api, user_id):
    """Check if user has DM available using raw API"""
    try:
        response = await api.user_by_id_raw(user_id)
        if response.status_code == 200:
            data = response.json()
            can_dm = data.get('data', {}).get('user', {}).get('result', {}).get('legacy', {}).get('can_dm', None)
            return can_dm
    except Exception as e:
        log.debug(f"Error checking DM availability for user {user_id}: {e}")
    return None

def extract_user_data(user_obj):
    """Extract user data with proper field mapping for twscrape User objects"""
    try:
        # Map twscrape User object attributes to match frontend expectations exactly
        user_data = {
            "id": str(getattr(user_obj, 'id', '') or getattr(user_obj, 'id_str', '')),
            "username": getattr(user_obj, 'username', ''),
            "name": getattr(user_obj, 'displayname', '') or getattr(user_obj, 'name', ''),
            "bio": getattr(user_obj, 'rawDescription', '') or getattr(user_obj, 'description', '') or "No bio available",
            "followers": getattr(user_obj, 'followersCount', 0) or getattr(user_obj, 'followers_count', 0) or 0,
            "following": getattr(user_obj, 'followingCount', 0) or getattr(user_obj, 'friends_count', 0) or 0,
            "status": "Active"  # Frontend expects this field
        }
        
        # Ensure we have at least basic info
        if not user_data["name"] and not user_data["username"]:
            log.warning(f"User object missing basic info: {user_obj}")
            return None
            
        return user_data
    except Exception as e:
        log.error(f"Error extracting user data: {e}")
        return None

async def scrape_followers_dm_only(username: str, limit: int = 100, cookies_json_str: str | None = None):
    global api
    api = await setup_account_with_cookies(cookies_json_str)
    if not api:
        log.error("API setup failed. Exiting.")
        return []

    try:
        log.info(f"Looking up user @{username}...")
        user = await api.user_by_login(username)
        if not user:
            log.error(f"User @{username} not found.")
            return []
        
        log.info(f"Found user: {getattr(user, 'displayname', user.username)} (@{user.username}) with {getattr(user, 'followersCount', 0):,} followers")
        log.info(f"Scraping up to {limit} DM-available followers for @{username} (ID: {user.id})")

        scraped_followers_data = []
        count = 0
        total_checked = 0
        consecutive_rate_limits = 0
        max_consecutive_rate_limits = 3
        
        try:
            # Use a larger limit for the API to ensure we find enough DM-able followers
            api_limit = min(limit * 4, 2000)  # Check up to 4x the requested limit, max 2000
            
            async for follower_user_obj in api.followers(user.id, limit=api_limit):
                total_checked += 1
                
                if total_checked % 50 == 0:
                    log.info(f"Checked {total_checked} followers, found {count} DM-available so far...")
                
                # Check DM availability using the dedicated function
                try:
                    can_dm = await check_dm_availability(api, follower_user_obj.id)
                    consecutive_rate_limits = 0  # Reset counter on successful request
                except Exception as dm_check_error:
                    if "rate limit" in str(dm_check_error).lower() or "429" in str(dm_check_error):
                        consecutive_rate_limits += 1
                        log.warning(f"Rate limit hit during DM check (consecutive: {consecutive_rate_limits})")
                        
                        if consecutive_rate_limits >= max_consecutive_rate_limits:
                            log.warning(f"Hit {max_consecutive_rate_limits} consecutive rate limits. Stopping to avoid long waits.")
                            break
                        
                        # Short delay before continuing
                        await asyncio.sleep(2)
                        continue
                    else:
                        log.warning(f"Error checking DM availability for {follower_user_obj.id}: {dm_check_error}")
                        continue
                
                # Only proceed if DM is available
                if can_dm == True:
                    # Fetch full follower profile for detailed information
                    full_follower_profile = None
                    try:
                        full_follower_profile = await api.user_by_id(follower_user_obj.id)
                    except Exception as profile_fetch_error:
                        if "rate limit" in str(profile_fetch_error).lower() or "429" in str(profile_fetch_error):
                            consecutive_rate_limits += 1
                            log.warning(f"Rate limit hit during profile fetch (consecutive: {consecutive_rate_limits})")
                            
                            if consecutive_rate_limits >= max_consecutive_rate_limits:
                                log.warning(f"Hit {max_consecutive_rate_limits} consecutive rate limits. Stopping.")
                                break
                            
                            # Use basic follower object if full profile fetch fails due to rate limit
                            full_follower_profile = follower_user_obj
                        else:
                            log.warning(f"Error fetching full profile for follower ID {follower_user_obj.id} (@{getattr(follower_user_obj, 'username', 'unknown')}): {profile_fetch_error}. Using basic info.")
                            full_follower_profile = follower_user_obj

                    if not full_follower_profile:
                        log.warning(f"Could not fetch profile for follower ID {follower_user_obj.id}. Skipping.")
                        continue
                    
                    # Extract user data using the improved function
                    follower_data = extract_user_data(full_follower_profile)
                    if not follower_data:
                        log.warning(f"Could not extract data for follower ID {follower_user_obj.id}. Skipping.")
                        continue
                    
                    scraped_followers_data.append(follower_data)
                    count += 1
                    
                    if count % 10 == 0:
                        log.info(f"Found {count} DM-available followers so far for @{username}")
                
                # Stop if we've reached the limit
                if count >= limit:
                    log.info(f"Reached target of {limit} DM-available followers. Stopping.")
                    break
                
                # Stop if we've checked too many without finding enough
                if total_checked >= api_limit:
                    log.info(f"Checked {total_checked} followers but only found {count} DM-available. Stopping.")
                    break
                
                # Stop if we hit too many consecutive rate limits
                if consecutive_rate_limits >= max_consecutive_rate_limits:
                    log.warning(f"Stopping due to consecutive rate limits.")
                    break
        
        except Exception as scrape_error:
            log.error(f"Error during follower scraping: {scrape_error}")
            if "rate limit" in str(scrape_error).lower():
                log.error("Twitter rate limit hit. Try again later.")
            elif "authorization" in str(scrape_error).lower() or "auth" in str(scrape_error).lower():
                log.error("Authorization error. Check your Twitter cookies.")
            
            # Return what we have so far if we found any
            if scraped_followers_data:
                log.info(f"Returning {len(scraped_followers_data)} followers found before error occurred")
            else:
                log.error("No followers were collected before error occurred")

        log.info(f"Total followers checked: {total_checked}")
        log.info(f"Total DM-available followers found: {len(scraped_followers_data)}")
        return scraped_followers_data
        
    except Exception as e:
        log.error(f"An error occurred during scraping for @{username}: {e}")
        import traceback
        log.error(traceback.format_exc())
        return []
    finally:
        if api and hasattr(api.pool, 'close'):
             await api.pool.close()


def save_dm_followers(followers, username):
    # This function will now print to stdout instead of saving to a file.
    # No need for username argument if just printing.
    if not followers:
        # Print empty list if no followers, to ensure valid JSON output
        sys.stdout.write(json.dumps([]))
        sys.stdout.flush()
        return

    try:
        # Debug: Log first follower to stderr for inspection
        if followers and len(followers) > 0:
            log.info(f"Sample follower data: {json.dumps(followers[0], indent=2)}")
        
        # Output the JSON string to stdout
        json_output = json.dumps(followers, indent=None, ensure_ascii=False) # No indent for compactness
        sys.stdout.write(json_output)
        sys.stdout.flush()
        log.info(f"Successfully wrote {len(followers)} followers to stdout for {username}.")
    except Exception as e:
        log.error(f"Error writing JSON to stdout: {e}")
        # Print empty list on error to ensure stdout is still valid JSON if possible
        sys.stdout.write(json.dumps([])) 
        sys.stdout.flush()

def print_sample_dm_followers(followers, count=5):
    if not followers:
        log.info("No DM-available followers to sample.")
        return
    log.info(f"\nSample of {min(count, len(followers))} DM-Available Followers:")
    for i, follower in enumerate(followers[:count]):
        log.info(
            f"  {i+1}. Name: {follower.get('name', 'N/A')}, Username: {follower.get('username', 'N/A')}, Followers: {follower.get('followers', 'N/A')}, Can DM: {follower.get('can_dm', 'N/A')}"
        )

async def main():
    parser = argparse.ArgumentParser(description="Scrape DM-available followers from a Twitter profile using twscrape.")
    parser.add_argument("username", help="Twitter username to scrape (without @)")
    parser.add_argument(
        "limit",
        type=int,
        nargs="?",
        default=100,
        help="Max number of DM-available followers to try to scrape (default: 100)",
    )
    parser.add_argument(
        "--cookies-json",
        type=str,
        default=None, # Important: default to None
        help="JSON string of cookies to use for authentication. Example: '[{\"name\": \"auth_token\", \"value\": \"...\"}, ...]'",
    )
    parser.add_argument(
        "--debug", action="store_true", help="Enable debug logging for twscrape"
    )

    args = parser.parse_args()

    if args.debug:
        set_log_level("DEBUG")
    else:
        set_log_level("INFO") # Default to INFO for twscrape core logs

    # Ensure username does not start with @
    username = args.username.lstrip('@')

    log.info(f"Starting to scrape DM-available followers for: @{username}, Limit: {args.limit}")
    
    # Pass cookies_json string to the scraping function
    followers = await scrape_followers_dm_only(username, args.limit, args.cookies_json)
    
    # Save (print to stdout) the followers
    save_dm_followers(followers, username) # Username arg is now just for logging if any in save_dm_followers

    # Print sample to stderr (optional, for script execution visibility)
    print_sample_dm_followers(followers[:3]) # Show first 3 followers for debugging
    log.info(f"Completed scraping for @{username}.")


if __name__ == "__main__":
    asyncio.run(main()) 