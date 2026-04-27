import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import buildingData from '../data/building_data.json';

export type EngineState = 'IDLE' | 'THREAT_DETECTED' | 'ANALYZING' | 'EVACUATING' | 'ADAPTING' | 'DEVIATED';

export type NodeType = 'ROOM' | 'CORRIDOR' | 'FIRE_EXIT' | 'QR_ANCHOR' | 'EXTINGUISHER' | 'HIDEOUT' | 'CCTV' | 'HYDRANT' | 'STAIRS' | 'ELEVATOR';

export interface MapNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  label?: string;
  isHazard?: boolean;
}

export interface MapLink {
  source: string;
  target: string;
}

export interface MapWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MapZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'ROOM_ZONE' | 'CORRIDOR_ZONE' | 'STAIRS_ZONE' | 'LOBBY_ZONE' | 'RESTROOM_ZONE' | 'KITCHEN_ZONE' | 'ELEVATOR_ZONE' | 'OFFICE_ZONE';
  label?: string;
}

export interface Guest {
  id: string;
  room: string;
  name: string;
  count: number;
  tags: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface EmergencyLog {
  timestamp: string;
  nodeId: string;
  event: string;
}

export interface MapConfig {
  nodes: MapNode[];
  links: MapLink[];
  walls: MapWall[];
  zones: MapZone[];
}

export interface EmergencyInstruction {
  title: string;
  subtitle: string;
  color: string;
}

export interface FloorData {
  id: string;
  name: string;
  config: MapConfig;
}

export interface EmergencyContextType {
  engineState: EngineState;
  userLocation: { floor: string; corridor: string; nodeId: string; coords: {x: number, y: number} };
  cctvFeed: string;
  incidentType: string | null;
  instruction: { title: string; subtitle: string; color: string };
  hazardZones: Array<{ cx: string; cy: string; r: string }>;
  
  mapConfig: MapConfig;
  safeRoute: string | null;
  guestDB: Guest[];
  sosLogs: EmergencyLog[];
  otherActiveAlerts: number;
  activeGuests: Array<{ id: string; nodeId: string; floor: string; lastActive: number }>;
  
  updateMap: (nodes: MapNode[], links: MapLink[], walls: MapWall[], zones: MapZone[]) => void;
  updateGuests: (guests: Guest[]) => void;
  triggerSOS: (atNodeId?: string) => void;
  triggerHazardAtNode: (nodeId: string) => void;
  resetSystem: () => void;
  triggerDeviation: (newNodeId: string) => void;
  setInitialNode: (nodeId: string) => void;
  analyzeExits: () => { bottlenecks: string[]; suggestions: string[] };
  simulateVisionImport: () => void;
  switchFloor: (id: string) => void;
  addFloor: (name: string) => void;
  floors: FloorData[];
  activeFloorId: string;
  cloudId: string;
  syncStatus: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  pushToCloud: () => Promise<void>;
  pullFromCloud: (targetId: string) => Promise<boolean>;
}

const EmergencyContext = createContext<EmergencyContextType | null>(null);


export const EmergencyProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [state, setState] = useState<{
    floors: FloorData[];
    activeFloorId: string;
    guestDB: Guest[];
    sosLogs: EmergencyLog[];
  }>(() => {
    const saved = localStorage.getItem('SAFESTAY_PERSISTENT_DATA');
    let baseState;
    if (saved) {
      try {
        baseState = JSON.parse(saved);
      } catch (e) {
        console.error("Save state corrupt, reverting.");
      }
    }

    if (!baseState) {
      baseState = {
        floors: [
          {
            id: 'f1',
            name: 'Ground Floor',
            config: {
              nodes: (buildingData.mapConfig.nodes as MapNode[]).map(n => ({ ...n, isHazard: false })),
              links: buildingData.mapConfig.links as MapLink[],
              walls: [],
              zones: []
            }
          }
        ],
        activeFloorId: 'f1',
        guestDB: buildingData.guests.map((g: any, i: number) => ({ ...g, id: `g${i}`, count: g.count || 1 })),
        sosLogs: []
      };
    }

    // PERSISTENCE RESTORE: Attempt to recover the last live engine state from the cloud record
    const cloudRecord = localStorage.getItem(`CLOUD_SYNC_GLOBAL_SYNC`);
    if (cloudRecord) {
      try {
        const payload = JSON.parse(cloudRecord);
        if (payload.state) baseState = payload.state;
      } catch (e) {}
    }

    return baseState;
  });

