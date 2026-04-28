import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, onSnapshot, setDoc, getDoc, collection } from 'firebase/firestore';

export type EngineState = 'IDLE' | 'THREAT_DETECTED' | 'ANALYZING' | 'EVACUATING' | 'ADAPTING' | 'DEVIATED';

export type NodeType = 'ROOM' | 'CORRIDOR' | 'FIRE_EXIT' | 'QR_ANCHOR' | 'EXTINGUISHER' | 'HIDEOUT' | 'CCTV' | 'HYDRANT' | 'STAIRS' | 'ELEVATOR';

export interface MapNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  label?: string;
  description?: string;
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
  id: string;
  timestamp: string;
  nodeId: string;
  event: string;
  status: 'ACTIVE' | 'RESOLVED';
  description?: string;
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
  pendingIncident: any;
  confirmIncident: (id: string, confirmed: boolean) => void;
  
  updateMap: (updater: (prevConfig: MapConfig) => MapConfig) => void;
  updateGuests: (guests: Guest[]) => void;
  triggerSOS: (type: 'MEDICAL' | 'THREAT', subtype?: string) => void;
  triggerHazardAtNode: (nodeId: string) => void;
  resetSystem: () => void;
  wipeLogs: () => void;
  resolveIncident: (logId: string) => void;
  triggerDeviation: (newNodeId: string) => void;
  setInitialNode: (nodeId: string) => void;
  analyzeExits: () => { bottlenecks: string[]; suggestions: string[] };
  switchFloor: (id: string) => void;
  addFloor: (name: string) => void;
  floors: FloorData[];
  activeFloorId: string;
  cloudId: string;
  syncStatus: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  pushToCloud: () => Promise<void>;
  pullFromCloud: (targetId: string) => Promise<boolean>;
  undoMap: () => void;
  canUndo: boolean;
  forceRestoreFromDisk: () => Promise<void>;
  saveToDisk: (aiMapData?: any) => void;
}

const EmergencyContext = createContext<EmergencyContextType | null>(null);


