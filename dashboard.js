// Smart Switch Dashboard - With Local Storage Persistence

// Configuration
const BRIDGE_URL = 'ws://localhost:8766';
const CONTROL_TOPIC = 'SmartSwitch/SUB/9999112512080003';
const ACK_TOPIC = 'SmartSwitch/ACK';
const HEARTBEAT_TOPIC = 'SmartSwitch/HB';

// Storage keys for persistence
const STORAGE_KEYS = {
    DEVICE_STATES: 'smartswitch_device_states',
    TIMER_ACTIONS: 'smartswitch_timer_actions',
    QUICK_TIMERS: 'smartswitch_quick_timers',
    MULTI_TIMERS: 'smartswitch_multi_timers',
    SCHEDULES: 'smartswitch_schedules',
    LAST_UPDATE: 'smartswitch_last_update'
};

// Global variables
let bridgeSocket = null;
let deviceStates = {
    sw1: false, // Fan - default OFF
    sw3: false, // Main Light - default OFF
    sw4: false  // Desk Light - default OFF
};
let timerActions = {
    fan: 'off',
    mainlight: 'off',
    desklight: 'off'
};
let quickTimers = {};
let multiTimers = {};
let schedules = [];
let lastHeartbeat = null;
let heartbeatInterval = null;
let countdownInterval = null;

// ==================== LOCAL STORAGE FUNCTIONS ====================

// Save data to localStorage
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.setItem(STORAGE_KEYS.LAST_UPDATE, Date.now().toString());
        debugLog(`💾 Saved ${key} to storage`);
    } catch (error) {
        debugLog(`❌ Failed to save ${key}: ${error}`);
    }
}

// Load data from localStorage
function loadFromStorage(key, defaultValue = null) {
    try {
        const stored = localStorage.getItem(key);
        if (stored) {
            const data = JSON.parse(stored);
            debugLog(`📂 Loaded ${key} from storage`);
            return data;
        }
    } catch (error) {
        debugLog(`❌ Failed to load ${key}: ${error}`);
    }
    return defaultValue;
}

// Save device state
function saveDeviceState(switchId, state) {
    deviceStates[switchId] = state;
    saveToStorage(STORAGE_KEYS.DEVICE_STATES, deviceStates);
    debugLog(`💾 Device ${switchId}: ${state ? 'ON' : 'OFF'} saved`);
}

// Save timer actions
function saveTimerActions() {
    saveToStorage(STORAGE_KEYS.TIMER_ACTIONS, timerActions);
}

// Save quick timers
function saveQuickTimers() {
    // Convert timers to saveable format (without timeout objects)
    const saveableTimers = {};
    Object.keys(quickTimers).forEach(switchId => {
        const timer = quickTimers[switchId];
        saveableTimers[switchId] = {
            endTime: timer.endTime,
            action: timer.action,
            deviceName: timer.deviceName,
            remainingMs: timer.endTime - Date.now()
        };
    });
    saveToStorage(STORAGE_KEYS.QUICK_TIMERS, saveableTimers);
}

// Save multi timers
function saveMultiTimers() {
    const saveableMultiTimers = {};
    Object.keys(multiTimers).forEach(switchId => {
        saveableMultiTimers[switchId] = {};
        Object.keys(multiTimers[switchId]).forEach(timerId => {
            const timer = multiTimers[switchId][timerId];
            saveableMultiTimers[switchId][timerId] = {
                endTime: timer.endTime,
                action: timer.action,
                deviceName: timer.deviceName,
                remainingMs: timer.endTime - Date.now()
            };
        });
    });
    saveToStorage(STORAGE_KEYS.MULTI_TIMERS, saveableMultiTimers);
}

// Save schedules
function saveSchedules() {
    saveToStorage(STORAGE_KEYS.SCHEDULES, schedules);
}

