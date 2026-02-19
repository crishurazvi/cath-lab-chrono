const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'cathlab_data.json');

// Starea aplicatiei
let appState = {
    devices: [],
    events: [],
    finalMetrics: null,
    liveTimer: { isRunning: false, startTime: null, artery: "", device: "" }
};

// Incarcare date la pornire
if (fs.existsSync(DATA_FILE)) {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        appState.devices = parsed.devices || [];
        appState.events = parsed.events || [];
        appState.finalMetrics = parsed.finalMetrics || null;
    } catch (e) { console.error("Eroare citire date:", e); }
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        devices: appState.devices,
        events: appState.events,
        finalMetrics: appState.finalMetrics
    }, null, 2));
}

io.on('connection', (socket) => {
    // La conectare, trimitem starea actuala imediat
    socket.emit('sync_state', appState);

    socket.on('add_device', (device) => {
        appState.devices.unshift(device);
        saveData();
        io.emit('sync_state', appState);
    });

    socket.on('start_timer', (data) => {
        appState.liveTimer = { isRunning: true, startTime: data.startTime, artery: data.artery, device: data.device };
        io.emit('timer_started', appState.liveTimer);
    });

    socket.on('stop_timer', () => {
        appState.liveTimer.isRunning = false;
        io.emit('timer_stopped');
    });

    socket.on('save_event', (event) => {
        appState.events.unshift(event);
        saveData();
        io.emit('sync_state', appState);
    });

    socket.on('save_final_metrics', (metrics) => {
        appState.finalMetrics = metrics;
        saveData();
        io.emit('sync_state', appState);
    });

    socket.on('clear_history', () => {
        appState.events = [];
        appState.finalMetrics = null;
        saveData();
        io.emit('sync_state', appState);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`CathLab Server rulează pe portul ${PORT}`));
