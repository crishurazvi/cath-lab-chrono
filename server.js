const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Servim fisierele statice din folderul "public"
app.use(express.static(path.join(__dirname, 'public')));

// Fisier pentru persistenta datelor
const DATA_FILE = path.join(__dirname, 'cathlab_data.json');

// Starea globala a aplicatiei
let appState = {
    devices: [],
    events: [],
    liveTimer: {
        isRunning: false,
        startTime: null,
        artery: "",
        device: ""
    }
};

// Incarcam datele la pornirea serverului
if (fs.existsSync(DATA_FILE)) {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        appState.devices = parsed.devices || [];
        appState.events = parsed.events || [];
    } catch (e) {
        console.error("Eroare la citirea bazei de date:", e);
    }
}

// Functie de salvare
function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        devices: appState.devices,
        events: appState.events
    }, null, 2));
}

io.on('connection', (socket) => {
    console.log(`Client conectat: ${socket.id}`);

    // Trimitem starea actuala imediat ce cineva se conecteaza
    socket.emit('sync_state', appState);

    // Adaugare dispozitiv
    socket.on('add_device', (device) => {
        const label = `${device.type} ${device.diameter} × ${device.length} mm`;
        if (!appState.devices.some(d => `${d.type} ${d.diameter} × ${d.length} mm` === label)) {
            appState.devices.unshift(device);
            saveData();
            io.emit('sync_state', appState);
        }
    });

    // Actiuni Cronometru
    socket.on('start_timer', (data) => {
        appState.liveTimer = {
            isRunning: true,
            startTime: data.startTime, // Timestamp trimis de client pt sincronizare perfecta
            artery: data.artery,
            device: data.device
        };
        io.emit('timer_started', appState.liveTimer);
    });

    socket.on('stop_timer', () => {
        appState.liveTimer.isRunning = false;
        io.emit('timer_stopped');
    });

    // Salvare Presiune / Eveniment
    socket.on('save_event', (event) => {
        appState.events.unshift(event);
        saveData();
        io.emit('sync_state', appState);
    });

    // Stergere istoric
    socket.on('clear_history', () => {
        appState.events = [];
        saveData();
        io.emit('sync_state', appState);
    });

    socket.on('disconnect', () => {
        console.log(`Client deconectat: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server CathLab ruland pe portul ${PORT}`);
});
