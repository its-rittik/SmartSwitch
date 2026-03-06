#!/usr/bin/env python3
"""
Remote MQTT Bridge with SSL support for hosting
"""

import asyncio
import websockets
import json
import paho.mqtt.client as mqtt
import threading
import time
import logging
import ssl
import os

# Configuration
MQTT_BROKER = "66.29.151.40"
MQTT_PORT = 1883
WEBSOCKET_PORT = int(os.environ.get('PORT', 8766))  # For cloud hosting
HOST = '0.0.0.0'  # Listen on all interfaces for remote access

# MQTT Topics
CONTROL_TOPIC = "SmartSwitch/SUB/9999112512080003"
ACK_TOPIC = "SmartSwitch/ACK"
HEARTBEAT_TOPIC = "SmartSwitch/HB"

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

# Global state
websocket_clients = set()
mqtt_messages = []
mqtt_connected = False

def on_connect(client, userdata, flags, rc, properties=None):
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        logger.info("✅ Connected to MQTT broker")
        client.subscribe(ACK_TOPIC)
        client.subscribe(HEARTBEAT_TOPIC)
        logger.info(f"📡 Subscribed to {ACK_TOPIC} and {HEARTBEAT_TOPIC}")
    else:
        mqtt_connected = False
        logger.error(f"❌ Failed to connect to MQTT broker: {rc}")

def on_message(client, userdata, msg):
    message = {
        "topic": msg.topic,
        "payload": msg.payload.decode(),
        "timestamp": time.time()
    }
    mqtt_messages.append(message)
    logger.info(f"📨 MQTT: {msg.topic} = {msg.payload.decode()}")

def on_disconnect(client, userdata, rc):
    global mqtt_connected
    mqtt_connected = False
    logger.info("🔌 MQTT disconnected")

# MQTT client setup
mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message
mqtt_client.on_disconnect = on_disconnect

def start_mqtt():
    """Start MQTT client in background thread"""
    try:
        logger.info(f"🔄 Connecting to MQTT broker {MQTT_BROKER}:{MQTT_PORT}")
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_forever()
    except Exception as e:
        logger.error(f"❌ MQTT error: {e}")

async def handle_client(websocket):
    """Handle individual WebSocket client with CORS support"""
    client_addr = websocket.remote_address
    websocket_clients.add(websocket)
    logger.info(f"🌐 WebSocket client connected: {client_addr} (Total: {len(websocket_clients)})")
    
    try:
        # Send initial status
        await websocket.send(json.dumps({
            "type": "status",
            "mqtt_connected": mqtt_connected,
            "message": "Connected to remote bridge"
        }))
        
        async for message in websocket:
            try:
                data = json.loads(message)
                
                if data.get("type") == "publish":
                    topic = data.get("topic")
                    payload = data.get("payload")
                    
                    if topic and payload is not None:
                        if mqtt_connected:
                            mqtt_client.publish(topic, payload)
                            logger.info(f"📤 Published: {topic} = {payload}")
                            
                            await websocket.send(json.dumps({
                                "type": "publish_result",
                                "success": True,
                                "topic": topic,
                                "payload": payload
                            }))
                        else:
                            await websocket.send(json.dumps({
                                "type": "publish_result",
                                "success": False,
                                "error": "MQTT not connected"
                            }))
                            
            except json.JSONDecodeError:
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON"
                }))
            except Exception as e:
                logger.error(f"❌ Error handling message: {e}")
                
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
    finally:
        websocket_clients.discard(websocket)
        logger.info(f"👋 Client {client_addr} disconnected (Total: {len(websocket_clients)})")

async def message_forwarder():
    """Forward MQTT messages to WebSocket clients"""
    while True:
        try:
            if mqtt_messages and websocket_clients:
                # Get all pending messages
                messages_to_send = mqtt_messages.copy()
                mqtt_messages.clear()
                
                # Send to all clients
                for message in messages_to_send:
                    disconnected_clients = set()
                    
                    for client in websocket_clients.copy():
                        try:
                            await client.send(json.dumps(message))
                        except websockets.exceptions.ConnectionClosed:
                            disconnected_clients.add(client)
                        except Exception as e:
                            logger.error(f"❌ Error sending to client: {e}")
                            disconnected_clients.add(client)
                    
                    # Remove disconnected clients
                    websocket_clients -= disconnected_clients
            
            await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"❌ Message forwarder error: {e}")
            await asyncio.sleep(1)

async def main():
    # Start MQTT in background thread
    mqtt_thread = threading.Thread(target=start_mqtt, daemon=True)
    mqtt_thread.start()
    
    # Wait for MQTT to connect
    logger.info("⏳ Waiting for MQTT connection...")
    for i in range(10):
        if mqtt_connected:
            break
        await asyncio.sleep(1)
    
    if not mqtt_connected:
        logger.warning("⚠️ MQTT not connected, but starting WebSocket server anyway")
    
    # Start message forwarder
    forwarder_task = asyncio.create_task(message_forwarder())
    
    # Start WebSocket server with CORS support
    logger.info(f"🚀 Starting WebSocket server on {HOST}:{WEBSOCKET_PORT}")
    
    # Add CORS headers for remote access
    async def process_request(path, request_headers):
        return None
    
    async def process_response(path, response_headers):
        response_headers['Access-Control-Allow-Origin'] = '*'
        response_headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response_headers['Access-Control-Allow-Headers'] = '*'
    
    async with websockets.serve(
        handle_client, 
        HOST, 
        WEBSOCKET_PORT,
        process_request=process_request,
        extra_headers={'Access-Control-Allow-Origin': '*'}
    ):
        logger.info("✅ Remote bridge is running!")
        logger.info(f"🌐 WebSocket URL: ws://{HOST}:{WEBSOCKET_PORT}")
        logger.info("📱 Dashboard can now be accessed remotely")
        logger.info("🛑 Press Ctrl+C to stop")
        
        try:
            await asyncio.Future()  # Run forever
        except KeyboardInterrupt:
            logger.info("🛑 Shutting down...")
            forwarder_task.cancel()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("👋 Remote bridge stopped")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")