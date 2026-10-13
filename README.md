<div align="center">

<img src="images/Horizons%20logo%20(1).png" width="320" alt="TERYZON Logo">



### Autonomous Ecological Survey & Restoration Rover
 
**Explore. Measure. Understand. Restore.**

[![Website](https://img.shields.io/badge/Website-teryzon.com-af533b?style=flat-square)](https://teryzon.com)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-111111?style=flat-square\&logo=github)](https://github.com/Dhurgesh1/teryzon)
[![Status](https://img.shields.io/badge/Status-Prototype-af533b?style=flat-square)](#development-status)

</div>

---

## About

**TERYZON** is an autonomous ecological survey and restoration rover designed to assess soil health and support practical environmental restoration.

The system combines a mobile rover, environmental sensors, an **ESP32-S3**, and a local web interface to collect and monitor soil data.

The project is being developed with a focus on **Warangal, Telangana**.

> **Measure first. Restore with evidence.**

---

## The Problem

Soil health is essential for agriculture, biodiversity, and healthy ecosystems. However, soil conditions can vary significantly between locations.

Without regular measurements, it can be difficult to:

* Identify soil-health problems
* Understand the condition of an area
* Track changes over time
* Determine whether restoration efforts are working

**TERYZON aims to make soil assessment more practical, repeatable, and accessible.**

---

## What TERYZON Does

TERYZON is designed to:

* 🌱 Measure soil moisture
* 🌡️ Measure temperature
* 💧 Monitor humidity
* 🧪 Measure soil pH
* ⚡ Measure electrical conductivity
* 🚗 Move between survey locations
* 📡 Communicate through Wi-Fi
* 📟 Display readings on an OLED
* 📷 Support visual monitoring using an ESP32-CAM
* ⚙️ Deploy the soil probe using a servo or linear actuator
* 🌐 Provide a local web interface
* 📊 Compare measurements over time
* 🌍 Support environmental restoration strategies

---

## How It Works

```text
                    ┌─────────────────────┐
                    │    SURVEY AREA      │
                    │   Soil / Environment│
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    TERYZON ROVER    │
                    │                     │
                    │     ESP32-S3        │
                    │     Soil Sensors    │
                    │     Motor System    │
                    │     OLED Display    │
                    │     ESP32-CAM       │
                    └──────────┬──────────┘
                               │
                              Wi-Fi
                               │
                               ▼
                    ┌─────────────────────┐
                    │   LOCAL WEB SERVER  │
                    │                     │
                    │   Rover Controls    │
                    │   Live Readings     │
                    │   Sensor Status    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   SOIL ASSESSMENT   │
                    │                     │
                    │ Analyse → Strategy  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ RESTORATION & TEST  │
                    │                     │
                    │ Apply → Recheck     │
                    │ → Compare Results   │
                    └─────────────────────┘
```

---

## Core Workflow

<div align="center">

### EXPLORE → MEASURE → UNDERSTAND → RESTORE

</div>

### 01 — Explore

The rover reaches a selected survey location and prepares for data collection.

### 02 — Measure

Sensors collect environmental and soil measurements.

### 03 — Understand

The collected data can be analysed to identify possible soil-health conditions.

### 04 — Restore

A suitable restoration strategy can be planned and applied.

### 05 — Recheck

New measurements can be collected and compared with the original readings.

---

## Prototype Hardware

| Component                   | Purpose                              |
| --------------------------- | ------------------------------------ |
| **ESP32-S3**                | Main controller and local web server |
| **Soil Moisture Sensor**    | Measures soil moisture               |
| **Temperature Sensor**      | Measures temperature                 |
| **Humidity Sensor**         | Measures humidity                    |
| **pH Sensor**               | Measures soil acidity / alkalinity   |
| **OLED Display**            | Displays readings and system status  |
| **ESP32-CAM**               | Visual monitoring                    |
| **Servo / Linear Actuator** | Deploys the soil sensor probe        |
| **Motor Driver**            | Controls rover motors                |
| **DC Motors**               | Rover movement                       |
| **Wheels**                  | Mobile platform                      |
| **Battery System**          | Powers the prototype                 |

### Rover sensor wiring and setup

The rover sketch targets the ESP32-S3 DevKitM-1 and Arduino-ESP32 core 2.0.17.
The sensor pins below do not overlap the existing motor, servo, or OLED pins:

| Sensor signal | ESP32-S3 pin |
| --- | --- |
| Xcluma pH amplifier analog OUT, through a divider | GPIO 2 |
| SP Electron soil-moisture digital DO | GPIO 1 |
| Waterproof DS18B20 DATA | GPIO 11 |
| Robodo SEN50 DHT11 DATA | GPIO 12 |

Use a common ground. Connect the DS18B20 DATA line to 3.3 V through a **4.7 kOhm
pull-up resistor**. Power the digital moisture module and DHT11 module from 3.3 V
when supported; if either module's DO/DATA output can exceed 3.3 V, add an
appropriate level shifter.

**Protect the pH ADC input:** never connect the amplifier output directly to
GPIO 2. With the pH amplifier output confirmed to stay at or below 5 V, connect
a 10 kOhm resistor from amplifier OUT to GPIO 2 and another 10 kOhm resistor
from GPIO 2 to GND. This halves the voltage (at most 2.5 V at the ADC). If the
amplifier can output above 5 V, select a divider for its verified maximum so
GPIO 2 stays below 3.0 V under all conditions. The sketch reports both the
reconstructed amplifier output voltage and the divided ADC-pin voltage. If you
change the divider, update `PH_DIVIDER_RATIO` to match its output/input ratio.

Install these Arduino libraries using Library Manager: **OneWire**,
**DallasTemperature**, and **DHT sensor library** (Adafruit). The DS18B20
conversion is asynchronous; readings are refreshed about every two seconds.
DHT11 readings are also sampled about every two seconds. Disconnected or
invalid temperature/humidity readings are shown as unavailable, not as
fabricated values.

The soil-moisture card reports only **WET** or **DRY** from the digital DO pin;
it is not a percentage. Change `SOIL_MOISTURE_WET_LEVEL` in
`rover/rover.ino` if the module's active output polarity differs.

The pH estimate is disabled until calibrated. Rinse the probe between pH 4.00
and 7.00 buffer solutions, measure and record the amplifier OUT voltage for
each buffer using the dashboard, enter those two values in
`PH4_CALIBRATION_VOLTAGE` and `PH7_CALIBRATION_VOLTAGE`, then set
`PH_CALIBRATION_CONFIGURED` to `true` in `rover/rover.ino`. Until then the
dashboard/API provide ADC raw counts and voltages but return pH as unavailable.

---

## Technology Stack

### Hardware

* ESP32-S3
* Environmental sensors
* Soil sensors
* OLED display
* ESP32-CAM
* Motor driver
* DC motors
* Servo / linear actuator

### Software

* Arduino / C++
* HTML
* CSS
* JavaScript

### Connectivity

* Wi-Fi
* Local ESP32 web server
* Direct rover ↔ web interface communication

The current system is designed to operate **locally**, allowing the monitoring interface to communicate directly with the ESP32-S3.

---

## System Architecture

```text
┌───────────────────────────────────────────┐
│              TERYZON ROVER                │
│                                           │
│  ESP32-S3                                 │
│     │                                     │
│     ├── Soil Moisture                     │
│     ├── Temperature                       │
│     ├── Humidity                          │
│     ├── pH                                │
│     ├── OLED                              │
│     ├── ESP32-CAM                         │
│     ├── Motor Driver                      │
│     └── Probe Actuator                    │
│                                           │
└───────────────────┬───────────────────────┘
                    │
                   Wi-Fi
                    │
                    ▼
┌───────────────────────────────────────────┐
│            TERYZON WEB INTERFACE          │
│                                           │
│  • Rover Control                          │
│  • Sensor Monitoring                      │
│  • Live Readings                          │
│  • System Status                          │
│  • Data Collection                        │
│                                           │
└───────────────────┬───────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────┐
│             SOIL ANALYSIS                 │
│                                           │
│       Measurements → Analysis             │
│                    ↓                      │
│              Strategy                     │
│                    ↓                      │
│             Restoration                   │
│                    ↓                      │
│              Recheck                      │
│                                           │
└───────────────────────────────────────────┘
```

---

## Environmental Impact

TERYZON is based on a simple idea:

> **Environmental restoration should begin with understanding the condition of the environment.**

Repeated measurements can help:

* Identify areas requiring attention
* Understand changes in soil conditions
* Support evidence-based restoration
* Evaluate restoration efforts
* Build a repeatable monitoring process

The project aligns with **UN Sustainable Development Goal 15 — Life on Land.**

---

## Project Goal

> **To develop a practical rover-based system that can assess soil health and support strategies to improve soil health in Warangal.**

TERYZON combines hardware, software, environmental monitoring, and data analysis into a single ecological technology platform.

---

## Team

| Member              | Role                                    |
| ------------------- | --------------------------------------- |
| **Dhurgesh Maloth** | Project Lead · Website · Rover · Design |
| **Ayansh Singh**    | Website                                 |
| **Ritvik**          | Rover                                   |
| **Reyansh**         | Rover · Website Design · Video          |
| **Kavish**          | Data Research                           |
| **Tejas**           | AI & Data Research                      |

**Skill Stork International School**
Warangal, Telangana

---

## Project Links

<div align="center">

### 🌐 Website

**[teryzon.com](https://teryzon.com)**

### 💻 GitHub

**[Dhurgesh1/teryzon](https://github.com/Dhurgesh1/teryzon)**

</div>

---

## License

This project is currently being developed as a school environmental innovation project.

---

<div align="center">

# TERYZON

### Explore. Measure. Understand. Restore.

**Autonomous Ecological Survey & Restoration Rover**

</div>
