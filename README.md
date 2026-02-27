# SmartSwitch Dashboard

A modern, responsive web dashboard for controlling MQTT-based smart switches with advanced timer functionality and persistent state management.

## 🌟 Features

### 🎛️ Device Control
- **3 Smart Switches**: Fan, Main Light, Desk Light
- **Real-time Status**: Live ON/OFF indicators with MQTT feedback
- **Speed Control**: Fan speed adjustment (Low/Medium/High)
- **Instant Response**: Optimistic UI updates with server confirmation

### ⏰ Advanced Timer System
- **Quick Timers**: Set timers up to 120 minutes with slider control
- **Visual Progress**: Timer sliders decrease in real-time showing remaining time
- **Multiple Timers**: Set multiple concurrent timers per device
- **Timer Actions**: Choose to turn devices ON or OFF after timer expires
- **Persistent Timers**: Timers survive browser reloads and continue running

### 📅 Scheduling
- **Time-based Control**: Schedule devices to turn ON/OFF at specific times
- **Daily Repeat**: Set recurring daily schedules
- **Multiple Schedules**: Create unlimited scheduled actions

### 💾 Smart Persistence
- **Browser Storage**: All settings saved locally in browser
- **State Recovery**: Device states, timers, and schedules restored on reload
- **Offline Resilience**: Dashboard remembers everything even after hours offline

### 🎨 Modern UI
- **Glass Morphism**: Beautiful modern design with blur effects
- **Dark Theme**: Easy on the eyes with professional color scheme
- **Mobile Responsive**: Works perfectly on phones, tablets, and desktop
- **Real-time Updates**: Live countdown displays and status indicators

## 🚀 Quick Start

### Prerequisites
- Python 3.7+
- Modern web browser
- MQTT broker access

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/its-rittik/SmartSwitch.git
cd SmartSwitch
```

2. **Install Python dependencies**
```bash
pip install paho-mqtt websockets
```

3. **Start the MQTT bridge**
```bash
python working_bridge.py
```

4. **Open the dashboard**
   - Open `index.html` in your web browser
   - Or use the auto-open feature when running the bridge

## 📁 Project Structure

```
SmartSwitch/
├── index.html              # Main dashboard interface
├── dashboard.js            # Dashboard logic with persistence
├── working_bridge.py       # MQTT to WebSocket bridge
├── restart_bridge.bat      # Windows restart script
├── mqtt.py                 # Direct MQTT testing script
└── README.md              # This file
```

## ⚙️ Configuration

### MQTT Settings
Edit the configuration in `dashboard.js` and `working_bridge.py`:

```javascript
// Dashboard configuration
const BRIDGE_URL = 'ws://localhost:8766';
const CONTROL_TOPIC = 'SmartSwitch/SUB/9999112512080003';
const ACK_TOPIC = 'SmartSwitch/ACK';
const HEARTBEAT_TOPIC = 'SmartSwitch/HB';
```

```python
# Bridge configuration
MQTT_BROKER = "66.29.151.40"
MQTT_PORT = 1883
WEBSOCKET_PORT = 8766
```

### Device Mapping
- **sw1**: Fan (with speed control)
- **sw3**: Main Light (opposite of table)
- **sw4**: Desk Light (beside table)

## 🎯 Usage

### Basic Control
1. **Toggle Devices**: Click the switch buttons to turn devices ON/OFF
2. **Set Timers**: Use sliders to set auto-off/on timers
3. **Speed Control**: Adjust fan speed with the speed slider
4. **Schedule**: Add time-based schedules for automatic control

### Timer Features
- **Quick Timer**: Drag slider, select ON/OFF action, timer starts automatically
- **Multiple Timers**: Click "+ Add" to create multiple concurrent timers
- **Visual Progress**: Watch sliders decrease as timers count down
- **Persistent**: Timers continue even if you close the browser

### Advanced Features
- **Debug Panel**: Click to expand and see connection logs
- **Storage Management**: Use `clearStorage()` in browser console to reset all data
- **Auto-reconnect**: Dashboard automatically reconnects if connection drops

## 🔧 Troubleshooting

### Connection Issues
```bash
# Kill existing processes and restart
taskkill /f /im python.exe
python working_bridge.py
```

### Port Conflicts
If port 8766 is in use, update both files:
- Change `WEBSOCKET_PORT` in `working_bridge.py`
- Change `BRIDGE_URL` in `dashboard.js`

### Clear Saved Data
Open browser console and run:
```javascript
clearStorage()
```

## 🛠️ Technical Details

### Architecture
- **Frontend**: HTML5 + Tailwind CSS + Vanilla JavaScript
- **Backend**: Python WebSocket bridge
- **Communication**: MQTT over WebSockets
- **Storage**: Browser localStorage for persistence

### MQTT Protocol
- **Commands**: `sw1:1` (ON), `sw1:0` (OFF)
- **Feedback**: Device confirms state via ACK topic
- **Heartbeat**: Regular device health checks

### Browser Compatibility
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 📱 Mobile Support

The dashboard is fully responsive and optimized for mobile devices:
- Touch-friendly controls
- Swipe-compatible sliders
- Readable text on small screens
- Fast loading and smooth animations

## 🔒 Security Notes

- Dashboard runs locally in browser
- No external data transmission except to your MQTT broker
- All settings stored locally in browser
- No user accounts or authentication required

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

If you encounter issues:
1. Check the debug panel in the dashboard
2. Verify MQTT broker connectivity
3. Ensure Python dependencies are installed
4. Check browser console for errors

## 🎉 Acknowledgments

- Built with modern web technologies
- Inspired by smart home automation needs
- Designed for reliability and ease of use

---

**Made with ❤️ for smart home enthusiasts**