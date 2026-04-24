require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { Server } = require('socket.io');

const authRouter    = require('./routes/auth');
const moviesRouter  = require('./routes/movies');
const rentalsRouter = require('./routes/rentals');
const partiesRouter = require('./routes/parties');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/auth',    authRouter);
app.use('/api/movies',  moviesRouter);
app.use('/api/rentals', rentalsRouter);
app.use('/api/parties', partiesRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Socket.io Watch Party ───────────────────────────────────────
// Store party state in memory
const partyRooms = {};

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Join a party room
  socket.on('join_party', ({ party_id, user_name }) => {
    const room = `party_${party_id}`;
    socket.join(room);
    socket.data.party_id = party_id;
    socket.data.user_name = user_name;

    // Init room state if needed
    if (!partyRooms[room]) {
      partyRooms[room] = { playing: false, timestamp: 0, members: [] };
    }

    // Add member
    if (!partyRooms[room].members.includes(user_name)) {
      partyRooms[room].members.push(user_name);
    }

    // Send current state to the new joiner
    socket.emit('party_state', partyRooms[room]);

    // Notify everyone else
    io.to(room).emit('member_joined', {
      user_name,
      members: partyRooms[room].members
    });

    console.log(`${user_name} joined party ${party_id}`);
  });

  // Host plays/pauses
  socket.on('play_pause', ({ party_id, playing, timestamp }) => {
    const room = `party_${party_id}`;
    if (partyRooms[room]) {
      partyRooms[room].playing = playing;
      partyRooms[room].timestamp = timestamp;
    }
    // Broadcast to everyone in the room including sender
    io.to(room).emit('play_pause', { playing, timestamp });
    console.log(`Party ${party_id}: ${playing ? 'playing' : 'paused'} at ${timestamp}s`);
  });

  // Seek
  socket.on('seek', ({ party_id, timestamp }) => {
    const room = `party_${party_id}`;
    if (partyRooms[room]) partyRooms[room].timestamp = timestamp;
    io.to(room).emit('seek', { timestamp });
  });

  // Chat message
  socket.on('chat_message', ({ party_id, user_name, message }) => {
    const room = `party_${party_id}`;
    const msg = { user_name, message, time: new Date().toLocaleTimeString() };
    io.to(room).emit('chat_message', msg);
  });

  // Leave
  socket.on('disconnect', () => {
    const { party_id, user_name } = socket.data;
    if (party_id && user_name) {
      const room = `party_${party_id}`;
      if (partyRooms[room]) {
        partyRooms[room].members = partyRooms[room].members.filter(m => m !== user_name);
        io.to(room).emit('member_left', {
          user_name,
          members: partyRooms[room].members
        });
      }
    }
    console.log('Socket disconnected:', socket.id);
  });
});

// ── Start ───────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🎬 Kinnect API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});
