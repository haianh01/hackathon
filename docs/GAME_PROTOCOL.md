# Bomberman Hackathon 2025 - Game Protocol Documentation

This document outlines the rules, server events, and data structures for the Bomberman Hackathon.

---

## 1. Game Overview

The game is a classic Bomberman-style battle. Bots navigate a grid, place bombs to destroy chests and eliminate opponents, and collect items to enhance their abilities.

### Game Environments

There are two distinct environments, each with different rules:

| Feature |  môi trường luyện tập (Practice) | môi trường thi đấu (Competition) |
| :--- | :--- | :--- |
| **Game Start** | Game is always active. Join and play immediately. | Bot must wait for a `start` event before moving. |
| **Bot Death** | **Respawn**: Bot is revived after being eliminated. | **Permadeath**: Bot is eliminated for the rest of the match. |
| **Game End** | Resets every 5 minutes. | Ends when 1 bot remains or after 5 minutes. |

**Crucial Note**: The final code submitted to the organizers **must** be configured for the **Competition Environment**.

---

## 2. Core Concepts

### Coordinate System & Grid
- The game uses a pixel-based coordinate system for bot movement.
- However, all game logic (bombs, chests, walls) operates on a **40x40 pixel grid**.
- **Bomb Placement**: When a bot places a bomb, the server automatically **centers the bomb within the 40x40 grid cell** the bot is currently in. For example, if the bot is at `(83, 125)`, the bomb will be placed at the center of the `(80, 120)` cell.
- **Explosion Pattern**: Bombs explode in a **cross shape (+)** along the grid's rows and columns.
- **Key Takeaway**: Your bot does not need to be perfectly centered to place a bomb effectively. As long as it is within a grid cell, the bomb will be placed correctly. However, aligning the bot can help in predicting movement and escape routes more accurately.

### Items
Items are dropped when chests are destroyed. They provide power-ups to the bot that collects them.
- **`BOMB_COUNT` (B)**: Increases the maximum number of bombs the bot can place simultaneously.
- **`EXPLOSION_RANGE` (R)**: Increases the blast radius of the bot's bombs.
- **`SPEED` (S)**: Increases the bot's movement speed.

---

## 3. Connection & Game Flow

The typical lifecycle of a bot is as follows:

1.  **Connect**: Establish a WebSocket connection to the server using the provided `SOCKET_SERVER` address and `TOKEN`.
2.  **Join**: Emit the `join` event to enter a game room.
3.  **Receive State**: The server sends the `user` event with the initial game state (map, players, objects).
4.  **Wait for Start (Competition Mode)**: If in the competition environment, wait for the `start` event. Do not perform any actions before this.
5.  **Play**: React to server events and send actions (`move`, `place_bomb`).
6.  **Game End**: The game ends when the server sends the `finish` event.

---

## 4. API Reference - Bot to Server (Actions)

These are the events your bot sends to the server.

### Authentication
- **Description**: Authenticate and connect to the server. This is handled during the initial `io()` connection.
- **Example (JS)**:
  ```javascript
  const socket = io(SOCKET_SERVER_ADDR, {
    auth: { token: YOUR_TOKEN }
  });
  ```

### Join Game
- **Description**: Register to participate in a game room after connecting.
- **Event Name**: `join`
- **Data**: `{}` (empty object)

### Move
- **Description**: Move the bot one step in a given direction. For continuous movement, this event must be sent repeatedly. The server tickrate is **17ms** (~59 ticks/s), so sending move commands faster than this is inefficient.
- **Event Name**: `move`
- **Data**:
  ```json
  {
    "orient": "UP" // UP, DOWN, LEFT, or RIGHT
  }
  ```

### Place Bomb
- **Description**: Place a bomb at the bot's current grid-aligned position.
- **Event Name**: `place_bomb`
- **Data**: `{}` (empty object)

---

## 5. API Reference - Server to Bot (Events)