  const [sessionId] = useState(() => `sess_${Math.random().toString(36).substring(7)}`);
  const [cloudId] = useState('GLOBAL_SYNC'); // Hardcoded for demo stability Across ALL devices

  const [engineState, setEngineState] = useState<EngineState>(() => {
    try {
      const rec = localStorage.getItem(`CLOUD_SYNC_GLOBAL_SYNC`);
      return rec ? JSON.parse(rec).engineState || 'IDLE' : 'IDLE';
    } catch (e) { return 'IDLE'; }
  });

  const [incidentType, setIncidentType] = useState<string | null>(() => {
    try {
      const rec = localStorage.getItem(`CLOUD_SYNC_GLOBAL_SYNC`);
      return rec ? JSON.parse(rec).incidentType || null : null;
    } catch (e) { return null; }
  });

  const [cctvFeed, setCctvFeed] = useState('STANDBY');
  const [userLocation, setUserLocation] = useState<{ floor: string; corridor: string; nodeId: string; coords: { x: number; y: number } }>(() => {
    const params = new URLSearchParams(window.location.search);
    const nodeParam = params.get('nodeId') || 'n1';
    const node = buildingData.mapConfig.nodes.find((n: any) => n.id === nodeParam);
    return {
      floor: '3rd Floor',
      corridor: 'Main Hallway',
      nodeId: nodeParam,
      coords: node ? { x: node.x, y: node.y } : { x: 500, y: 500 }
    };
  });

  const [instruction, setInstruction] = useState<EmergencyInstruction>(() => {
    try {
      const rec = localStorage.getItem(`CLOUD_SYNC_GLOBAL_SYNC`);
      return rec ? JSON.parse(rec).instruction || { title: "SafeStay AI", subtitle: "System Ready", color: "var(--text-muted)" } : { title: "SafeStay AI", subtitle: "System Ready", color: "var(--text-muted)" };
    } catch (e) { return { title: "SafeStay AI", subtitle: "System Ready", color: "var(--text-muted)" }; }
  });

  const [safeRoute, setSafeRoute] = useState<string | null>(() => {
    try {
      const rec = localStorage.getItem(`CLOUD_SYNC_GLOBAL_SYNC`);
      return rec ? JSON.parse(rec).safeRoute || null : null;
    } catch (e) { return null; }
  });

  const [hazardZones, setHazardZones] = useState<Array<{ cx: string, cy: string, r: string }>>(() => {
    try {
      const rec = localStorage.getItem(`CLOUD_SYNC_GLOBAL_SYNC`);
      return rec ? JSON.parse(rec).hazardZones || [] : [];
    } catch (e) { return []; }
  });

  const [otherActiveAlerts, setOtherActiveAlerts] = useState(0);
  const [activeGuests, setActiveGuests] = useState<Array<{id: string, nodeId: string, floor: string, lastActive: number}>>([]);
  const [syncStatus] = useState<'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('IDLE');

  useEffect(() => {
    localStorage.setItem('SAFESTAY_PERSISTENT_DATA', JSON.stringify(state));
  }, [state]);

  const activeFloor = state.floors.find(f => f.id === state.activeFloorId) || state.floors[0];
  const mapConfig = activeFloor.config;

  // Handle Deployment Links (?nodeId=...) reactively via Router
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const nodeId = searchParams.get('nodeId');
    if (nodeId) {
      setInitialNode(nodeId);
    }
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('SAFESTAY_CLOUD_ID', cloudId);
    