// Load all data from storage
function loadAllFromStorage() {
    debugLog('📂 Loading saved data from browser storage...');

    // Load device states
    const savedStates = loadFromStorage(STORAGE_KEYS.DEVICE_STATES, deviceStates);
    if (savedStates) {
        deviceStates = { ...deviceStates, ...savedStates };
        debugLog(`📂 Restored device states: ${JSON.stringify(deviceStates)}`);
    }

    // Load timer actions
    const savedTimerActions = loadFromStorage(STORAGE_KEYS.TIMER_ACTIONS, timerActions);
    if (savedTimerActions) {
        timerActions = { ...timerActions, ...savedTimerActions };
    }

    // Load and restore quick timers
    const savedQuickTimers = loadFromStorage(STORAGE_KEYS.QUICK_TIMERS, {});
    if (savedQuickTimers) {
        Object.keys(savedQuickTimers).forEach(switchId => {
            const savedTimer = savedQuickTimers[switchId];
            const remainingMs = savedTimer.remainingMs;

            if (remainingMs > 0) {
                // Restore active timer
                const deviceName = savedTimer.deviceName;
                const slider = document.getElementById(`${deviceName}-timer-slider`);
                if (slider) {
                    // Set slider to REMAINING time, not original time
                    const remainingMinutes = Math.ceil(remainingMs / 60000);
                    slider.value = remainingMinutes;
                    updateQuickTimerDisplay(deviceName, remainingMinutes);
                }

                // Restore timer action
                if (timerActions[deviceName] !== savedTimer.action) {
                    setTimerAction(deviceName, savedTimer.action);
                }

                quickTimers[switchId] = {
                    endTime: Date.now() + remainingMs,
                    action: savedTimer.action,
                    deviceName: savedTimer.deviceName,
                    timeout: setTimeout(() => {
                        if (savedTimer.action === 'on') {
                            if (!deviceStates[switchId]) toggleDevice(switchId, savedTimer.deviceName);
                        } else {
                            if (deviceStates[switchId]) toggleDevice(switchId, savedTimer.deviceName);
                        }
                        delete quickTimers[switchId];
                        saveQuickTimers(); // Save after timer executes
                        document.getElementById(`${savedTimer.deviceName}-timer-countdown`).textContent = '';

                        // Reset slider to 0 when timer finishes
                        const slider = document.getElementById(`${savedTimer.deviceName}-timer-slider`);
                        if (slider) {
                            slider.value = 0;
                            updateQuickTimerDisplay(savedTimer.deviceName, 0);
                        }
                    }, remainingMs)
                };

                debugLog(`⏰ Restored timer for ${savedTimer.deviceName}: ${Math.ceil(remainingMs / 60000)}m remaining`);
            }
        });
    }

    // Load schedules
    const savedSchedules = loadFromStorage(STORAGE_KEYS.SCHEDULES, []);
    if (savedSchedules && savedSchedules.length > 0) {
        schedules = savedSchedules;
        // Restore schedule UI
        schedules.forEach(schedule => {
            restoreScheduleUI(schedule);
            setupSchedule(schedule);
        });
        debugLog(`📅 Restored ${schedules.length} schedules`);
    }

    // Show last update time
    const lastUpdate = loadFromStorage(STORAGE_KEYS.LAST_UPDATE);
    if (lastUpdate) {
        const lastUpdateDate = new Date(parseInt(lastUpdate));
        debugLog(`📅 Last saved: ${lastUpdateDate.toLocaleString()}`);
    }
}

// ==================== MAIN DASHBOARD FUNCTIONS ====================

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function () {
    debugLog('🚀 Starting Smart Switch Dashboard with Persistence...');

    // Load saved data first
    loadAllFromStorage();

    // Update UI with loaded states
    updateAllDeviceUI();
    updateAllTimerActions();

    // Then connect to bridge
    initBridge();
    startHeartbeatMonitor();
    startCountdownUpdater();
});

// Initialize all device UI
function updateAllDeviceUI() {
    Object.keys(deviceStates).forEach(switchId => {
        updateDeviceUI(switchId, deviceStates[switchId]);
    });
}

// Update all timer action toggles
function updateAllTimerActions() {
    Object.keys(timerActions).forEach(deviceName => {
        const toggle = document.getElementById(`${deviceName}-timer-toggle`);
        if (toggle) {
            const options = toggle.querySelectorAll('.timer-option');
            options.forEach(option => {
                option.classList.remove('active');
                if (option.textContent.toLowerCase() === timerActions[deviceName]) {
                    option.classList.add('active');
                }
            });
        }
    });
}

