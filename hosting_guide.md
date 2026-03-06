# 🌐 Remote Hosting Guide for Smart Switch Dashboard

## **Option 1: GitHub Pages + Ngrok (Easiest)**

### Step 1: Host Dashboard on GitHub Pages
1. Push your code to GitHub (you already did this!)
2. Go to your repository settings
3. Scroll to "Pages" section
4. Select "Deploy from a branch" → "main"
5. Your dashboard will be live at: `https://its-rittik.github.io/SmartSwitch/`

### Step 2: Expose Local Bridge with Ngrok
```bash
# Install ngrok (download from ngrok.com)
# Run your bridge locally
python remote_bridge.py

# In another terminal, expose it
ngrok http 8766
```

### Step 3: Update Dashboard URL
Update `dashboard.js` with your ngrok URL:
```javascript
const BRIDGE_URL = 'wss://abc123.ngrok.io';  // Your ngrok URL
```

**Pros:** Free, easy setup
**Cons:** Ngrok URL changes each restart (unless paid plan)

---

## **Option 2: Heroku (Free Tier)**

### Step 1: Create Heroku Files

Create `Procfile`:
```
web: python remote_bridge.py
```

Create `requirements.txt`:
```
paho-mqtt==2.1.0
websockets==16.0
```

### Step 2: Deploy to Heroku
```bash
# Install Heroku CLI
heroku create smartswitch-dashboard
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

### Step 3: Update Dashboard
```javascript
const BRIDGE_URL = 'wss://smartswitch-dashboard.herokuapp.com';
```

**Pros:** Always-on, custom domain
**Cons:** Heroku free tier has limitations

---

## **Option 3: Railway (Modern Alternative)**

### Step 1: Connect GitHub to Railway
1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Deploy automatically

### Step 2: Environment Variables
Set in Railway dashboard:
- `PORT`: 8766
- `MQTT_BROKER`: 66.29.151.40

**Pros:** Modern, fast, good free tier
**Cons:** Newer platform

---

## **Option 4: VPS/Cloud Server (Most Control)**

### Step 1: Get a VPS
- DigitalOcean ($5/month)
- Linode ($5/month)
- AWS EC2 (free tier)

### Step 2: Setup Server
```bash
# Install dependencies
sudo apt update
sudo apt install python3 python3-pip nginx certbot

# Install Python packages
pip3 install paho-mqtt websockets

# Upload your files
scp -r SmartSwitch/ user@your-server:/home/user/

# Run bridge
python3 remote_bridge.py
```

### Step 3: Setup Nginx (for HTTPS)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        try_files $uri $uri/ /index.html;
        root /home/user/SmartSwitch;
    }
    
    location /ws {
        proxy_pass http://localhost:8766;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Pros:** Full control, custom domain, HTTPS
**Cons:** Requires server management

---

## **Option 5: Cloudflare Tunnel (Secure)**

### Step 1: Install Cloudflared
```bash
# Download from cloudflare.com/products/tunnel/
cloudflared tunnel login
cloudflared tunnel create smartswitch
```

### Step 2: Configure Tunnel
Create `config.yml`:
```yaml
tunnel: your-tunnel-id
credentials-file: /path/to/credentials.json

ingress:
  - hostname: smartswitch.your-domain.com
    service: http://localhost:3000
  - hostname: api.smartswitch.your-domain.com
    service: ws://localhost:8766
  - service: http_status:404
```

### Step 3: Run Tunnel
```bash
cloudflared tunnel run smartswitch
```

**Pros:** Secure, no port forwarding, free
**Cons:** Requires domain name

---

## **🔒 Security Considerations**

### For Public Hosting:
1. **Add Authentication**
```javascript
// Simple password protection
const PASSWORD = 'your-secure-password';
if (prompt('Enter password:') !== PASSWORD) {
    alert('Access denied');
    window.location.href = 'about:blank';
}
```

2. **IP Whitelist** (in bridge)
```python
ALLOWED_IPS = ['your.home.ip', 'your.phone.ip']

async def handle_client(websocket):
    client_ip = websocket.remote_address[0]
    if client_ip not in ALLOWED_IPS:
        await websocket.close(code=1008, reason="IP not allowed")
        return
```

3. **HTTPS Only**
Always use `wss://` (secure WebSocket) for remote access.

---

## **📱 Mobile App Alternative**

### Progressive Web App (PWA)
Add to `index.html`:
```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#0f172a">
<meta name="apple-mobile-web-app-capable" content="yes">
```

Create `manifest.json`:
```json
{
  "name": "Smart Switch Dashboard",
  "short_name": "SmartSwitch",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

---

## **🚀 Recommended Setup for You**

**For Quick Testing:**
1. Use GitHub Pages + Ngrok
2. Takes 5 minutes to setup
3. Works immediately

**For Permanent Solution:**
1. Use Railway or Heroku
2. Custom domain
3. Always accessible
4. Professional setup

**For Maximum Security:**
1. VPS with HTTPS
2. IP whitelist
3. Password protection
4. Full control

Choose based on your needs! The GitHub Pages + Ngrok option is perfect for getting started quickly. 🎯