<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Bomberman Bot - Hackathon 2025

## Project Overview

TypeScript Node.js project for Bomberman bot with Socket.IO integration, Jest testing, AI strategies, and continuous movement system.

## ✅ Completed Tasks

- [x] Verify that the copilot-instructions.md file in the .github directory is created
- [x] Scaffold the Project - TypeScript project structure for Bomberman bot
- [x] Customize the Project - Bot AI algorithms and game logic
- [x] Implement Socket.IO Integration - Real-time communication with game server
- [x] Implement Continuous Movement System - Smooth movement with 50ms intervals
- [x] Implement Position Tracking - Track and predict bot position
- [x] Implement Realtime Event Callbacks - React to game events immediately
- [x] Compile the Project - Build and test the project
- [x] Ensure Documentation is Complete - Comprehensive docs in /docs folder

## 🎯 Current Features

### Core Systems

- **Socket.IO Connection** - Authentication and real-time events
- **Continuous Movement** - Smooth movement at 20 times/second (50ms)
- **Position Tracking** - Track confirmed and predicted positions
- **Realtime Callbacks** - React to bombs, deaths, items instantly

### AI Strategies (Priority Order)

1. EscapeStrategy (100) - Escape from danger
2. AttackStrategy (80) - Attack enemies
3. DefensiveStrategy (70) - Defensive play
4. CollectStrategy (60) - Collect items
5. WallBreakerStrategy (50) - Break walls
6. ExploreStrategy (40) - Explore map
7. SmartNavigationStrategy (30) - Smart pathfinding

### Architecture

```
BombermanBot
├── BombermanAI (Decision Making)
├── GameEngine (State Management)
└── SocketConnection (Network + Movement)
    ├── Continuous Movement (50ms)
    ├── Position Tracking
    └── Realtime Event Handling
```

## 📚 Documentation

All documentation is in `/docs` folder:

- `CODE_FLOW.md` - Complete code flow with diagrams
- `RECENT_UPDATES.md` - Latest improvements (10/10/2025)
- `QUICK_REFERENCE.md` - Quick reference with diagrams
- `POSITION_TRACKING.md` - Position tracking system
- `MOVEMENT_GUIDE.md` - Movement system guide
- `BOMB_STRATEGY_FIX.md` - Bomb strategy
- `HACKATHON_DEV_DOC.md` - Development guide
- `README.md` - Documentation index

## 🔧 Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow existing patterns in codebase
- Add JSDoc comments for public methods
- Log important events with emojis for clarity

### Testing

- Jest for unit tests
- Test files in `src/__tests__/`
- Run: `npm test`

### Key Files

- `src/bombermanBot.ts` - Main bot class
- `src/connection/socketConnection.ts` - Socket.IO + Movement
- `src/ai/bombermanAI.ts` - AI decision engine
- `src/game/gameEngine.ts` - Game state management

### Important Patterns

#### Continuous Movement

```typescript
// Use startContinuousMove for smooth movement
this.socketConnection.startContinuousMove(direction);

// Stop when needed
this.socketConnection.stopContinuousMove();
```

#### Position Tracking

```typescript
// Get current position (confirmed by server)
const pos = this.socketConnection.getCurrentPosition();

// Check predicted position
const predicted = this.socketConnection.predictedPosition;
```

#### Realtime Events

```typescript
// Setup callbacks in setupRealtimeEventCallbacks()
this.socketConnection.onNewBomb((data) => {
  // Handle new bomb immediately
});
```

## 🚀 Running the Bot

```bash
# Development
npm run dev

# Production
npm run build
npm start

# With Docker
docker compose up bot
```

## 🔍 Debug Commands

```typescript
bot.isConnected(); // Socket status
bot.isGameRunning(); // Game running?
bot.isActive(); // Bot active?
bot.getBotInfo(); // Bot info
bot.getGameStats(); // Game stats
```

## ⚠️ Important Notes

### Environment Detection

- Dev mode: `isGameStarted = true` from start
- Competition: `isGameStarted = false` until 'start' event

### Movement System

- Use `startContinuousMove()` for smooth movement
- Sends move command every 50ms (20 times/sec)
- Auto-stops when changing direction or placing bomb

### Position System

- `lastConfirmedPosition` - confirmed by server (player_move event)
- `predictedPosition` - predicted next position
- `getCurrentPosition()` - returns confirmed position (preferred)

### Game Loop

- Bot logic runs every 500ms
- AI makes decision based on current game state
- Action executed via continuous movement or bomb placement

## 📝 When Adding Features

1. Update relevant documentation in `/docs`
2. Add to `RECENT_UPDATES.md` with date
3. Update `CODE_FLOW.md` if flow changes
4. Add unit tests in `src/__tests__/`
5. Follow existing patterns and conventions

## 🎯 Next Steps / TODO

See `RECENT_UPDATES.md` for current TODO list including:

- Realtime danger zone updates
- Collision detection with prediction
- Performance optimization
- Advanced AI improvements
