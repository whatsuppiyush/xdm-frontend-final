#!/bin/bash

echo "🐦 Twitter Rate Limit Management Setup"
echo "======================================"
echo

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check if twscrape is installed
if ! python3 -c "import twscrape" 2>/dev/null; then
    echo "📦 Installing twscrape..."
    pip install twscrape==0.17.0
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install twscrape. Please install manually:"
        echo "   pip install twscrape==0.17.0"
        exit 1
    fi
    echo "✅ twscrape installed successfully"
else
    echo "✅ twscrape is already installed"
fi

echo
echo "📋 Setup Summary:"
echo "=================="
echo "✅ Multi-account scraper: backend/multi_account_scraper.py"
echo "✅ Account manager: backend/account_manager.py"
echo "✅ Improved single scraper: backend/improved_scraper.py"
echo "✅ Rate limit guide: backend/RATE_LIMIT_GUIDE.md"
echo

echo "🚀 Next Steps:"
echo "=============="
echo "1. Add multiple Twitter accounts:"
echo "   python account_manager.py setup"
echo
echo "2. Test your accounts:"
echo "   python account_manager.py list"
echo "   python account_manager.py test account_name"
echo
echo "3. Your API will automatically use multiple accounts when available"
echo
echo "📖 For detailed instructions, see: backend/RATE_LIMIT_GUIDE.md"
echo

# Check if accounts.db exists
if [ -f "accounts.db" ]; then
    echo "📊 Current Account Status:"
    echo "========================="
    python3 account_manager.py list
else
    echo "⚠️  No accounts database found. Run 'python account_manager.py setup' to add accounts."
fi

echo
echo "✨ Setup complete! Your rate limit management system is ready." 