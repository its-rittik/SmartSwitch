# Smart Switch Dashboard

MQTT-to-WebSocket bridge + web dashboard for controlling smart switches.

## Stack

- `remote_bridge.py` — Python backend: serves the frontend (port 8080) and WebSocket bridge (port 8766)
- `index.html` + `dashboard.js` — Frontend dashboard
- MQTT broker at `66.29.151.40:1883`

## Deploy on AWS VM (EC2)

### 1. SSH into your instance and clone the repo

```bash
git clone <your-repo-url>
cd <repo-folder>
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Open ports in your EC2 Security Group

Add inbound rules for:
- TCP `8080` — HTTP (frontend)
- TCP `8766` — WebSocket

### 4. Run the bridge

```bash
python remote_bridge.py
```

Access the dashboard at `http://<your-ec2-ip>:8080`

### 5. Run as a background service (optional)

```bash
# Keep running after SSH disconnect
nohup python remote_bridge.py > bridge.log 2>&1 &
```

Or use systemd — create `/etc/systemd/system/smartswitch.service`:

```ini
[Unit]
Description=Smart Switch Bridge
After=network.target

[Service]
WorkingDirectory=/path/to/your/repo
ExecStart=/usr/bin/python3 remote_bridge.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable smartswitch
sudo systemctl start smartswitch
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MQTT_BROKER` | `66.29.151.40` | MQTT broker IP |
| `MQTT_PORT` | `1883` | MQTT broker port |
| `PORT` | `8080` | HTTP server port |
| `WS_PORT` | `8766` | WebSocket server port |