// Bridge Connection
function initBridge() {
    debugLog('🔄 Connecting to bridge...');
    updateConnectionStatus('connecting');

    try {
        bridgeSocket = new WebSocket(BRIDGE_URL);

        bridgeSocket.onopen = function () {
            updateConnectionStatus('connected');
            debugLog('✅ Connected to MQTT bridge');
        };

        bridgeSocket.onmessage = function (event) {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'status') {
                    debugLog(`📊 Bridge MQTT: ${data.mqtt_connected ? 'Connected' : 'Disconnected'}`);
                } else if (data.topic) {
                    if (data.topic === ACK_TOPIC) {
                        handleAckMessage(data.payload);
                    } else if (data.topic === HEARTBEAT_TOPIC) {
                        handleHeartbeat(data.payload);
                    }
                }
            } catch (error) {
                debugLog('❌ Message parse error: ' + error);
            }
        };

        bridgeSocket.onerror = function (error) {
            updateConnectionStatus('disconnected');
            debugLog('❌ Bridge connection error');
        };

        bridgeSocket.onclose = function (event) {
            updateConnectionStatus('disconnected');
            debugLog('🔌 Bridge connection closed');

            setTimeout(() => {
                debugLog('🔄 Attempting to reconnect...');
                initBridge();
            }, 3000);
        };

    } catch (error) {
        debugLog('❌ Failed to create connection: ' + error);
        updateConnectionStatus('disconnected');
        setTimeout(initBridge, 5000);
    }
}

// Publish message through bridge
function publishMessage(topic, payload) {
    if (bridgeSocket && bridgeSocket.readyState === WebSocket.OPEN) {
        const message = {
            type: 'publish',
            topic: topic,
            payload: payload
        };
        bridgeSocket.send(JSON.stringify(message));
        debugLog(`📤 Sent: ${payload}`);
        return true;
    } else {
        debugLog('❌ Bridge not connected');
        return false;
    }
}

// Handle ACK messages with persistence
function handleAckMessage(payload) {
    const parts = payload.split(',');
    if (parts.length === 2) {
        const [deviceId, command] = parts;
        const [switchId, state] = command.split(':');

        if (deviceStates.hasOwnProperty(switchId)) {
            const isOn = state === '1'; // 1=ON, 0=OFF
            const wasOn = deviceStates[switchId];

            // Update state and save to storage
            saveDeviceState(switchId, isOn);
            updateDeviceUI(switchId, isOn);

            if (wasOn !== isOn) {
                debugLog(`✅ ${switchId} status: ${isOn ? 'ON' : 'OFF'} (saved)`);
            }
        }
    }
}

// Handle heartbeat messages
function handleHeartbeat(payload) {
    lastHeartbeat = Date.now();
    updateDeviceStatus(true);

    if (payload && payload.includes(',')) {
        handleAckMessage(payload);
    }
}

// Monitor device heartbeat
function startHeartbeatMonitor() {
    heartbeatInterval = setInterval(function () {
        if (lastHeartbeat && (Date.now() - lastHeartbeat > 45000)) {
            updateDeviceStatus(false);
        }
    }, 5000);
}

// Update connection status
function updateConnectionStatus(status) {
    const dot = document.getElementById('connection-dot');
    const text = document.getElementById('connection-text');

    dot.className = 'status-dot';

    switch (status) {
        case 'connected':
            dot.classList.add('status-online');
            text.textContent = 'Connected';
            break;
        case 'connecting':
            dot.classList.add('status-connecting');
            text.textContent = 'Connecting...';
            break;
        default:
            dot.classList.add('status-offline');
            text.textContent = 'Disconnected';
    }
}

// Update device status
function updateDeviceStatus(online) {
    const dot = document.getElementById('device-dot');
    const text = document.getElementById('device-text');

    dot.className = 'status-dot';

    if (online) {
        dot.classList.add('status-online');
        text.textContent = 'Device Online';
    } else {
        dot.classList.add('status-offline');
        text.textContent = 'Device Offline';
    }
}

// Toggle device with persistence
function toggleDevice(switchId, deviceName) {
    const currentState = deviceStates[switchId];
    const newState = !currentState;
    const command = `${switchId}:${newState ? '1' : '0'}`;

    if (publishMessage(CONTROL_TOPIC, command)) {
        // Save new state immediately
        saveDeviceState(switchId, newState);
        updateDeviceUI(switchId, newState);
    }
}

