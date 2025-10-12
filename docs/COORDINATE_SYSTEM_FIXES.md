# Coordinate System Fixes - Unit Consistency Solutions

**Date:** October 12, 2025

## Summary

This document outlines the comprehensive fixes applied to resolve unit consistency issues throughout the Bomberman bot codebase. The main problems were inconsistent usage of pixels vs cell coordinates, inefficient pathfinding, and incorrect bounds checking.

## 🔧 Problems Fixed

### 1. Unit Inconsistency (pixels vs cells)
- **Problem**: Code sometimes used position.x/y as cell indices but other times as pixel coordinates
- **Impact**: `isValidPosition` compared position.x >= gameState.map.width incorrectly when position was in pixels
- **Solution**: Clear separation of coordinate systems with conversion functions

### 2. Bounds Checks
- **Problem**: `canEscapeFromBomb` and `Pathfinding.isValidPosition` used `gameState.map.width` without knowing if pixel or cell units
- **Impact**: False positives/negatives in pathfinding and escape detection
- **Solution**: Explicit pixel vs cell bounds checking functions

### 3. Pathfinding Performance
- **Problem**: A* used array with linear search for openSet → O(n²) complexity
- **Impact**: Slow pathfinding with many nodes
- **Solution**: MinHeap implementation for O(log n) operations

### 4. Heuristic Scale Mismatch
- **Problem**: Heuristic used Manhattan distance on positions but neighbor steps were inconsistent
- **Impact**: Suboptimal pathfinding behavior
- **Solution**: All pathfinding now operates on cell indices with consistent unit scale

### 5. Movement Calculations
- **Problem**: `pixelsPerMove = (speed || 1) * 1` was hardcoded and incorrect
- **Impact**: Wrong escape time calculations
- **Solution**: Proper calculation using `botSpeed * MOVE_STEP_SIZE`

## 🏗️ Architecture Changes

### New Files Created

#### `src/utils/coordinates.ts`
**Purpose**: Central coordinate system management

**Key Functions**:
- `pixelToCell(pos)` - Convert pixels to cell centers (for collision detection)
- `pixelToCellIndex(pos)` - Convert pixels to cell indices (for pathfinding)
- `cellIndexToPixel(cellIdx)` - Convert cell indices to pixel centers
- `isWithinPixelBounds()` - Bounds checking for pixel coordinates
- `isWithinCellBounds()` - Bounds checking for cell indices

**Constants**:
- `CELL_SIZE = 40` - Standard cell size in pixels
- `MOVE_STEP_SIZE = 3` - Server movement step size
- `MOVE_INTERVAL_MS = 200` - Movement interval

#### `src/utils/minHeap.ts`
**Purpose**: Efficient priority queue for A* pathfinding

**Features**:
- Generic MinHeap<T> implementation
- O(log n) insert/extract operations
- Support for priority updates
- Duplicate handling for pathfinding scenarios

### Modified Files

#### `src/utils/pathfinding.ts`
**Major Changes**:
- **Coordinate System**: All pathfinding now operates on cell indices internally
- **Performance**: Replaced linear search with MinHeap
- **Consistency**: Input/output in pixels, internal processing in cell indices
- **Escape Logic**: Fixed `canEscapeFromBomb` with proper time/movement calculations

**Before**:
```typescript
// Linear search in openSet (O(n²))
for (let i = 1; i < openSet.length; i++) {
  if (fScore.get(openSet[i]) < bestFScore) {
    current = openSet[i];
  }
}

// Inconsistent bounds check
if (position.x >= gameState.map.width) return false;
```

**After**:
```typescript
// MinHeap operations (O(log n))
const current = openSet.extractMin();

// Clear coordinate system
const cellIndex = pixelToCellIndex(position);
if (!isWithinCellBounds(cellIndex, mapWidth, mapHeight)) return false;
```

#### `src/utils/position.ts`
**Changes**:
- Updated default step sizes to use constants
- Clear documentation of coordinate expectations
- Consistent CELL_SIZE usage

#### `src/utils/gameLogic.ts`
**Changes**:
- Bounds checking uses `isWithinPixelBounds()` for consistency
- Clear pixel-based collision detection

## 📐 Coordinate System Rules

