// static/js/scripts.js

document.addEventListener('DOMContentLoaded', () => {
    // Establish a Socket.IO connection
    const socket = io();

    // Elements
    const systemStatus = document.getElementById('system-status');
    const transmissionStatus = document.getElementById('transmission-status');
    const receptionStatus = document.getElementById('reception-status');
    const udpListenerStatus = document.getElementById('udp-listener-status');
    const carrierStatus = document.getElementById('carrier-status');
    const wavGenerationStatus = document.getElementById('wav-generation-status');
    const systemError = document.getElementById('system-error');
    const restartReceptionBtn = document.getElementById('restart-reception');
    const configForm = document.getElementById('config-form');
    const saveConfigBtn = document.getElementById('save-config');
    const receivedMessages = document.getElementById('received-messages');

    // Define configParams globally to use in both populate and save functions
    const configParams = [
        { label: "Frequency (Hz)", key: "frequency_hz", type: "number" },
        { label: "Gain", key: "gain", type: "number" },
        { label: "IF Gain", key: "if_gain", type: "number" },
        { label: "Source Callsign", key: "callsign_source", type: "text" },
        { label: "Destination Callsign", key: "callsign_dest", type: "text" },
        { label: "Flags Before", key: "flags_before", type: "number" },
        { label: "Flags After", key: "flags_after", type: "number" },
        { label: "Send IP", key: "send_ip", type: "text" },
        { label: "Send Port", key: "send_port", type: "number" },
        { label: "Carrier Only", key: "carrier_only", type: "checkbox" },
        { label: "Device Index", key: "device_index", type: "number" },
    ];

    // Fetch and display configuration
    fetch('/api/config')
        .then(response => response.json())
        .then(config => {
            if (config.status === 'success') {
                console.log("Fetched Configuration:", config.config); // Debugging
                populateConfigForm(config.config);
            } else {
                console.error('Failed to fetch configuration:', config.message);
            }
        })
        .catch(error => console.error('Error fetching config:', error));

    // Populate the configuration form
    function populateConfigForm(config) {
        configParams.forEach(param => {
            const div = document.createElement('div');
            div.classList.add('form-group');

            const label = document.createElement('label');
            label.textContent = param.label + ":";
            label.htmlFor = param.key;
            div.appendChild(label);

            if (param.type === 'checkbox') {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = param.key;
                input.name = param.key;
                input.checked = Boolean(config[param.key]);
                div.appendChild(input);
            } else {
                const input = document.createElement('input');
                input.type = param.type;
                input.id = param.key;
                input.name = param.key;
                input.value = config[param.key];
                div.appendChild(input);
            }

            configForm.appendChild(div);
        });
    }

    // Save configuration
    saveConfigBtn.addEventListener('click', () => {
        const config = {};

        configParams.forEach(param => {
            const input = document.getElementById(param.key);
            if (param.type === 'checkbox') {
                config[param.key] = input.checked;
            } else if (param.type === 'number') {
                const value = input.value;
                config[param.key] = value === '' ? null : parseFloat(value);
            } else {
                config[param.key] = input.value.trim();
            }
        });

        console.log("Configuration to be sent:", config); // Debugging

        fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Configuration updated successfully.');
                // Optionally, refresh the page or fetch updated config
                location.reload();
            } else {
                alert('Error updating configuration: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error saving config:', error);
            alert('An error occurred while saving the configuration.');
        });
    });

    // Handle WebSocket messages for APRS messages
    socket.on('aprs_message', data => {
        receivedMessages.value += data.message + '\n';
        receivedMessages.scrollTop = receivedMessages.scrollHeight;

        // Optionally enforce maximum message limit
        const maxMessages = 1000;
        const messages = receivedMessages.value.split('\n');
        if (messages.length > maxMessages) {
            receivedMessages.value = messages.slice(messages.length - maxMessages).join('\n');
        }
    });

    // Handle status updates
    socket.on('transmission_status', data => {
        if (data.status === 'active') {
            transmissionStatus.textContent = 'Transmission: Active';
            transmissionStatus.style.color = 'red';
        } else {
            transmissionStatus.textContent = 'Transmission: Idle';
            transmissionStatus.style.color = 'green';
        }
    });

    socket.on('reception_status', data => {
        if (data.status === 'active') {
            receptionStatus.textContent = 'Reception: Active';
            receptionStatus.style.color = 'blue';
        } else if (data.status === 'stopped') {
            receptionStatus.textContent = 'Reception: Stopped';
            receptionStatus.style.color = 'gray';
        } else {
            receptionStatus.textContent = 'Reception: Idle';
            receptionStatus.style.color = 'green';
        }
    });

    socket.on('udp_listener_status', data => {
        if (data.status === 'active') {
            udpListenerStatus.textContent = 'UDP Listener: Active';
            udpListenerStatus.style.color = 'orange';
        } else if (data.status === 'stopped') {
            udpListenerStatus.textContent = 'UDP Listener: Stopped';
            udpListenerStatus.style.color = 'gray';
        } else {
            udpListenerStatus.textContent = 'UDP Listener: Idle';
            udpListenerStatus.style.color = 'green';
        }
    });

    socket.on('carrier_status', data => {
        if (data.status === 'active') {
            carrierStatus.textContent = 'Carrier Transmission: Active';
            carrierStatus.style.color = 'purple';
        } else if (data.status === 'stopped') {
            carrierStatus.textContent = 'Carrier Transmission: Stopped';
            carrierStatus.style.color = 'gray';
        } else {
            carrierStatus.textContent = 'Carrier Transmission: Idle';
            carrierStatus.style.color = 'green';
        }
    });

    socket.on('wav_generation', data => {
        if (data.status === 'completed') {
            wavGenerationStatus.textContent = 'WAV Generation: Completed';
            wavGenerationStatus.style.color = 'green';
            console.log('WAV generation completed successfully.');
        } else if (data.status === 'started') {
            wavGenerationStatus.textContent = 'WAV Generation: In Progress';
            wavGenerationStatus.style.color = 'blue';
            console.log('WAV generation started.');
        }
    });

    socket.on('system_error', data => {
        systemError.textContent = 'System Error: ' + data.message;
        systemError.style.display = 'block';
        systemError.style.color = 'red';
        console.error('System Error:', data.message);
    });

    socket.on('system_status', data => {
        systemStatus.textContent = 'System Status: ' + data.status;
        if (data.status === 'running') {
            systemStatus.style.color = 'green';
        } else {
            systemStatus.style.color = 'gray';
        }
        console.log('System Status:', data.status);
    });

    // Handle backend restarted event
    socket.on('backend_restarted', data => {
        alert(data.message);
    });