// Update device UI
function updateDeviceUI(switchId, isOn) {
    const deviceName = getDeviceName(switchId);
    const switchElement = document.getElementById(`${deviceName}-switch`);

    if (switchElement) {
        if (isOn) {
            switchElement.className = 'switch-button on';
        } else {
            switchElement.className = 'switch-button off';

            // Clear timer if device turned off
            if (quickTimers[switchId]) {
                clearTimeout(quickTimers[switchId].timeout);
                delete quickTimers[switchId];
                saveQuickTimers(); // Save updated timers
                document.getElementById(`${deviceName}-timer-countdown`).textContent = '';

                const slider = document.getElementById(`${deviceName}-timer-slider`);
                if (slider) {
                    slider.value = 0;
                    updateQuickTimerDisplay(deviceName, 0);
                }
            }
        }
    }
}

// Get device name from switch ID
function getDeviceName(switchId) {
    const mapping = {
        'sw1': 'fan',
        'sw3': 'mainlight',
        'sw4': 'desklight'
    };
    return mapping[switchId];
}

// Update speed display
function updateSpeedDisplay(deviceName, speedValue) {
    const speeds = ['', 'Low', 'Medium', 'High'];
    const speedName = speeds[speedValue];
    document.getElementById(`${deviceName}-speed-display`).textContent = speedName;
}

// Set fan speed
function setFanSpeed(switchId, speedValue) {
    const speeds = ['', 'Low', 'Medium', 'High'];
    const speedName = speeds[speedValue];

    debugLog(`🌀 Fan speed: ${speedName}`);

    if (!deviceStates[switchId]) {
        toggleDevice(switchId, 'fan');
    }
}

// Set timer action with persistence
function setTimerAction(deviceName, action) {
    timerActions[deviceName] = action;
    saveTimerActions(); // Save to storage

    const toggle = document.getElementById(`${deviceName}-timer-toggle`);
    const options = toggle.querySelectorAll('.timer-option');

    options.forEach(option => {
        option.classList.remove('active');
        if (option.textContent.toLowerCase() === action) {
            option.classList.add('active');
        }
    });

    debugLog(`⚙️ Timer action for ${deviceName}: ${action.toUpperCase()} (saved)`);
}

// Update quick timer display with bubble
function updateQuickTimerDisplay(deviceName, minutes) {
    const bubble = document.getElementById(`${deviceName}-timer-bubble`);
    const slider = document.getElementById(`${deviceName}-timer-slider`);

    if (bubble && slider) {
        if (minutes == 0) {
            bubble.textContent = 'Off';
            bubble.style.opacity = '0';
        } else {
            bubble.textContent = `${minutes}m`;
            bubble.style.opacity = '1';

            const percentage = (minutes / 120) * 100;
            const sliderWidth = slider.offsetWidth;
            const bubbleWidth = bubble.offsetWidth;
            const thumbPosition = (percentage / 100) * (sliderWidth - 20);
            const bubblePosition = Math.max(0, Math.min(sliderWidth - bubbleWidth, thumbPosition - bubbleWidth / 2 + 10));

            bubble.style.left = `${bubblePosition}px`;
        }
    }
}

// Set quick timer with persistence
function setQuickTimer(switchId, deviceName) {
    const slider = document.getElementById(`${deviceName}-timer-slider`);
    const minutes = parseInt(slider.value);
    const action = timerActions[deviceName];

    // Clear existing timer
    if (quickTimers[switchId]) {
        clearTimeout(quickTimers[switchId].timeout);
        delete quickTimers[switchId];
    }

    if (minutes === 0) {
        document.getElementById(`${deviceName}-timer-countdown`).textContent = '';
        saveQuickTimers(); // Save cleared timer
        return;
    }

    const endTime = Date.now() + (minutes * 60 * 1000);
    quickTimers[switchId] = {
        endTime: endTime,
        action: action,
        deviceName: deviceName,
        timeout: setTimeout(() => {
            if (action === 'on') {
                if (!deviceStates[switchId]) toggleDevice(switchId, deviceName);
            } else {
                if (deviceStates[switchId]) toggleDevice(switchId, deviceName);
            }
            delete quickTimers[switchId];
            saveQuickTimers(); // Save after timer executes
            document.getElementById(`${deviceName}-timer-countdown`).textContent = '';
            slider.value = 0;
        }, minutes * 60 * 1000)
    };

    saveQuickTimers(); // Save new timer
    debugLog(`⏰ Timer: ${minutes}m to ${action.toUpperCase()} ${deviceName} (saved)`);
}

