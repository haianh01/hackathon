# Quick Reference - Bomberman Bot Flow

## 🚀 Startup Sequence

```mermaid
sequenceDiagram
    participant Main as index.ts
    participant Bot as BombermanBot
    participant AI as BombermanAI
    participant Engine as GameEngine
    participant Socket as SocketConnection
    participant Server as Game Server

    Main->>Bot: new BombermanBot(server, token)
    Bot->>AI: new BombermanAI()
    Bot->>Engine: new GameEngine()
    Bot->>Socket: new SocketConnection(server, token)
    
    Note over Socket: Detect environment<br/>Dev: isGameStarted = true<br/>Comp: isGameStarted = false
    
    Main->>Bot: initialize()
    Bot->>Socket: connect()
    Socket->>Server: io.connect(server, {auth: {token}})
    Server-->>Socket: 'connect' event
    Socket->>Server: emit('join', {})
    
    Server-->>Socket: 'user' event (game data)
    Socket->>Socket: Find myBomberInfo
    Socket->>Socket: Update lastConfirmedPosition
    Socket-->>Bot: onGameDataCallback(data)
    Bot->>Engine: updateGameState(data, socketId)
    
    Note over Bot: Start bot logic loop<br/>500ms interval
```

## 🔄 Game Loop

```mermaid
flowchart TB
    Start([Bot Logic Loop<br/>Every 500ms]) --> Check{isGameRunning<br/>&&<br/>isRunning?}
    Check -->|No| Wait[Wait next cycle]
    Check -->|Yes| GetState[Get Game State<br/>from GameEngine]
    
    GetState --> LogState[Log game state<br/>bot, enemies, bombs, items]
    LogState --> AIDecision[AI.makeDecision<br/>gameState]
    
    AIDecision --> LogDecision[Log AI decision]
    LogDecision --> Execute{Execute Action}
    
    Execute -->|MOVE| StartMove[startContinuousMove<br/>direction]
    Execute -->|BOMB| PlaceBomb[stopContinuousMove<br/>+ placeBomb]
    Execute -->|STOP| StopMove[stopContinuousMove]
    
    StartMove --> CheckDirection{Same direction?}
    CheckDirection -->|Yes| Skip[Skip - already moving]
    CheckDirection -->|No| StopOld[Stop old move]
    StopOld --> SendMove[Emit 'move' immediately]
    SendMove --> CreateInterval[Create 50ms interval]
    CreateInterval --> LoopSend[Send 'move' every 50ms<br/>Update predictedPosition]
    
    PlaceBomb --> EmitBomb[Emit 'place_bomb']
    StopMove --> ClearInterval[Clear interval<br/>Reset currentDirection]
    
    Skip --> Wait
    LoopSend --> Wait
    EmitBomb --> Wait
    ClearInterval --> Wait
    
    Wait --> Start

    style Start fill:#e1f5e1
    style AIDecision fill:#e3f2fd
    style Execute fill:#fff3e0
    style StartMove fill:#f3e5f5
    style PlaceBomb fill:#ffebee
```

## 📡 Event Handling

```mermaid
flowchart LR
    Server[Game Server] -->|user| UpdateState[Update Game State<br/>myBomberInfo<br/>lastConfirmedPosition]
    Server -->|start| SetStarted[isGameStarted = true<br/>Competition mode only]
    Server -->|finish| SetFinish[Dev: auto reset<br/>Comp: stop]
    Server -->|player_move| UpdatePos[Update Position<br/>if my bot<br/>Confirm position]
    Server -->|new_bomb| AddBomb[Callback: onNewBomb<br/>Add to danger zones]
    Server -->|bomb_explode| RemoveBomb[Callback: onBombExplode<br/>Remove from dangers]
    Server -->|user_die_update| CheckDeath{My bot died?}
    
    CheckDeath -->|Yes| StopBot[isRunning = false]
    CheckDeath -->|No| CheckKill{My bot killed?}
    CheckKill -->|Yes| LogKill[Log kill + score]
    CheckKill -->|No| LogOther[Log other death]
    
    UpdateState --> ProcessData[processGameData]
    ProcessData --> GameEngine[gameEngine.updateGameState]
    
    UpdatePos --> Notify[onPositionUpdateCallback<br/>x, y]
    
    style Server fill:#e1f5e1
    style CheckDeath fill:#ffebee
    style CheckKill fill:#fff3e0
```