// Example additions to static/js/scripts.js

// Handle system shutdown initiation and completion
socket.on('system_shutdown', data => {
    if (data.status === 'initiating') {
        alert('System is shutting down...');
        // Optionally, disable form inputs and buttons
    } else if (data.status === 'in_progress') {
        console.log('Shutdown in progress...');
        // Update UI to reflect shutdown progress
    } else if (data.status === 'completed') {
        alert('System shutdown completed.');
        // Optionally, redirect to a different page or update UI elements
    }
});

// Handle APRS queue setup
socket.on('aprs_queue_set', data => {
    if (data.status === 'set') {
        console.log('APRS message queue has been set.');
        // Optionally, update UI to reflect queue setup
    }
});

// Handle carrier-only mode changes
socket.on('carrier_only_mode', data => {
    if (data.status === 'enabled') {
        alert('Carrier-only mode has been enabled.');
        // Update UI elements to reflect this mode
    } else if (data.status === 'disabled') {
        alert('Carrier-only mode has been disabled.');
        // Revert UI elements back to normal mode
    }
});

// Handle configuration applied successfully
socket.on('config_applied', data => {
    if (data.status === 'success') {
        alert('Configuration has been successfully applied.');
        // Update UI elements or perform actions based on new config
    }
});

// Handle specific configuration updates
socket.on('frequency_updated', data => {
    console.log(`Frequency updated to ${data.frequency_hz} Hz.`);
    // Update frequency display in UI
});

socket.on('device_index_updated', data => {
    console.log(`Device index updated to ${data.device_index}.`);
    // Update device index display in UI
});

socket.on('udp_listener_config_updated', data => {
    console.log(`UDP Listener updated: IP=${data.send_ip}, Port=${data.send_port}`);
    // Update UDP Listener configuration display in UI
});

socket.on('gain_updated', data => {
    console.log(`Gain updated to ${data.gain}.`);
    // Update gain display in UI
});

socket.on('if_gain_updated', data => {
    console.log(`IF Gain updated to ${data.if_gain}.`);
    // Update IF Gain display in UI
});

socket.on('carrier_only_updated', data => {
    console.log(`Carrier Only setting updated to ${data.carrier_only}.`);
    // Update carrier-only setting in UI
});

socket.on('other_config_updated', data => {
    console.log('Other configuration parameters updated:', data.updated_params);
    // Update corresponding UI elements
});

// Handle system errors
socket.on('system_error', data => {
    systemError.textContent = 'System Error: ' + data.message;
    systemError.style.display = 'block';
    systemError.style.color = 'red';
    console.error('System Error:', data.message);
    // Optionally, notify the user or take corrective actions
});


    // Handle restart reception button
    restartReceptionBtn.addEventListener('click', () => {
        fetch('/api/restart_reception', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Reception restarted successfully.');
            } else {
                alert('Error restarting reception: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error restarting reception:', error);
            alert('An error occurred while restarting reception.');
        });
    });
});
