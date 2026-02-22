const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// Health check route (useful for Railway to confirm the server is alive)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

/**
 * Room map: { roomId: [socketId1, socketId2] }
 * When two players are in the same room, we relay WebRTC signaling between them.
 */
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`[+] Socket connected: ${socket.id}`);

    /**
     * join-room: Player wants to join a specific game room.
     * If 2 players are now in the room, notify both that they can start WebRTC.
     */
    socket.on('join-room', (roomId) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, []);
        }
        const roomPeers = rooms.get(roomId);
        roomPeers.push(socket.id);
        rooms.set(roomId, roomPeers);

        console.log(`[~] ${socket.id} joined room ${roomId} (${roomPeers.length}/2 peers)`);

        if (roomPeers.length === 2) {
            // Both players are here — tell the first player (initiator) to start the WebRTC offer
            io.to(roomPeers[0]).emit('initiate-call', { initiator: true, roomId });
            io.to(roomPeers[1]).emit('initiate-call', { initiator: false, roomId });
            console.log(`[✓] Room ${roomId} is full — signaling start`);
        }
    });

    /**
     * signal: Relay WebRTC offer/answer/ICE candidate to the other peer in the room.
     */
    socket.on('signal', ({ roomId, signal }) => {
        const roomPeers = rooms.get(roomId) || [];
        const otherPeer = roomPeers.find(id => id !== socket.id);
        if (otherPeer) {
            io.to(otherPeer).emit('signal', { signal, from: socket.id });
        }
    });

    /**
     * Cleanup when a socket disconnects
     */
    socket.on('disconnect', () => {
        rooms.forEach((peers, roomId) => {
            const idx = peers.indexOf(socket.id);
            if (idx !== -1) {
                peers.splice(idx, 1);
                // Notify the remaining player
                peers.forEach(peerId => io.to(peerId).emit('peer-disconnected'));
                if (peers.length === 0) rooms.delete(roomId);
                console.log(`[-] ${socket.id} left room ${roomId}`);
            }
        });
        console.log(`[-] Socket disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🔗 Signaling server running on port ${PORT}`);
});