// Add multiple timer with persistence
function addMultiTimer(switchId, deviceName) {
    const container = document.getElementById(`${deviceName}-multi-timers`);
    const timerId = Date.now();

    const timerDiv = document.createElement('div');
    timerDiv.className = 'flex items-center space-x-2 p-2 bg-black bg-opacity-30 rounded-lg text-xs fade-in';
    timerDiv.id = `timer-${timerId}`;

    timerDiv.innerHTML = `
        <input type="number" min="1" max="1440" placeholder="Min" 
               class="w-12 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs">
        <div class="timer-toggle" style="transform: scale(0.8);">
            <div class="timer-option active" onclick="setMultiTimerAction(${timerId}, 'off')">OFF</div>
            <div class="timer-option" onclick="setMultiTimerAction(${timerId}, 'on')">ON</div>
        </div>
        <button onclick="setMultiTimer('${switchId}', '${deviceName}', ${timerId})" 
                class="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">Set</button>
        <button onclick="removeMultiTimer(${timerId})" 
                class="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">×</button>
        <div class="flex-1 text-green-400 font-mono text-right" id="countdown-${timerId}"></div>
    `;

    container.appendChild(timerDiv);
    timerDiv.dataset.action = 'off';
}

// Set multi-timer action
function setMultiTimerAction(timerId, action) {
    const timerDiv = document.getElementById(`timer-${timerId}`);
    const toggle = timerDiv.querySelector('.timer-toggle');
    const options = toggle.querySelectorAll('.timer-option');

    options.forEach(option => {
        option.classList.remove('active');
        if (option.textContent.toLowerCase() === action) {
            option.classList.add('active');
        }
    });

    timerDiv.dataset.action = action;
}

// Set multiple timer with persistence
function setMultiTimer(switchId, deviceName, timerId) {
    const timerDiv = document.getElementById(`timer-${timerId}`);
    const minutesInput = timerDiv.querySelector('input');
    const minutes = parseInt(minutesInput.value);
    const action = timerDiv.dataset.action || 'off';

    if (!minutes || minutes < 1) {
        debugLog('❌ Invalid timer value');
        return;
    }

    const endTime = Date.now() + (minutes * 60 * 1000);

    if (!multiTimers[switchId]) {
        multiTimers[switchId] = {};
    }

    multiTimers[switchId][timerId] = {
        endTime: endTime,
        action: action,
        deviceName: deviceName,
        timeout: setTimeout(() => {
            if (action === 'on') {
                if (!deviceStates[switchId]) toggleDevice(switchId, deviceName);
            } else {
                if (deviceStates[switchId]) toggleDevice(switchId, deviceName);
            }
            delete multiTimers[switchId][timerId];
            saveMultiTimers(); // Save after timer executes
            removeMultiTimer(timerId);
        }, minutes * 60 * 1000)
    };

    saveMultiTimers(); // Save new multi-timer
    debugLog(`⏰ Multi-timer: ${minutes}m to ${action.toUpperCase()} ${deviceName} (saved)`);
}

// Remove multiple timer with persistence
function removeMultiTimer(timerId) {
    const timerDiv = document.getElementById(`timer-${timerId}`);
    if (timerDiv) {
        timerDiv.remove();
    }

    Object.keys(multiTimers).forEach(switchId => {
        if (multiTimers[switchId] && multiTimers[switchId][timerId]) {
            clearTimeout(multiTimers[switchId][timerId].timeout);
            delete multiTimers[switchId][timerId];
        }
    });

    saveMultiTimers(); // Save updated multi-timers
}

