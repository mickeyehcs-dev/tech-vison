import requests
import time
import random

# ==============================
# SERVER CONFIGURATION
# ==============================

SERVER_URL = "http://localhost:8787/api/v1/sensors/data"

DEVICE_ID = "SFM-936474A0"
API_KEY = "sfm_88897fed3e50feaff307c8e1feb78315a7ca6e011d0d8390"


# ==============================
# SEND SENSOR DATA
# ==============================

def send_telemetry(temp, humidity, methane, latitude, longitude, co2=480.0):

    headers = {
        "Content-Type": "application/json",
        "X-DEVICE-ID": DEVICE_ID,
        "X-API-KEY": API_KEY
    }

    data = {
        "temp": temp,
        "humidity": humidity,
        "methane": methane,
        "co2": co2,
        "latitude": latitude,
        "longitude": longitude
    }

    print("\nSending data...")
    print("------------------------------")
    print(f"Temperature : {temp} °C")
    print(f"Humidity    : {humidity} %")
    print(f"Methane     : {methane} ppm")
    print(f"CO2         : {co2} ppm")
    print(f"Latitude    : {latitude}")
    print(f"Longitude   : {longitude}")
    print("------------------------------")

    try:
        response = requests.post(
            SERVER_URL,
            headers=headers,
            json=data,
            timeout=10
        )

        print(f"HTTP Status Code: {response.status_code}")

        print("Server Response:")
        print(response.text)

        if 200 <= response.status_code < 300:
            print("\nSUCCESS: Website accepted the sensor data.")
        else:
            print("\nERROR: Website rejected the sensor data.")

    except requests.exceptions.ConnectionError:
        print("\nERROR: Could not connect to the server.")
        print("Check that:")
        print("1. Your website/API server is running.")
        print("2. The IP address is correct.")
        print("3. Port 8787 is open.")
        print("4. Your PC and server are on the same network.")

    except requests.exceptions.Timeout:
        print("\nERROR: Server took too long to respond.")

    except requests.exceptions.RequestException as e:
        print("\nREQUEST ERROR:")
        print(e)


# ==============================
# TEST DATA
# ==============================

temperature = 27.5
humidity = 65.2
methane = 12.8
co2 = 520.0
latitude = 13.5503
longitude = 78.5029


# ==============================
# SEND ONCE
# ==============================

send_telemetry(
    temperature,
    humidity,
    methane,
    latitude,
    longitude,
    co2
)