    // AUTO-PULL ENGINE: Sync from cloud every 2s for multi-device coordination
    const syncLoop = setInterval(() => {
      // MASTER PROTECTION: Don't pull if we are an Admin/Saboteur or if we just pushed locally
      const isControllerPath = window.location.pathname.includes('sabotage') || window.location.pathname.includes('admin');
      const lastLocalPush = parseInt(localStorage.getItem('SAFESTAY_LAST_LOCAL_UPDATE') || '0');
      const timeSincePush = Date.now() - lastLocalPush;

      if (isControllerPath || timeSincePush < 5000) {
        return;
      }

      pullFromCloud(cloudId);
    }, 2000);

    // Also listen for cross-tab storage events for instant sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `CLOUD_SYNC_${cloudId}`) {
        pullFromCloud(cloudId);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(syncLoop);
      window.removeEventListener('storage', handleStorage);
    };
  }, [cloudId]);

  // REACTIVE CLOUD BROADCASTER: Auto-push state changes to sync guests/staff
  useEffect(() => {
    const autoPush = setTimeout(() => {
      // Only push if we are NOT in the middle of a pull to avoid loops
      if (syncStatus === 'IDLE' || syncStatus === 'SUCCESS') {
        const fullPayload = {
            state,
            engineState,
            incidentType,
            hazardZones,
            instruction,
            safeRoute,
            userLocation,
            timestamp: Date.now()
        };
        localStorage.setItem(`CLOUD_SYNC_${cloudId}`, JSON.stringify(fullPayload));
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(autoPush);
  }, [state, hazardZones, engineState, instruction, safeRoute, cloudId]);

  // Presence & Heartbeat Engine
  useEffect(() => {
    const heartbeatLoop = setInterval(() => {
      const now = Date.now();
      
      // 1. If we are a guest (have nodeId), push our heartbeat
      if (userLocation.nodeId) {
        try {
          const presence = JSON.parse(localStorage.getItem('SAFESTAY_LIVE_PRESENCE') || '[]');
          const myEntry = { id: sessionId, nodeId: userLocation.nodeId, floor: userLocation.floor, lastActive: now };
          const filtered = presence.filter((p: any) => p.id !== sessionId && (now - p.lastActive < 10000));
          localStorage.setItem('SAFESTAY_LIVE_PRESENCE', JSON.stringify([...filtered, myEntry]));
        } catch (e) {
          localStorage.setItem('SAFESTAY_LIVE_PRESENCE', '[]');
        }
      }

      // 2. Regardless of who we are, pull all live sessions to state
      try {
        const remotePresence = JSON.parse(localStorage.getItem('SAFESTAY_LIVE_PRESENCE') || '[]');
        const liveOnly = remotePresence.filter((p: any) => (now - p.lastActive < 10000));
        setActiveGuests(liveOnly);
      } catch (e) {
        setActiveGuests([]);
      }
    }, 2000);

    return () => {
      clearInterval(heartbeatLoop);
      try {
        const presence = JSON.parse(localStorage.getItem('SAFESTAY_LIVE_PRESENCE') || '[]');
        localStorage.setItem('SAFESTAY_LIVE_PRESENCE', JSON.stringify(presence.filter((p: any) => p.id !== sessionId)));
      } catch(e) {}
    };
  }, [userLocation.nodeId, sessionId]);

  const pushToCloud = async () => {
    const now = Date.now();
    const fullPayload = {
        state,
        engineState,
        incidentType,
        hazardZones,
        instruction,
        timestamp: now
    };
    localStorage.setItem(`CLOUD_SYNC_${cloudId}`, JSON.stringify(fullPayload));
    localStorage.setItem('SAFESTAY_LAST_LOCAL_UPDATE', now.toString());
  };

  const pullFromCloud = async (targetId: string) => {
    try {
        const remoteData = localStorage.getItem(`CLOUD_SYNC_${targetId}`);
        if (remoteData) {
            const payload = JSON.parse(remoteData);
            
            // Only update if remote state is newer to prevent loops
            const localLastUpdate = parseInt(localStorage.getItem('SAFESTAY_LAST_LOCAL_UPDATE') || '0');
            if (payload.timestamp <= localLastUpdate) return false;

            // Sync Persistence (Silent update to avoid triggering another push)
            if (payload.state) setState(payload.state);
            
            // Sync Engine State
            if (payload.engineState) setEngineState(payload.engineState);
            if (payload.incidentType) setIncidentType(payload.incidentType);
            if (payload.hazardZones) setHazardZones(payload.hazardZones);
            if (payload.instruction) setInstruction(payload.instruction);

            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
  };

  const updateMap = (nodes: MapNode[], links: MapLink[], walls: MapWall[], zones: MapZone[]) => {
    setState(prev => ({
      ...prev,
      floors: prev.floors.map(f => f.id === prev.activeFloorId ? { ...f, config: { nodes, links, walls, zones } } : f)
    }));
  };

  const addFloor = (name: string) => {
    const id = `f${Date.now()}`;
    setState(prev => ({
      ...prev,
      floors: [...prev.floors, { id, name, config: { nodes: [], links: [], walls: [], zones: [] } }],
      activeFloorId: id
    }));
  };



  const switchFloor = (id: string) => {
    setState(prev => ({ ...prev, activeFloorId: id }));
  };

  const updateGuests = (guests: Guest[]) => setState(prev => ({ ...prev, guestDB: guests }));

  const findPath = (startNodeId: string, currentNodes: MapNode[], currentLinks: MapLink[]) => {
    let queue = [[startNodeId]];
    let visited = new Set([startNodeId]);
    
    while (queue.length > 0) {
      const path = queue.shift()!;
      const nodeId = path[path.length - 1];
      const node = currentNodes.find(n => n.id === nodeId);
      
      // Allow start node to be a hazard, but skip if any intermediate node is a hazard
      if (!node) continue;
      if (node.isHazard && path.length > 1) continue; 
      
      if (node.type === 'FIRE_EXIT') return path;
      
      const neighbors = currentLinks
        .filter(l => l.source === nodeId || l.target === nodeId)
        .map(l => l.source === nodeId ? l.target : l.source);
        
      for (const nextId of neighbors) {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push([...path, nextId]);
        }
      }
    }

    queue = [[startNodeId]];
    visited = new Set([startNodeId]);
    while (queue.length > 0) {
        const path = queue.shift()!;
        const nodeId = path[path.length - 1];
        const node = currentNodes.find(n => n.id === nodeId);
        if (!node || node.isHazard) continue;
        if (node.type === 'HIDEOUT') return path;
        const neighbors = currentLinks.filter(l => l.source === nodeId || l.target === nodeId).map(l => l.source === nodeId ? l.target : l.source);
        for (const nextId of neighbors) {
          if (!visited.has(nextId)) {
            visited.add(nextId);
            queue.push([...path, nextId]);
          }
        }
    }
    return null;
  };

  const generateSVGPath = (nodeIds: string[]) => {
    if (!nodeIds || nodeIds.length === 0) return "";
    const points = nodeIds.map(id => {
      const n = mapConfig.nodes.find((node: MapNode) => node.id === id);
      return n ? `${n.x},${n.y}` : "";
    });
    return "M" + points.join(" L");
  };

  const setInitialNode = (nodeId: string) => {
    const targetFloor = state.floors.find(f => f.config.nodes.some(n => n.id === nodeId));
    if (targetFloor) {
      if (state.activeFloorId !== targetFloor.id) {
          setState(prev => ({ ...prev, activeFloorId: targetFloor.id }));
      }
      const node = targetFloor.config.nodes.find(n => n.id === nodeId);
      if (node) {
          setUserLocation({ floor: targetFloor.name, corridor: node.label || 'Assigned Zone', nodeId: node.id, coords: {x: node.x, y: node.y} });
      }
    }
  };

  const resetSystem = () => {
    setEngineState('IDLE');
    setIncidentType(null);
    setCctvFeed('STANDBY');
    setInstruction({ title: "SafeStay AI", subtitle: "System Ready", color: "var(--text-muted)" });
    setHazardZones([]);
    setSafeRoute(null);
    setOtherActiveAlerts(0);
    setState(prev => ({ 
      ...prev, 
      sosLogs: [],
      floors: prev.floors.map(f => ({
        ...f,
        config: {
          ...f.config,
          nodes: f.config.nodes.map(n => ({ ...n, isHazard: false }))
        }
      }))
    }));
  };

  const triggerSOS = (atNodeId?: string) => {
    const origin = atNodeId || userLocation.nodeId;
    const node = mapConfig.nodes.find((n: MapNode) => n.id === origin);
    
    if (node) {
      setUserLocation(prev => ({ ...prev, nodeId: node.id, coords: {x: node.x, y: node.y} }));
      setState(prev => ({ ...prev, sosLogs: [...prev.sosLogs, { timestamp: new Date().toLocaleTimeString(), nodeId: origin, event: 'SOS_TRIGGERED' }] }));
    }
    
    setEngineState('ANALYZING');
    setInstruction({ title: "SOS ACTIVATED", subtitle: "Calculating safest route...", color: "var(--primary-red)" });
    
    setTimeout(() => {
      setEngineState('EVACUATING');
      setIncidentType('FIRE EMERGENCY');
      setCctvFeed('LIVE: CAM_SECURE');
      const pathIds = findPath(origin, mapConfig.nodes, mapConfig.links);
      setSafeRoute(pathIds ? generateSVGPath(pathIds) : null);
      if (pathIds) {
          const lastNodeId = pathIds[pathIds.length - 1];
          const lastNode = mapConfig.nodes.find(n => n.id === lastNodeId);
          setInstruction({ 
            title: lastNode?.type === 'HIDEOUT' ? "HEAD TO HIDEOUT" : "MOVE FORWARD", 
            subtitle: lastNode?.type === 'HIDEOUT' ? "Path to exit blocked. Moving to safe zone." : `Following route to ${lastNode?.label || 'Exit'}`, 
            color: "var(--safe-green)" 
          });
      }
    }, 2000);
  };

  const triggerHazardAtNode = (nodeId: string) => {
    // LOCK SYSTEM: Immediately signify local control to prevent pull-overwrite
    localStorage.setItem('SAFESTAY_LAST_LOCAL_UPDATE', Date.now().toString());

    const updatedNodes = mapConfig.nodes.map((n: MapNode) => n.id === nodeId ? { ...n, isHazard: true } : n);
    updateMap(updatedNodes, mapConfig.links, mapConfig.walls, mapConfig.zones);
    
    const node = mapConfig.nodes.find((n: MapNode) => n.id === nodeId);
    if (node) {
      setHazardZones(prev => {
        const exists = prev.some(h => h.cx === node.x.toString() && h.cy === node.y.toString());
        if (exists) return prev;
        return [...prev, { cx: node.x.toString(), cy: node.y.toString(), r: "60" }];
      });
    }

    setEngineState('ADAPTING');
    setInstruction({ title: "PATH BLOCKED", subtitle: "Rerouting around hazard...", color: "var(--warning-yellow)" });

    setTimeout(() => {
      const newPathIds = findPath(userLocation.nodeId, updatedNodes, mapConfig.links);
      setSafeRoute(newPathIds ? generateSVGPath(newPathIds) : null);
      setInstruction({ title: "NEW ROUTE", subtitle: "Follow updated path to Exit", color: "var(--safe-green)" });
    }, 2000);
  };

  const triggerDeviation = (newNodeId: string) => {
    const node = mapConfig.nodes.find((n: MapNode) => n.id === newNodeId);
    if (!node) return;
    
    setUserLocation(prev => ({ ...prev, nodeId: newNodeId, coords: { x: node.x, y: node.y }}));
    setEngineState('DEVIATED');
    setInstruction({ title: "OFF ROUTE", subtitle: "Recalculating from current position...", color: "var(--primary-red)" });

    setTimeout(() => {
      const pathIds = findPath(newNodeId, mapConfig.nodes, mapConfig.links);
      setSafeRoute(pathIds ? generateSVGPath(pathIds) : null);
      setInstruction({ title: "RESUME NAV", subtitle: "Path found from your location.", color: "var(--safe-green)" });
    }, 2000);
  };

  // Reactive Neural Routing: Recalculate path when map conditions or position change
  useEffect(() => {
    if (userLocation.nodeId) {
      const pathIds = findPath(userLocation.nodeId, mapConfig.nodes, mapConfig.links);
      setSafeRoute(pathIds ? generateSVGPath(pathIds) : null);
    }
  }, [userLocation.nodeId, hazardZones, mapConfig.nodes]);

  const analyzeExits = () => {
    const bottlenecks: string[] = [];
    const suggestions: string[] = [];
    mapConfig.nodes.forEach(node => {
      if (node.type === 'FIRE_EXIT') return;
      const path = findPath(node.id, mapConfig.nodes, mapConfig.links);
      if (!path) {
        bottlenecks.push(node.id);
        suggestions.push(`CRITICAL: Node ${node.id} is isolated!`);
      }
    });
    return { bottlenecks, suggestions };
  };

  const simulateVisionImport = () => {
    // Advanced AI Simulation: Detection of Hackathon Professional Layout
    // Reconstructing the EXACT map from the user's design
    const nodes: MapNode[] = [];
    const links: MapLink[] = [];
    const zones: MapZone[] = [];

    // 1. TOP ROW: Room 003, 004, 005
    zones.push({ id: 'z-003', x: 100, y: 100, w: 300, h: 300, type: 'ROOM_ZONE', label: 'Room 003' });
    zones.push({ id: 'z-004', x: 400, y: 100, w: 300, h: 300, type: 'ROOM_ZONE', label: 'Room 004' });
    zones.push({ id: 'z-005', x: 700, y: 100, w: 300, h: 300, type: 'ROOM_ZONE', label: 'Room 005' });

    nodes.push({ id: 'n-003', x: 250, y: 380, type: 'ROOM', label: '003 Entry' });
    nodes.push({ id: 'n-004', x: 550, y: 380, type: 'ROOM', label: '004 Entry' });
    nodes.push({ id: 'n-005', x: 800, y: 380, type: 'ROOM', label: '005 Entry' });

    // 2. MIDDLE ROW: Room 002, Corridor 2, Room 006
    zones.push({ id: 'z-002', x: 100, y: 400, w: 180, h: 180, type: 'ROOM_ZONE', label: 'Room 002' });
    zones.push({ id: 'z-corr2', x: 280, y: 400, w: 540, h: 100, type: 'CORRIDOR_ZONE', label: 'Corridor 2' });
    zones.push({ id: 'z-006', x: 820, y: 400, w: 180, h: 180, type: 'ROOM_ZONE', label: 'Room 006' });

    nodes.push({ id: 'n-002', x: 260, y: 450, type: 'ROOM', label: '002 Entry' });
    nodes.push({ id: 'n-corr2-l', x: 320, y: 450, type: 'CORRIDOR', label: 'Hall 2-L' });
    nodes.push({ id: 'n-corr2-r', x: 750, y: 450, type: 'CORRIDOR', label: 'Hall 2-R' });
    nodes.push({ id: 'n-006', x: 830, y: 450, type: 'ROOM', label: '006 Entry' });

    // 3. BOTTOM ROW: Room 001, Corridor 1, Entrance Hall, Corridor 3, Room 007
    zones.push({ id: 'z-001', x: 100, y: 580, w: 180, h: 180, type: 'ROOM_ZONE', label: 'Room 001' });
    zones.push({ id: 'z-corr1', x: 280, y: 500, w: 100, h: 260, type: 'CORRIDOR_ZONE', label: 'Corridor 1' });
    zones.push({ id: 'z-entrance', x: 380, y: 500, w: 340, h: 260, type: 'LOBBY_ZONE', label: 'Entrance Hall' });
    zones.push({ id: 'z-corr3', x: 720, y: 500, w: 100, h: 260, type: 'CORRIDOR_ZONE', label: 'Corridor 3' });
    zones.push({ id: 'z-007', x: 820, y: 580, w: 180, h: 180, type: 'ROOM_ZONE', label: 'Room 007' });

    nodes.push({ id: 'n-001', x: 260, y: 720, type: 'ROOM', label: '001 Entry' });
    nodes.push({ id: 'n-corr1-b', x: 320, y: 720, type: 'CORRIDOR', label: 'Hall 1-Bottom' });
    nodes.push({ id: 'n-entrance-top', x: 550, y: 600, type: 'CORRIDOR', label: 'Lobby Central' });
    nodes.push({ id: 'n-entrance-bot', x: 550, y: 720, type: 'CORRIDOR', label: 'Main Desk' });
    nodes.push({ id: 'n-corr3-b', x: 750, y: 720, type: 'CORRIDOR', label: 'Hall 3-Bottom' });
    nodes.push({ id: 'n-007', x: 830, y: 720, type: 'ROOM', label: '007 Entry' });

    // 4. MAIN EXITS (Bottom Red Icons)
    nodes.push({ id: 'exit-1', x: 320, y: 850, type: 'FIRE_EXIT', label: 'EXIT 1' });
    nodes.push({ id: 'exit-2', x: 550, y: 850, type: 'FIRE_EXIT', label: 'MAIN EXIT' });
    nodes.push({ id: 'exit-3', x: 750, y: 850, type: 'FIRE_EXIT', label: 'EXIT 3' });

    // 5. LINKS (Evacuation Routing)
    // Top to Hallway
    links.push({ source: 'n-003', target: 'n-corr2-l' });
    links.push({ source: 'n-004', target: 'n-entrance-top' });
    links.push({ source: 'n-005', target: 'n-corr2-r' });

    // Hallway Connections
    links.push({ source: 'n-corr2-l', target: 'n-002' });
    links.push({ source: 'n-corr2-l', target: 'n-corr2-r' });
    links.push({ source: 'n-corr2-r', target: 'n-006' });
    
    // Vertical Corridors
    links.push({ source: 'n-corr2-l', target: 'n-corr1-b' });
    links.push({ source: 'n-corr2-r', target: 'n-corr3-b' });
    links.push({ source: 'n-entrance-top', target: 'n-entrance-bot' });

    // Bottom Connectors
    links.push({ source: 'n-corr1-b', target: 'n-001' });
    links.push({ source: 'n-corr1-b', target: 'n-entrance-bot' });
    links.push({ source: 'n-entrance-bot', target: 'n-corr3-b' });
    links.push({ source: 'n-corr3-b', target: 'n-007' });

    // Exit Links
    links.push({ source: 'n-corr1-b', target: 'exit-1' });
    links.push({ source: 'n-entrance-bot', target: 'exit-2' });
    links.push({ source: 'n-corr3-b', target: 'exit-3' });

    updateMap(nodes, links, [], zones);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') {
        const pathNodeId = userLocation.nodeId === 'n1' ? 'n2' : userLocation.nodeId;
        triggerHazardAtNode(pathNodeId);
      }
      if (e.key.toLowerCase() === 'r') resetSystem();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [userLocation.nodeId, mapConfig]);

  return (
    <EmergencyContext.Provider value={{ 
      engineState, userLocation, cctvFeed, incidentType, instruction, hazardZones, mapConfig, safeRoute, guestDB: state.guestDB, sosLogs: state.sosLogs, otherActiveAlerts, activeGuests, 
      triggerSOS, 
      addFloor,
      switchFloor,
      simulateVisionImport,
      resetSystem,
      updateGuests,
      triggerHazardAtNode, updateMap, setInitialNode, analyzeExits, triggerDeviation,
      floors: state.floors, 
      activeFloorId: state.activeFloorId,
      cloudId,
      syncStatus,
      pushToCloud,
      pullFromCloud
    }}>
      {children}
    </EmergencyContext.Provider>
  );
};

export const useEmergencyEngine = () => {
  const ctx = useContext(EmergencyContext);
  if (!ctx) throw new Error("useEmergencyEngine must be used within EmergencyProvider");
  return ctx;
};