export const EmergencyProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [state, setState] = useState<{
    floors: FloorData[];
    activeFloorId: string;
    guestDB: Guest[];
    sosLogs: EmergencyLog[];
    pendingIncident: any;
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
              nodes: [],
              links: [],
              walls: [],
              zones: []
            }
          }
        ],
        activeFloorId: 'f1',
        guestDB: [],
        sosLogs: [],
        pendingIncident: null
      };
    }

    return baseState;
  });

  const [cloudId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('buildingId');
    if (urlId) return urlId;
    return 'SAFESTAY_MASTER';
  });

  const [sessionId] = useState(() => `sess_${Math.random().toString(36).substr(2, 9)}`);
  const isIncomingSync = useRef(false);
  const localPushTimestamp = useRef(0);
  const isDataInitialized = useRef(false);

  useEffect(() => {
    localStorage.setItem('SAFESTAY_CLOUD_ID', cloudId);
    const params = new URLSearchParams(window.location.search);
    if (params.get('buildingId') !== cloudId) {
        params.set('buildingId', cloudId);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    }
  }, [cloudId]);

  const activeFloor = state.floors.find(f => f.id === state.activeFloorId) || state.floors[0];
  const mapConfig = activeFloor.config;

  useEffect(() => {
    if (userLocation.nodeId && mapConfig.nodes.length > 0) {
      const nodeExists = mapConfig.nodes.some(n => n.id === userLocation.nodeId);
      if (!nodeExists) {
        const fallback = mapConfig.nodes[0];
        setUserLocation({
          floor: 'Ground Floor',
          corridor: fallback.label || 'Recalibrated',
          nodeId: fallback.id,
          coords: { x: fallback.x, y: fallback.y }
        });
      }
    }
  }, [mapConfig.nodes]);

  useEffect(() => {
    const initData = async () => {
        try {
            if (db) {
                const cloudSnap = await getDoc(doc(db, "safestay_buildings", cloudId));
                if (cloudSnap.exists()) {
                    const cloudData = cloudSnap.data();
                    if (cloudData.state) {
                        console.log("☁️ Data loaded from Cloud");
                        isDataInitialized.current = true;
                        setState(cloudData.state);
                        return;
                    }
                } else {
                    console.log("🚀 Cloud is empty. Checking for local data to migrate...");
                    
                    const saved = localStorage.getItem('SAFESTAY_PERSISTENT_DATA');
                    let initialState;

                    if (saved) {
                        console.log("📦 Found manual edits in LocalStorage, migrating those to Cloud...");
                        initialState = JSON.parse(saved);
                    } else {
                        console.log("🆕 No data found anywhere. Initializing empty environment.");
                        initialState = {
                            floors: [{ id: 'f1', name: 'Ground Floor', config: { nodes: [], links: [], walls: [], zones: [] } }],
                            guestDB: [],
                            sosLogs: [],
                            activeFloorId: 'f1',
                            pendingIncident: null
                        };
                    }

                    setState(initialState);
                    
                    // Push to cloud immediately
                    await setDoc(doc(db, "safestay_buildings", cloudId), {
                        state: initialState,
                        engineState: 'IDLE',
                        timestamp: Date.now()
                    });
                    isDataInitialized.current = true;
                    console.log("✅ Data successfully anchored to Google Cloud");
                    return;
                }
            }
        } catch (e) {
            console.warn("Firestore sync failed:", e);
        }

        // Final fallback to local cache
        const saved = localStorage.getItem('SAFESTAY_PERSISTENT_DATA');
        if (saved) {
            try { setState(JSON.parse(saved)); } catch(e) {}
        }
    };
    initData();
  }, [cloudId]);

  const forceRestoreFromDisk = async () => {
    console.log("♻️ Force restoring from disk files...");
    try {
        const [mapData, guestData, logData] = await Promise.all([
          fetch('/data/map_data.json').then(res => res.json()).catch(() => ({ nodes: [], links: [], walls: [], zones: [] })),
          fetch('/data/guest_data.json').then(res => res.json()).catch(() => []),
          fetch('/data/log_data.json').then(res => res.json()).catch(() => [])
        ]);

        const restoredState = {
            floors: [{ id: 'f1', name: 'Ground Floor', config: mapData }],
            guestDB: guestData as Guest[],
            sosLogs: logData as EmergencyLog[],
            activeFloorId: 'f1',
            pendingIncident: null
        };

        setState(restoredState);
        
        await setDoc(doc(db, "safestay_buildings", cloudId), {
            state: restoredState,
            engineState: 'IDLE',
            timestamp: Date.now()
        });
        console.log("✅ Disk data successfully restored to Cloud");
        alert("System restored from local files successfully!");
    } catch (e) {
        console.error("Restore failed:", e);
        alert("Failed to restore from local files.");
    }
  };


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
    return {
      floor: '3rd Floor',
      corridor: 'Main Hallway',
      nodeId: nodeParam,
      coords: { x: 500, y: 500 }
    };
  });

  useEffect(() => {
    const activeFloor = state.floors.find(f => f.id === state.activeFloorId);
    if (activeFloor) {
      const node = activeFloor.config.nodes.find(n => n.id === userLocation.nodeId);
      if (node && (node.x !== userLocation.coords.x || node.y !== userLocation.coords.y)) {
        setUserLocation(prev => ({ ...prev, coords: { x: node.x, y: node.y } }));
      }
    }
  }, [state, userLocation.nodeId]);

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

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const nodeId = searchParams.get('nodeId');
    if (nodeId) {
      setInitialNode(nodeId);
    }
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('SAFESTAY_CLOUD_ID', cloudId);
    
    // Real-time Cloud Sync via Firestore
    if (!db) return;

    const unsub = onSnapshot(doc(db, "safestay_buildings", cloudId), (docSnap) => {
        if (docSnap.exists()) {
            const remoteData = docSnap.data();
            
            // Only update if the change came from another client
            if (remoteData.timestamp <= localPushTimestamp.current) return;

            isDataInitialized.current = true;
            isIncomingSync.current = true;
            
            if (remoteData.state) setState(remoteData.state);
            if (remoteData.engineState) setEngineState(remoteData.engineState);
            if (remoteData.incidentType) setIncidentType(remoteData.incidentType);
            if (remoteData.hazardZones) setHazardZones(remoteData.hazardZones);
            if (remoteData.instruction) setInstruction(remoteData.instruction);
        }
    });

    return () => unsub();
  }, [cloudId]);

  const saveToDisk = async (fullData: any) => {
    try {
      const now = Date.now();
      localPushTimestamp.current = now;
      
      const payload = {
        ...fullData,
        engineState,
        incidentType,
        hazardZones,
        instruction,
        timestamp: now
      };

      await setDoc(doc(db, "safestay_buildings", cloudId), payload);
    } catch (e) {
      console.error("Cloud Disk save failed", e);
    }
  };

  useEffect(() => {
    const autoPush = setTimeout(() => {
        if (!isDataInitialized.current) return;

        if (isIncomingSync.current) {
          isIncomingSync.current = false;
          return;
        }

        const fullPayload = {
            state,
            engineState,
            incidentType,
            hazardZones,
            instruction,
            safeRoute,
            timestamp: Date.now()
        };

        localStorage.setItem('SAFESTAY_PERSISTENT_DATA', JSON.stringify(state));
        
        if (syncStatus === 'IDLE' || syncStatus === 'SUCCESS') {
          localPushTimestamp.current = fullPayload.timestamp;
          localStorage.setItem(`CLOUD_SYNC_${cloudId}`, JSON.stringify(fullPayload));
        }

        const activeFloor = state.floors.find(f => f.id === state.activeFloorId) || state.floors[0];
        const diskData = {
          mapConfig: activeFloor.config,
          guests: state.guestDB,
          logs: state.sosLogs,
          pendingIncident: state.pendingIncident
        };
        saveToDisk(diskData);

    }, 100); 

    return () => clearTimeout(autoPush);
  }, [state, hazardZones, engineState, instruction, safeRoute, cloudId]);

  useEffect(() => {
    const heartbeatLoop = setInterval(() => {
      const now = Date.now();
      
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
    localPushTimestamp.current = now;
    localStorage.setItem(`CLOUD_SYNC_${cloudId}`, JSON.stringify(fullPayload));
  };

  const pullFromCloud = async (targetId: string) => {
    try {
        const remoteData = localStorage.getItem(`CLOUD_SYNC_${targetId}`);
        if (remoteData) {
            const payload = JSON.parse(remoteData);
            
            if (payload.timestamp <= localPushTimestamp.current) return false;

            isIncomingSync.current = true;
            if (payload.state) setState(payload.state);
            
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

  const [history, setHistory] = useState<any[]>([]);

  const updateMap = (updater: (prevConfig: MapConfig) => MapConfig) => {
    const activeFloor = state.floors.find(f => f.id === state.activeFloorId);
    if (!activeFloor) return;

    setHistory(h => [
      { floorId: state.activeFloorId, config: JSON.parse(JSON.stringify(activeFloor.config)) },
      ...h.slice(0, 49)
    ]);

    const newConfig = updater(activeFloor.config);
    
    setState(prev => ({
      ...prev,
      floors: prev.floors.map(f => f.id === prev.activeFloorId ? { ...f, config: newConfig } : f)
    }));
  };

  const undoMap = () => {
    if (history.length === 0) return;
    const [lastAction, ...remainingHistory] = history;
    
    setState(prev => ({
      ...prev,
      floors: prev.floors.map(f => f.id === lastAction.floorId ? { ...f, config: lastAction.config } : f)
    }));
    setHistory(remainingHistory);
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
    const points = nodeIds
      .map(id => mapConfig.nodes.find((node: MapNode) => node.id === id))
      .filter((n): n is MapNode => !!n) 
      .map(n => `${n.x},${n.y}`);
    
    if (points.length < 2) return ""; 
    return "M" + points.join(" L");
  };

  const setInitialNode = (nodeId: string) => {
    let targetFloor = state.floors.find(f => f.config.nodes.some(n => n.id === nodeId));
    let targetNodeId = nodeId;

    if (!targetFloor && state.floors.length > 0) {
      targetFloor = state.floors[0];
      if (targetFloor.config.nodes.length > 0) {
        targetNodeId = targetFloor.config.nodes[0].id;
      }
    }

    if (targetFloor) {
      if (state.activeFloorId !== targetFloor.id) {
          setState(prev => ({ ...prev, activeFloorId: targetFloor.id }));
      }
      const node = targetFloor.config.nodes.find(n => n.id === targetNodeId);
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
      sosLogs: prev.sosLogs.map(l => ({ ...l, status: 'RESOLVED' })),
      floors: prev.floors.map(f => ({
        ...f,
        config: {
          ...f.config,
          nodes: f.config.nodes.map(n => ({ ...n, isHazard: false }))
        }
      }))
    }));
  };

  const wipeLogs = () => {
    setState(prev => ({ ...prev, sosLogs: [] }));
  };

  const resolveIncident = (logId: string) => {
    setState(prev => {
        const log = prev.sosLogs.find(l => l.id === logId);
        const updatedLogs = prev.sosLogs.map(l => l.id === logId ? { ...l, status: 'RESOLVED' as const } : l);
        
        const hasActive = updatedLogs.some(l => l.status === 'ACTIVE');
        if (!hasActive) {
            setEngineState('IDLE');
            setIncidentType(null);
            setInstruction({ title: "SafeStay AI", subtitle: "All Clear", color: "var(--safe-green)" });
            setHazardZones([]);
            setSafeRoute(null);
        }

        let updatedFloors = prev.floors;
        if (log && log.nodeId) {
            updatedFloors = prev.floors.map(f => ({
                ...f,
                config: {
                    ...f.config,
                    nodes: f.config.nodes.map(n => n.id === log.nodeId ? { ...n, isHazard: false } : n)
                }
            }));
        }

        return { ...prev, sosLogs: updatedLogs, floors: updatedFloors };
    });
  };

  const triggerSOS = (type: 'MEDICAL' | 'THREAT', subtype?: string) => {
    const origin = userLocation.nodeId;
    const node = mapConfig.nodes.find((n: MapNode) => n.id === origin);
    
    if (!node) return;

    setEngineState('ANALYZING');
    setInstruction({ 
      title: "REPORT RECEIVED", 
      subtitle: `Analyzing ${subtype || type} report at ${node.label || origin}...`, 
      color: "var(--warning-yellow)" 
    });

    setTimeout(async () => {
      const aiVerification = {
        confidence: 0.85,
        aiAssessment: type === 'MEDICAL' ? `Medical distress detected in Room ${node.label || origin}. Vital signs monitoring required.` : `AI detected visual signatures of ${subtype || type} in Room ${node.label || origin}.`,
        suggestedAction: type === 'MEDICAL' ? "DEPLOY FIRST AID" : "IMMEDIATE EVACUATION"
      };

      const newIncident = {
        id: `inc_${Date.now()}`,
        type,
        subtype,
        nodeId: origin,
        timestamp: new Date().toISOString(),
        aiVerification,
        status: 'PENDING_REVIEW'
      };

      setState(prev => ({ ...prev, pendingIncident: newIncident }));

      setInstruction({ 
        title: "AWAITING STAFF", 
        subtitle: type === 'MEDICAL' ? "Requesting medical assistance..." : "AI has verified threat. Awaiting Security confirmation.", 
        color: type === 'MEDICAL' ? "#38bdf8" : "var(--primary-red)" 
      });
      setCctvFeed(`LIVE: ${node.label || origin} - CAM_SECURE`);
    }, 200);
  };

  const confirmIncident = (incidentId: string, confirmed: boolean) => {
    if (!state.pendingIncident || state.pendingIncident.id !== incidentId) return;

    const currentPending = state.pendingIncident;

    if (!confirmed) {
      setState(prev => ({ ...prev, pendingIncident: null }));
      setEngineState('IDLE');
      setInstruction({ title: "REPORT REJECTED", subtitle: "Staff dismissed report.", color: "var(--text-muted)" });
      return;
    }

    const newEngineState = currentPending.type === 'MEDICAL' ? 'IDLE' : 'EVACUATING';
    const newInstruction = currentPending.type === 'MEDICAL' 
      ? { title: "MEDICAL DEPLOYED", subtitle: "First aid team is on the way. Stay where you are.", color: "#38bdf8" }
      : { title: "EVACUATING", subtitle: "Follow the safe path on your map.", color: "#ef4444" };

    setEngineState(newEngineState);
    setInstruction(newInstruction);
    setIncidentType(currentPending.subtype?.toUpperCase() || currentPending.type);
    
    setState(prev => ({
      ...prev,
      pendingIncident: null,
      sosLogs: [...prev.sosLogs, { 
        id: currentPending.id, 
        timestamp: currentPending.timestamp, 
        nodeId: currentPending.nodeId, 
        event: `${currentPending.type}_CONFIRMED`,
        status: 'ACTIVE' as const,
        description: `Staff validated ${currentPending.subtype || currentPending.type}. AI Confidence: 85%`
      } as EmergencyLog]
    }));

    if (currentPending.type !== 'MEDICAL') {
      const pathIds = findPath(currentPending.nodeId, mapConfig.nodes, mapConfig.links);
      setSafeRoute(pathIds ? generateSVGPath(pathIds) : null);
    }
  };

  const triggerHazardAtNode = (nodeId: string) => {
    localStorage.setItem('SAFESTAY_LAST_LOCAL_UPDATE', Date.now().toString());

    const node = mapConfig.nodes.find((n: MapNode) => n.id === nodeId);
    
    setState(prev => {
      const currentActiveFloor = prev.floors.find(f => f.id === prev.activeFloorId) || prev.floors[0];
      const updatedNodes = currentActiveFloor.config.nodes.map((n: MapNode) => n.id === nodeId ? { ...n, isHazard: true } : n);
      
      return {
        ...prev,
        sosLogs: [
          ...prev.sosLogs, 
          { 
            id: `log_${Date.now()}`,
            timestamp: new Date().toISOString(), 
            nodeId, 
            event: 'FIRE_DETECTED',
            status: 'ACTIVE' as const,
            description: `Unauthorized hazard deployment at ${node?.label || nodeId}`
          } as EmergencyLog
        ],
        floors: prev.floors.map(f => f.id === prev.activeFloorId ? { ...f, config: { ...f.config, nodes: updatedNodes } } : f)
      };
    });
    
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
      const updatedNodesForPath = mapConfig.nodes.map((n: MapNode) => n.id === nodeId ? { ...n, isHazard: true } : n);
      const newPathIds = findPath(userLocation.nodeId, updatedNodesForPath, mapConfig.links);
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

  useEffect(() => {
    if (userLocation.nodeId) {
      const pathIds = findPath(userLocation.nodeId, mapConfig.nodes, mapConfig.links);
      setSafeRoute(pathIds ? generateSVGPath(pathIds) : null);
    }
  }, [userLocation.nodeId, hazardZones, mapConfig.nodes]);

  const analyzeExits = () => {
    const bottlenecks: string[] = [];
    const suggestions: string[] = [];
    
    // Core Navigation nodes that MUST be connected
    const coreNavTypes = ['ROOM', 'CORRIDOR', 'STAIRS', 'ELEVATOR', 'HIDEOUT'];

    mapConfig.nodes.forEach(node => {
      if (!coreNavTypes.includes(node.type)) return; // Standalone assets don't need routes
      
      const path = findPath(node.id, mapConfig.nodes, mapConfig.links);
      if (!path) {
        bottlenecks.push(node.id);
        suggestions.push(`CRITICAL: ${node.label || node.type} (${node.id}) is isolated from emergency exits!`);
      }
    });
    return { bottlenecks, suggestions };
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        undoMap();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [history]);

  return (
    <EmergencyContext.Provider value={{ 
      engineState, userLocation, cctvFeed, incidentType, instruction, hazardZones, mapConfig, safeRoute, guestDB: state.guestDB, sosLogs: state.sosLogs, otherActiveAlerts, activeGuests, 
      pendingIncident: state.pendingIncident, confirmIncident,
      triggerSOS, 
      addFloor,
      switchFloor,
      resetSystem,
      wipeLogs,
      resolveIncident,
      updateGuests,
      triggerHazardAtNode, updateMap, setInitialNode, analyzeExits, triggerDeviation,
      floors: state.floors, 
      activeFloorId: state.activeFloorId,
      cloudId,
      syncStatus,
      pushToCloud,
      pullFromCloud,
      undoMap,
      canUndo: history.length > 0,
      forceRestoreFromDisk,
      saveToDisk: (aiMapData?: any) => {
        const activeFloor = state.floors.find(f => f.id === state.activeFloorId) || state.floors[0];
        saveToDisk({
          mapConfig: activeFloor.config,
          guests: state.guestDB,
          logs: state.sosLogs,
          pendingIncident: state.pendingIncident,
          aiMapData: aiMapData
        });
      }
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