These are the events your bot listens for from the server.

### Game State Events

#### `user`
- **Description**: Sent once after a successful `join`. Provides the **complete initial state** of the game world.
- **Response Data**: See [Data Models](#6-data-models) for the structure of `map`, `bombers`, `bombs`, `chests`, and `items`.

#### `start`
- **Description**: Signals the official start of a match in the **Competition Environment**. Bots should only begin moving and acting after receiving this event.
- **Response Data**: `{ "start_at": "2025-10-08T06:47:50.731Z" }`

#### `finish`
- **Description**: Signals the end of a match in the **Competition Environment**.
- **Response Data**: `{}`

#### `map_update`
- **Description**: Sent after a bomb explodes. Provides the updated lists of active `chests` and `items` on the map. Use this to refresh your game state.
- **Response Data**: `{ "chests": [...], "items": [...] }`

### Player & Object Events

#### `player_move`
- **Description**: Broadcast when any player (including your bot) moves. This is the most reliable source for a bot's real-time position.
- **Response Data**: A `Bomber` object. (See [Data Models](#6-data-models))

#### `new_bomb`
- **Description**: Broadcast when a player places a bomb.
- **Response Data**: A `Bomb` object.

#### `bomb_explode`
- **Description**: Broadcast when a bomb detonates.
- **Response Data**: `{ "x": 160, "y": 160, "id": 4708, "explosionArea": [...] }`

#### `chest_destroyed`
- **Description**: Sent when a chest is destroyed. The `item` field will be non-null if an item was spawned.
- **Response Data**: `{ "x": 160, "y": 160, "item": { "type": "SPEED", ... } | null }`

#### `item_collected`
- **Description**: Sent when a bot collects an item. The `bomber` field contains the updated state of the bot that collected it.
- **Response Data**: `{ "bomber": <Bomber Object>, "item": <Item Object> }`

#### `user_die_update`
- **Description**: Sent when a bot is eliminated.
- **Response Data**: `{ "killer": <Bomber Object>, "killed": <Bomber Object>, ... }`

#### `new_enemy`
- **Description**: Sent to all existing players when a new player joins the room.
- **Response Data**: `{ "bomber": <Bomber Object> }`

#### `user_disconnect`
- **Description**: Sent when a player disconnects.
- **Response Data**: `{ "uid": "...", "bomber": <Bomber Object> }`

---

## 6. Data Models

### Bomber Object
Represents a player in the game.

| Key | Type | Description |
| :--- | :--- | :--- |
| `uid` | string | Unique ID of the bot. |
| `name` | string | Name of the bot. |
| `x` | number | Current X-coordinate (in pixels). |
| `y` | number | Current Y-coordinate (in pixels). |
| `isAlive` | boolean | `true` if the bot is alive. |
| `bombCount` | number | Current number of bombs the bot can place. |
| `explosionRange`| number | The flame radius of the bot's bombs (in grid cells). |
| `speed` | number | Movement speed multiplier. |
| `score` | number | Current score. |

### Bomb Object
| Key | Type | Description |
| :--- | :--- | :--- |
| `id` | number | Unique ID of the bomb. |
| `uid` | string | UID of the bot that placed the bomb. |
| `x` | number | X-coordinate of the bomb. |
| `y` | number | Y-coordinate of the bomb. |
| `lifeTime` | number | Time in milliseconds until explosion. |

### Item Object
| Key | Type | Description |
| :--- | :--- | :--- |
| `type` | string | Type of item: `SPEED`, `EXPLOSION_RANGE`, `BOMB_COUNT`. |
| `x` | number | X-coordinate of the item. |
| `y` | number | Y-coordinate of the item. |

### Map Data
The `map` is a 2D array where each element represents a 40x40 pixel cell.
-   `"W"`: An indestructible wall.
-   `"C"`: A destructible chest.
-   `null`: An empty, walkable space.