### 1. Game Map Dimensions
- `gameState.map.width/height` are in **PIXELS**
- Represents the total playable area size

### 2. Position Usage by Context

| Context | Coordinate Type | Example | Usage |
|---------|----------------|---------|--------|
| Bot positions | Pixels | `{x: 123, y: 87}` | Exact positioning, collision |
| Pathfinding internal | Cell indices | `{x: 2, y: 3}` | Grid navigation, A* algorithm |
| Pathfinding I/O | Pixels (cell centers) | `{x: 80, y: 120}` | Integration with game logic |
| Wall/Chest positions | Pixels (cell centers) | `{x: 40, y: 80}` | Obstacle detection |

### 3. Conversion Examples

```typescript
// Pixel position to cell center (for collision/logic)
const cellCenter = pixelToCell({x: 123, y: 87}); // {x: 120, y: 80}

// Pixel position to cell index (for pathfinding)
const cellIndex = pixelToCellIndex({x: 123, y: 87}); // {x: 3, y: 2}

// Cell index back to pixel center
const pixelCenter = cellIndexToPixel({x: 3, y: 2}); // {x: 120, y: 80}
```

## 🔍 Testing

### New Test Files
- `src/__tests__/coordinates.test.ts` - Coordinate conversion functions
- `src/__tests__/minHeap.test.ts` - MinHeap implementation

### Test Coverage
- ✅ Coordinate conversions (pixel ↔ cell)
- ✅ Bounds checking (pixel & cell)
- ✅ MinHeap performance and correctness
- ✅ Pathfinding with new coordinate system
- ✅ Edge cases and error handling

## ⚡ Performance Improvements

### Pathfinding Optimization
**Before**: O(n²) with linear openSet search
**After**: O(n log n) with MinHeap

**Impact**: For a 20x15 grid (300 cells):
- Before: ~45,000 operations worst case
- After: ~2,400 operations worst case
- **18x performance improvement**

### Memory Usage
- More efficient coordinate key generation
- Reduced redundant position conversions
- Better cache locality with cell-index based processing

## 🚨 Breaking Changes

### Function Signatures
Most functions maintain backward compatibility, but internal behavior is more consistent:

```typescript
// These still work the same externally
Pathfinding.findPath(pixelStart, pixelGoal, gameState); // Returns pixel positions
canEscapeFromBomb(pixelPos, bomb, gameState); // Takes pixel position

// But internal processing is now consistent
```

### Constants Usage
- Replace hardcoded `40` with `CELL_SIZE`
- Replace hardcoded `3` with `MOVE_STEP_SIZE`
- Replace hardcoded `200` with `MOVE_INTERVAL_MS`

## 📈 Migration Guide

### For New Code
```typescript
import { 
  CELL_SIZE, 
  pixelToCell, 
  pixelToCellIndex,
  isWithinPixelBounds 
} from '../utils/coordinates';

// Use constants instead of magic numbers
const cellPos = pixelToCell(botPosition);

// Use proper bounds checking
if (isWithinPixelBounds(position, mapWidth, mapHeight)) {
  // Safe to use position
}
```

### For Existing Code
1. Replace hardcoded `40` with `CELL_SIZE`
2. Use coordinate conversion functions instead of manual math
3. Use proper bounds checking functions
4. Import from `coordinates` module for consistency

## 🎯 Future Considerations

### Coordinate System Validation
Consider adding runtime validation in development mode:
```typescript
if (process.env.NODE_ENV === 'development') {
  validateCoordinateSystem(position, context);
}
```

### Performance Monitoring
Track pathfinding performance improvements:
- Average pathfinding time
- Number of nodes expanded
- Memory usage patterns

### Additional Optimizations
- Hierarchical pathfinding for large maps
- Cached distance calculations
- Pre-computed safe zones

## ✅ Verification

### Build Status
- ✅ TypeScript compilation successful
- ✅ No linting errors
- ✅ All imports resolved correctly

### Integration Tests
- ✅ Pathfinding returns valid pixel positions
- ✅ Bounds checking prevents out-of-bounds access
- ✅ Escape detection works with time constraints
- ✅ Coordinate conversions are bidirectional

This coordinate system overhaul provides a solid foundation for consistent, performant, and maintainable spatial calculations throughout the Bomberman bot.