## 🎯 Continuous Movement

```mermaid
stateDiagram-v2
    [*] --> Idle: Initialize
    Idle --> Moving: startContinuousMove(direction)
    
    Moving --> CheckSame: New move command
    CheckSame --> Moving: Same direction (skip)
    CheckSame --> Stopping: Different direction
    
    Stopping --> Moving: Start new direction
    Moving --> Stopped: stopContinuousMove()
    
    Stopped --> Idle
    
    Moving --> Moving: Send every 50ms
    
    note right of Moving
        • Emit 'move' event
        • Update predictedPosition
        • Track currentDirection
    end note
    
    note right of Stopped
        • Clear interval
        • Reset currentDirection
    end note
```

## 📍 Position Tracking

```mermaid
flowchart TB
    Start([Position Query]) --> Check{Get Current Position}
    
    Check --> HasConfirmed{lastConfirmedPosition<br/>exists?}
    HasConfirmed -->|Yes| ReturnConfirmed[Return confirmed<br/>from server]
    HasConfirmed -->|No| HasBomber{myBomberInfo<br/>exists?}
    
    HasBomber -->|Yes| ReturnBomber[Return from<br/>myBomberInfo x, y]
    HasBomber -->|No| ReturnNull[Return null]
    
    SendMove[Send Move Command] --> Predict[predictNextPosition<br/>current, direction]
    Predict --> StorePredicted[Store in<br/>predictedPosition]
    
    ReceiveEvent[Receive player_move] --> IsMyBot{uid == socketId?}
    IsMyBot -->|Yes| UpdateConfirmed[Update<br/>lastConfirmedPosition]
    IsMyBot -->|No| Ignore[Ignore]
    
    UpdateConfirmed --> UpdateBomber[Update myBomberInfo<br/>x, y]
    UpdateBomber --> CallCallback[Call onPositionUpdate<br/>callback]
    
    style ReturnConfirmed fill:#e1f5e1
    style ReturnBomber fill:#fff3e0
    style ReturnNull fill:#ffebee
```

## ⚙️ Key States

### isGameStarted
```
Dev Mode:     true  (from constructor)
Competition:  false → true (after 'start' event)
```

### isRunning
```
After initialize():     true
After bot death:        false
After shutdown():       false
```

### isConnected
```
Socket connected:       true
Socket disconnected:    false
```

### Bot can act when:
```
isGameStarted = true
AND
isRunning = true
AND
socket != null
```

## 🔍 Debug Commands

```typescript
// Status checks
bot.isConnected()              // Socket status
bot.isGameRunning()            // = isGameStarted
bot.isActive()                 // isRunning && isConnected()

// Position
bot.socketConnection.getCurrentPosition()     // Current pos
bot.socketConnection.predictedPosition        // Predicted next
bot.socketConnection.lastConfirmedPosition    // Server confirmed

// Movement
bot.socketConnection.currentDirection         // Current direction or null
bot.socketConnection.moveInterval             // Interval ID or null

// Info
bot.getBotInfo()              // Full bomber info
bot.getGameStats()            // Game statistics
bot.getGameState()            // Full game state

// AI
bot.getAIInfo()               // Strategy info with priorities
bot.updateStrategyPriority(name, priority)
bot.resetAI()                 // Reset to defaults
```

## 📊 Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Bot Logic Loop | 500ms | Decision making frequency |
| Movement Send | 50ms | Continuous move frequency (20/sec) |
| Position Update | Realtime | Via player_move event |
| AI Strategy Count | 7 | Prioritized strategies |
| Event Listeners | 11 | All game events covered |

## 🎯 Priority Order

1. **Escape** (100) - Highest priority
2. **Attack** (80)
3. **Defense** (70)
4. **Collect** (60)
5. **Wall Break** (50)
6. **Explore** (40)
7. **Smart Nav** (30) - Lowest priority

## 📝 Event Summary

### Send to Server
- `join` - Join game room
- `move` - Move bot (continuous 50ms)
- `place_bomb` - Place bomb

### Receive from Server
- `user` - Initial game state
- `start` - Game start (competition)
- `finish` - Game end
- `player_move` - Position update
- `new_bomb` - Bomb placed
- `bomb_explode` - Bomb exploded
- `user_die_update` - Player death
- `chest_destroyed` - Chest broken
- `item_collected` - Item picked up
- `map_update` - Map changed
- `user_disconnect` - Player left