// Add schedule with persistence
function addSchedule() {
    const container = document.getElementById('schedules-container');
    const scheduleId = Date.now();

    const scheduleDiv = document.createElement('div');
    scheduleDiv.className = 'glass-card rounded-lg p-4 fade-in';
    scheduleDiv.id = `schedule-${scheduleId}`;

    scheduleDiv.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center space-x-2">
                <input type="time" class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm flex-1">
                <select class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                    <option value="sw1">Fan</option>
                    <option value="sw3">Main Light</option>
                    <option value="sw4">Desk Light</option>
                </select>
            </div>
            <div class="flex items-center justify-between">
                <div class="timer-toggle" style="transform: scale(0.9);">
                    <div class="timer-option active" onclick="setScheduleAction(${scheduleId}, 'off')">OFF</div>
                    <div class="timer-option" onclick="setScheduleAction(${scheduleId}, 'on')">ON</div>
                </div>
                <label class="flex items-center space-x-1 text-sm">
                    <input type="checkbox" class="rounded">
                    <span>Daily</span>
                </label>
            </div>
            <div class="flex space-x-2">
                <button onclick="saveSchedule(${scheduleId})" 
                        class="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">Save</button>
                <button onclick="removeSchedule(${scheduleId})" 
                        class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">×</button>
            </div>
        </div>
    `;

    container.appendChild(scheduleDiv);
    scheduleDiv.dataset.action = 'off';
}

// Restore schedule UI from saved data
function restoreScheduleUI(schedule) {
    const container = document.getElementById('schedules-container');
    const scheduleDiv = document.createElement('div');
    scheduleDiv.className = 'glass-card rounded-lg p-4';
    scheduleDiv.id = `schedule-${schedule.id}`;

    scheduleDiv.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center space-x-2">
                <input type="time" value="${schedule.time}" class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm flex-1">
                <select class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                    <option value="sw1" ${schedule.device === 'sw1' ? 'selected' : ''}>Fan</option>
                    <option value="sw3" ${schedule.device === 'sw3' ? 'selected' : ''}>Main Light</option>
                    <option value="sw4" ${schedule.device === 'sw4' ? 'selected' : ''}>Desk Light</option>
                </select>
            </div>
            <div class="flex items-center justify-between">
                <div class="timer-toggle" style="transform: scale(0.9);">
                    <div class="timer-option ${schedule.action === 'off' ? 'active' : ''}" onclick="setScheduleAction(${schedule.id}, 'off')">OFF</div>
                    <div class="timer-option ${schedule.action === 'on' ? 'active' : ''}" onclick="setScheduleAction(${schedule.id}, 'on')">ON</div>
                </div>
                <label class="flex items-center space-x-1 text-sm">
                    <input type="checkbox" class="rounded" ${schedule.repeat ? 'checked' : ''}>
                    <span>Daily</span>
                </label>
            </div>
            <div class="flex space-x-2">
                <button onclick="saveSchedule(${schedule.id})" 
                        class="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">Update</button>
                <button onclick="removeSchedule(${schedule.id})" 
                        class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">×</button>
            </div>
        </div>
    `;

    container.appendChild(scheduleDiv);
    scheduleDiv.dataset.action = schedule.action;
}

// Set schedule action
function setScheduleAction(scheduleId, action) {
    const scheduleDiv = document.getElementById(`schedule-${scheduleId}`);
    const toggle = scheduleDiv.querySelector('.timer-toggle');
    const options = toggle.querySelectorAll('.timer-option');

    options.forEach(option => {
        option.classList.remove('active');
        if (option.textContent.toLowerCase() === action) {
            option.classList.add('active');
        }
    });

    scheduleDiv.dataset.action = action;
}

// Save schedule with persistence
function saveSchedule(scheduleId) {
    const scheduleDiv = document.getElementById(`schedule-${scheduleId}`);
    const timeInput = scheduleDiv.querySelector('input[type="time"]');
    const deviceSelect = scheduleDiv.querySelector('select');
    const repeatCheckbox = scheduleDiv.querySelector('input[type="checkbox"]');
    const action = scheduleDiv.dataset.action || 'off';

    if (!timeInput.value) {
        debugLog('❌ Please set a time for the schedule');
        return;
    }

    const schedule = {
        id: scheduleId,
        time: timeInput.value,
        device: deviceSelect.value,
        action: action,
        repeat: repeatCheckbox.checked
    };

    // Update or add schedule
    const existingIndex = schedules.findIndex(s => s.id === scheduleId);
    if (existingIndex >= 0) {
        schedules[existingIndex] = schedule;
    } else {
        schedules.push(schedule);
    }

    saveSchedules(); // Save to storage
    setupSchedule(schedule);

    debugLog(`📅 Schedule saved: ${schedule.time} - ${schedule.action.toUpperCase()} ${schedule.device}`);

    scheduleDiv.style.border = '1px solid #10b981';
    setTimeout(() => {
        scheduleDiv.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    }, 2000);
}

