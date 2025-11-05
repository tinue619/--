# DRAWER FORMULAS - CABINET EDITOR VERSION

## Constants
```javascript
CONFIG.DSP = 16  // panel thickness
CONFIG.DRAWER = {
  SIZES: [270, 320, 370, 420, 470, 520, 570, 620],  // standard box lengths
  GAP_FRONT: 2,      // front gap from volume edges
  GAP_TOP: 28,       // top gap
  GAP_BOTTOM: 2,     // bottom gap
  SIDE_OFFSET_X: 5,  // sides offset from dividers
  SIDE_OFFSET_Y: 17, // sides offset from bottom
  INNER_OFFSET: 21,  // offset for back/bottom from volume edges
  BACK_OFFSET: 2,    // back panel offset from sides back edge
  BOTTOM_OFFSET: 2   // bottom forward offset from (sides + DSP)
}
```

## Volume Calculation (from connections)

```javascript
calculateDrawerVolume(connections, app, cabinetDepth) {
  const { bottomShelf, topShelf, leftDivider, rightDivider } = connections;
  
  // Find minimum depth among connected panels
  const depths = [
    (cabinetDepth - CONFIG.HDF) - app.calculatePanelRank(bottomShelf),
    (cabinetDepth - CONFIG.HDF) - app.calculatePanelRank(topShelf),
    (cabinetDepth - CONFIG.HDF) - app.calculatePanelRank(leftDivider),
    (cabinetDepth - CONFIG.HDF) - app.calculatePanelRank(rightDivider)
  ];
  const minDepth = Math.min(...depths);
  
  return {
    x: {
      start: leftDivider.position.x + CONFIG.DSP/2,
      end: rightDivider.position.x - CONFIG.DSP/2
    },
    y: {
      start: bottomShelf.position.y + CONFIG.DSP/2,
      end: topShelf.position.y - CONFIG.DSP/2
    },
    z: {
      start: 0,
      end: minDepth - 2  // recessed 2mm from most recessed panel
    }
  };
}
```

## Box Length Calculation

```javascript
calculateBoxLength(volDepth) {
  const SIZES = [270, 320, 370, 420, 470, 520, 570, 620];
  
  // Add DSP to volDepth because volume doesn't include front panel
  const availableDepth = volDepth + CONFIG.DSP;
  
  const suitable = SIZES.filter(s => s <= availableDepth);
  return suitable.length > 0 ? suitable[suitable.length - 1] : null;
}
```

## Derived Dimensions

```javascript
const vol = calculateDrawerVolume(connections, app, cabinetDepth);
const volWidth = vol.x.end - vol.x.start;
const volHeight = vol.y.end - vol.y.start;
const volDepth = vol.z.end - vol.z.start;

const boxLength = calculateBoxLength(volDepth);
if (!boxLength) {
  // Error: volume too small (minimum 270mm)
  return null;
}

// Common calculations
const sideHeight = volHeight - 56;
const sideDepth = boxLength - 26;
const bottomDepth = boxLength - 44;
```

## Z-Coordinates (Critical!)

```javascript
// All Z coordinates relative to cabinet coordinate system
const frontZ = vol.z.end;                    // Front panel at volume edge
const sidesZ2 = frontZ - CONFIG.DSP;         // Sides front edge
const sidesZ1 = sidesZ2 - sideDepth;         // Sides back edge
const backZ = sidesZ1 + 2;                   // Back panel position
const bottomZ1 = sidesZ1 + CONFIG.DSP + 2;   // Bottom start
const bottomZ2 = bottomZ1 + bottomDepth;     // Bottom end
```

## Part 1: FRONT PANEL

```javascript
front: {
  // Size
  width: volWidth - 4,
  height: volHeight - 30,
  depth: CONFIG.DSP,
  
  // Position (center point in 3D space)
  position: {
    x: (vol.x.start + vol.x.end) / 2 + 2,  // centered + 2mm offset
    y: (vol.y.start + vol.y.end) / 2 + 2,  // centered + 2mm offset
    z: frontZ + CONFIG.DSP/2                 // front face at frontZ
  },
  
  // Bounds for 2D rendering
  bounds: {
    x1: vol.x.start + 2,
    x2: vol.x.end - 2,
    y1: vol.y.start + 2,
    y2: vol.y.end - 28
  }
}
```

## Part 2: LEFT SIDE

