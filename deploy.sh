#!/bin/bash

# Meta Analytics Deployment Script for VPS
# Run this script on your VPS to deploy the Meta Analytics app

set -e

echo "🚀 Starting Meta Analytics deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VPS_IP="164.92.66.82"
DOMAIN="meta.tryfleur.com"
APP_DIR="/opt/meta-analytics"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"

echo -e "${YELLOW}📋 Deployment Configuration:${NC}"
echo "VPS IP: $VPS_IP"
echo "Domain: $DOMAIN"
echo "App Directory: $APP_DIR"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

if ! command_exists nginx; then
    echo -e "${RED}❌ Nginx is not installed. Please install Nginx first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites are installed.${NC}"

# Create application directory
echo -e "${YELLOW}📁 Creating application directory...${NC}"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Clone or update the repository
echo -e "${YELLOW}📥 Setting up application code...${NC}"
if [ -d "$APP_DIR/.git" ]; then
    echo "Updating existing repository..."
    cd $APP_DIR
    git pull origin main
else
    echo "Cloning repository..."
    git clone https://github.com/your-username/meta-analytics.git $APP_DIR
    cd $APP_DIR
fi

# Copy environment file
echo -e "${YELLOW}⚙️ Setting up environment configuration...${NC}"
if [ ! -f "$APP_DIR/.env.production" ]; then
    echo "Creating production environment file..."
    cp env.production.template .env.production
    echo -e "${RED}⚠️  Please edit .env.production with your actual configuration values!${NC}"
    echo "Required values:"
    echo "- META_APP_ID"
    echo "- META_APP_SECRET"
    echo "- META_ACCESS_TOKEN"
    echo "- META_AD_ACCOUNT_ID"
    echo "- OPENAI_API_KEY"
    echo "- DB_PASSWORD"
    echo "- REDIS_PASSWORD"
    echo ""
    read -p "Press Enter after you've updated .env.production..."
fi

# Build and start containers
echo -e "${YELLOW}🐳 Building and starting Docker containers...${NC}"
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 30

# Check if services are running
echo -e "${YELLOW}🔍 Checking service status...${NC}"
docker-compose -f docker-compose.prod.yml ps

# Setup Nginx configuration
echo -e "${YELLOW}🌐 Setting up Nginx configuration...${NC}"

# Copy nginx configuration
sudo cp nginx-meta.conf $NGINX_SITES_AVAILABLE/meta.tryfleur.com

# Enable the site
sudo ln -sf $NGINX_SITES_AVAILABLE/meta.tryfleur.com $NGINX_SITES_ENABLED/

# Test nginx configuration
echo -e "${YELLOW}🧪 Testing Nginx configuration...${NC}"
sudo nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx configuration is valid.${NC}"
    
    # Reload nginx
    echo -e "${YELLOW}🔄 Reloading Nginx...${NC}"
    sudo systemctl reload nginx
    
    echo -e "${GREEN}✅ Nginx reloaded successfully.${NC}"
else
    echo -e "${RED}❌ Nginx configuration test failed. Please check the configuration.${NC}"
    exit 1
fi

# Setup SSL with Let's Encrypt (if not already done)
echo -e "${YELLOW}🔒 Setting up SSL certificate...${NC}"
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "Installing Certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
    
    echo "Obtaining SSL certificate..."
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email your-email@example.com
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ SSL certificate obtained successfully.${NC}"
    else
        echo -e "${RED}❌ Failed to obtain SSL certificate. Please check your domain configuration.${NC}"
    fi
else
    echo -e "${GREEN}✅ SSL certificate already exists.${NC}"
fi

# Final status check
echo -e "${YELLOW}🔍 Final status check...${NC}"
echo "Docker containers:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "Nginx status:"
sudo systemctl status nginx --no-pager -l

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Verify your .env.production file has all required values"
echo "2. Check that your domain DNS points to $VPS_IP"
echo "3. Test the application at https://$DOMAIN"
echo "4. Monitor logs with: docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo -e "${GREEN}🌐 Your Meta Analytics app should now be available at: https://$DOMAIN${NC}"

