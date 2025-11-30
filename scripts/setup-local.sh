#!/bin/bash

# WhatsApp Reminder Agent - Local Setup Script
# This script sets up your local development environment

set -e  # Exit on error

echo "🚀 WhatsApp Reminder Agent - Local Setup"
echo "========================================="
echo ""

# Check if running from project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: You need to edit .env and add your WhatsApp credentials!"
    echo "   1. Get credentials from: https://developers.facebook.com/"
    echo "   2. Edit .env file and fill in:"
    echo "      - WHATSAPP_PHONE_NUMBER_ID"
    echo "      - WHATSAPP_BUSINESS_ACCOUNT_ID"
    echo "      - WHATSAPP_ACCESS_TOKEN"
    echo "      - WHATSAPP_WEBHOOK_VERIFY_TOKEN (create your own)"
    echo "      - WHATSAPP_WEBHOOK_SECRET (create your own)"
    echo ""
    read -p "Press Enter when you've updated .env, or Ctrl+C to exit and do it later..."
else
    echo "✅ .env file already exists"
fi

echo ""
echo "📦 Installing npm dependencies..."
npm install
echo "✅ Dependencies installed"

echo ""
echo "🐳 Starting Docker services (Postgres + Redis)..."
docker-compose up -d postgres redis

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 5

echo ""
echo "🔧 Generating Prisma client..."
npm run prisma:generate

echo ""
echo "📊 Running database migrations..."
npm run prisma:migrate

echo ""
echo "✅ Setup complete!"
echo ""
echo "========================================="
echo "Next steps:"
echo "========================================="
echo ""
echo "1. Start the development server:"
echo "   npm run dev"
echo ""
echo "2. In another terminal, expose with ngrok:"
echo "   ngrok http 3000"
echo ""
echo "3. Configure WhatsApp webhook:"
echo "   - Go to https://developers.facebook.com/"
echo "   - WhatsApp > Configuration > Webhook"
echo "   - Enter your ngrok URL + /webhook"
echo "   - Enter your verify token from .env"
echo ""
echo "4. Test by sending a WhatsApp message!"
echo ""
echo "📚 Full guide: SETUP_WHATSAPP.md"
echo "❓ Need help? Check README.md"
echo ""