```javascript
leftSide: {
  // Size
  width: CONFIG.DSP,
  height: sideHeight,
  depth: sideDepth,
  
  // Position
  position: {
    x: vol.x.start + 5 + CONFIG.DSP/2,
    y: vol.y.start + 17 + sideHeight/2,
    z: (sidesZ1 + sidesZ2) / 2
  },
  
  // Bounds
  bounds: {
    x: vol.x.start + 5,
    y1: vol.y.start + 17,
    y2: vol.y.start + 17 + sideHeight,
    z1: sidesZ1,
    z2: sidesZ2
  }
}
```

## Part 3: RIGHT SIDE

```javascript
rightSide: {
  // Size
  width: CONFIG.DSP,
  height: sideHeight,
  depth: sideDepth,
  
  // Position
  position: {
    x: vol.x.end - 21 + CONFIG.DSP/2,
    y: vol.y.start + 17 + sideHeight/2,
    z: (sidesZ1 + sidesZ2) / 2
  },
  
  // Bounds
  bounds: {
    x: vol.x.end - 21,
    y1: vol.y.start + 17,
    y2: vol.y.start + 17 + sideHeight,
    z1: sidesZ1,
    z2: sidesZ2
  }
}
```

## Part 4: BACK PANEL

```javascript
back: {
  // Size
  width: volWidth - 42,
  height: volHeight - 68,
  depth: CONFIG.DSP,
  
  // Position
  position: {
    x: (vol.x.start + vol.x.end) / 2,
    y: vol.y.start + 27 + (volHeight - 68)/2,
    z: backZ + CONFIG.DSP/2
  },
  
  // Bounds
  bounds: {
    x1: vol.x.start + 21,
    x2: vol.x.end - 21,
    y1: vol.y.start + 27,
    y2: vol.y.end - 41,
    z: backZ
  }
}
```

## Part 5: BOTTOM

```javascript
bottom: {
  // Size
  width: volWidth - 42,
  height: CONFIG.DSP,
  depth: bottomDepth,
  
  // Position
  position: {
    x: (vol.x.start + vol.x.end) / 2,
    y: vol.y.start + 27 + CONFIG.DSP/2,
    z: (bottomZ1 + bottomZ2) / 2
  },
  
  // Bounds
  bounds: {
    x1: vol.x.start + 21,
    x2: vol.x.end - 21,
    y: vol.y.start + 27,
    z1: bottomZ1,
    z2: bottomZ2
  }
}
```

## Drawer Class Structure

```javascript
class Drawer extends Panel {
  constructor(id, connections, cabinetDepth) {
    super('drawer', id, {}, {}, connections);
    this.cabinetDepth = cabinetDepth;
    this.parts = null;
    this.calculateParts();
  }
  
  calculateParts() {
    const vol = this.calculateDrawerVolume();
    const boxLength = this.calculateBoxLength(vol.z.end - vol.z.start);
    
    if (!boxLength) {
      console.error('Volume too small for drawer');
      return;
    }
    
    this.boxLength = boxLength;
    
    // Calculate all 5 parts using formulas above
    this.parts = {
      front: { /* ... */ },
      leftSide: { /* ... */ },
      rightSide: { /* ... */ },
      back: { /* ... */ },
      bottom: { /* ... */ }
    };
  }
  
  // Recalculate when connections change
  updateParts(app) {
    this.calculateParts();
    // Update 3D meshes
    this.updateAllMeshes(app);
  }
}
```

## Example Calculation

```
Input (from volume):
vol.x: 0 to 600
vol.y: 0 to 400
vol.z: 0 to 484 (minDepth=486, minus 2mm)

boxLength = 470 (max from SIZES where size <= 484+16=500)

Z-coordinates:
frontZ = 484
sidesZ2 = 484 - 16 = 468
sidesZ1 = 468 - 444 = 24
backZ = 24 + 2 = 26
bottomZ1 = 24 + 16 + 2 = 42
bottomZ2 = 42 + 426 = 468

Parts:
Front: 596x370x16 at z=484+8=492
Sides: 16x344x444 from z=24 to z=468
Back: 558x332x16 at z=26+8=34
Bottom: 558x16x426 from z=42 to z=468
```

## Integration with Cabinet Editor

1. **Add to config.js:**
   ```javascript
   DRAWER: {
     SIZES: [270, 320, 370, 420, 470, 520, 570, 620],
     // ... other constants
   }
   ```

2. **Create Drawer.js:**
   - Extend Panel class
   - Implement calculateParts()
   - Handle connections updates

3. **Update render3D.js:**
   - Add drawer mesh rendering
   - Handle all 5 parts

4. **Update render2D.js:**
   - Show drawer front in 2D view
   - Visual distinction from shelves

---
Created: 2025-01-03
Last Updated: 2025-01-03