// Setup schedule execution
function setupSchedule(schedule) {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':');
    const scheduleTime = new Date();
    scheduleTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    if (scheduleTime <= now) {
        scheduleTime.setDate(scheduleTime.getDate() + 1);
    }

    const delay = scheduleTime.getTime() - now.getTime();

    setTimeout(() => {
        const deviceName = getDeviceName(schedule.device);
        if (schedule.action === 'on') {
            if (!deviceStates[schedule.device]) toggleDevice(schedule.device, deviceName);
        } else {
            if (deviceStates[schedule.device]) toggleDevice(schedule.device, deviceName);
        }

        debugLog(`📅 Schedule executed: ${schedule.action.toUpperCase()} ${schedule.device}`);

        if (schedule.repeat) {
            setupSchedule(schedule);
        }
    }, delay);
}

// Remove schedule with persistence
function removeSchedule(scheduleId) {
    const scheduleDiv = document.getElementById(`schedule-${scheduleId}`);
    if (scheduleDiv) {
        scheduleDiv.remove();
    }

    schedules = schedules.filter(s => s.id !== scheduleId);
    saveSchedules(); // Save updated schedules
}

// Toggle debug panel
function toggleDebug() {
    const panel = document.getElementById('debug-panel');
    const arrow = document.getElementById('debug-arrow');

    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';
    } else {
        panel.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

// Start countdown updater with slider position updates
function startCountdownUpdater() {
    countdownInterval = setInterval(() => {
        // Update quick timer countdowns
        Object.keys(quickTimers).forEach(switchId => {
            const timer = quickTimers[switchId];
            const remaining = Math.max(0, timer.endTime - Date.now());
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);

            if (remaining > 0) {
                const display = document.getElementById(`${timer.deviceName}-timer-countdown`);
                if (display) {
                    display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} → ${timer.action.toUpperCase()}`;
                }

                // Update slider position to show remaining time (decreasing)
                const slider = document.getElementById(`${timer.deviceName}-timer-slider`);
                if (slider) {
                    const remainingMinutes = Math.ceil(remaining / 60000);
                    slider.value = remainingMinutes;
                    updateQuickTimerDisplay(timer.deviceName, remainingMinutes);
                }
            } else {
                // Timer finished - reset slider to 0
                const slider = document.getElementById(`${timer.deviceName}-timer-slider`);
                if (slider) {
                    slider.value = 0;
                    updateQuickTimerDisplay(timer.deviceName, 0);
                }
            }
        });

        // Update multi-timer countdowns
        Object.keys(multiTimers).forEach(switchId => {
            Object.keys(multiTimers[switchId]).forEach(timerId => {
                const timer = multiTimers[switchId][timerId];
                const remaining = Math.max(0, timer.endTime - Date.now());
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);

                if (remaining > 0) {
                    const display = document.getElementById(`countdown-${timerId}`);
                    if (display) {
                        display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    }
                }
            });
        });

        // Save timers periodically (every 30 seconds) to keep them updated with remaining time
        if (Date.now() % 30000 < 1000) {
            if (Object.keys(quickTimers).length > 0) saveQuickTimers();
            if (Object.keys(multiTimers).length > 0) saveMultiTimers();
        }
    }, 1000);
}

// Debug logging
function debugLog(message) {
    const debugElement = document.getElementById('debug-log');
    const timestamp = new Date().toLocaleTimeString();
    debugElement.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    debugElement.scrollTop = debugElement.scrollHeight;
    console.log(message);
}

// Add clear storage button for debugging (can be removed in production)
window.clearStorage = function () {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    debugLog('🗑️ Cleared all saved data');
    location.reload();
};