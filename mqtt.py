import paho.mqtt.client as mqtt

# Connection Details
BROKER = "66.29.151.40"
# Based on your notes and screenshots, this is the hardware control topic
TOPIC = "SmartSwitch/SUB/9999112512080003" 

def main():
    # VERSION2 is required to avoid the DeprecationWarning you saw earlier
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    
    print(f"Connecting to {BROKER}...")
    client.connect(BROKER, 1883)
    
    # 'sw1:0' is the specific payload to turn Switch 1 ON
    payload = "sw3:1"
    
    print(f"Sending command: {payload}")
    client.publish(TOPIC, payload)
    
    client.disconnect()
    print("Command sent successfully!")

if __name__ == "__main__":
    main()