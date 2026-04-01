#!/usr/bin/env python3
"""
Smart Switch Backend - MQTT to WebSocket Bridge
Serves static frontend and handles WebSocket connections
"""

import asyncio
import websockets
import json
import paho.mqtt.client as mqtt
import threading
import time
import logging
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
import signal

# Configuration
MQTT_BROKER = os.environ.get('MQTT_BROKER', '66.29.151.40')
MQTT_PORT = int(os.environ.get('MQTT_PORT', 1883))
WEBSOCKET_PORT = int(os.environ.get('WS_PORT', 8766))
HTTP_PORT = int(os.environ.get('PORT', 8080))
HOST = '0.0.0.0'

# MQTT Topics
ACK_TOPIC = "SmartSwitch/ACK"
HEARTBEAT_TOPIC = "SmartSwitch/HB"

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
        logger.info("Connected to MQTT broker")
        client.subscribe(ACK_TOPIC)
        client.subscribe(HEARTBEAT_TOPIC)
    else:
        mqtt_connected = False
        logger.error(f"Failed to connect to MQTT broker: rc={rc}")


def on_message(client, userdata, msg):
    mqtt_messages.append({
        "topic": msg.topic,
        "payload": msg.payload.decode(),
        "timestamp": time.time()
    })


def on_disconnect(client, userdata, rc):
    global mqtt_connected
    mqtt_connected = False
    logger.info("MQTT disconnected")


mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message
mqtt_client.on_disconnect = on_disconnect


def start_mqtt():
    while True:
        try:
            logger.info(f"Connecting to MQTT {MQTT_BROKER}:{MQTT_PORT}")
            mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
            mqtt_client.loop_forever()
        except Exception as e:
            logger.error(f"MQTT error: {e}, retrying in 5s...")
            time.sleep(5)


async def handle_client(websocket):
    websocket_clients.add(websocket)
    logger.info(f"WebSocket client connected: {websocket.remote_address}")

    try:
        await websocket.send(json.dumps({
            "type": "status",
            "mqtt_connected": mqtt_connected
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
                await websocket.send(json.dumps({"type": "error", "message": "Invalid JSON"}))

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        websocket_clients.discard(websocket)
        logger.info(f"WebSocket client disconnected: {websocket.remote_address}")


async def message_forwarder():
    while True:
        try:
            if mqtt_messages and websocket_clients:
                messages_to_send = mqtt_messages.copy()
                mqtt_messages.clear()
                dead = set()
                for msg in messages_to_send:
                    for client in websocket_clients.copy():
                        try:
                            await client.send(json.dumps(msg))
                        except Exception:
                            dead.add(client)
                websocket_clients -= dead
            await asyncio.sleep(0.1)
        except Exception as e:
            logger.error(f"Forwarder error: {e}")
            await asyncio.sleep(1)


def start_http_server():
    """Serve static files (index.html, dashboard.js) from current directory"""
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    handler = SimpleHTTPRequestHandler
    handler.log_message = lambda *args: None  # suppress access logs
    server = HTTPServer((HOST, HTTP_PORT), handler)
    logger.info(f"HTTP server on port {HTTP_PORT}")
    server.serve_forever()


async def main():
    # Start MQTT
    threading.Thread(target=start_mqtt, daemon=True).start()

    # Start HTTP server for frontend
    threading.Thread(target=start_http_server, daemon=True).start()

    # Wait briefly for MQTT
    for _ in range(10):
        if mqtt_connected:
            break
        await asyncio.sleep(1)

    forwarder = asyncio.create_task(message_forwarder())

    logger.info(f"WebSocket server on port {WEBSOCKET_PORT}")
    async with websockets.serve(
        handle_client,
        HOST,
        WEBSOCKET_PORT,
        extra_headers={'Access-Control-Allow-Origin': '*'}
    ):
        logger.info(f"Bridge running — frontend: http://0.0.0.0:{HTTP_PORT}, ws: ws://0.0.0.0:{WEBSOCKET_PORT}")
        try:
            await asyncio.Future()
        except (KeyboardInterrupt, asyncio.CancelledError):
            forwarder.cancel()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Stopped")
