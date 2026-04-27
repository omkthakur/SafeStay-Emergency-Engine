import React from 'react';
import { Volume2, CornerUpLeft, Navigation, Clock, Box, Flame, ShieldAlert, MapPin, ChevronRight, Maximize, Minimize, Locate } from 'lucide-react';
import styles from './mobile.module.css';
import { useEmergencyEngine } from '../../context/EmergencyContext';
import { useSearchParams } from 'react-router-dom';

export const EvacuationMap: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { instruction, safeRoute, hazardZones, userLocation, triggerDeviation, engineState, mapConfig, setInitialNode } = useEmergencyEngine();
  
    const [pan, setPan] = React.useState({ x: 0, y: 0 });
    const [zoom, setZoom] = React.useState(0.8); 
    const [isDragging, setIsDragging] = React.useState(false);
    const [startPos, setStartPos] = React.useState({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
  };

  const handlePointerUp = () => setIsDragging(false);

  const resetView = () => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    // Map units to screen pixels
    const unitScale = Math.min(screenW, screenH) / 3000;
    const currentScale = zoom * unitScale;
    
    const centerX = screenW / 2 - (userLocation.coords.x * currentScale);
    const centerY = screenH / 2 - (userLocation.coords.y * currentScale);
    
    setPan({ x: centerX, y: centerY });
  };

  React.useEffect(() => {
    const nodeId = searchParams.get('nodeId');
    if (nodeId) {
        setInitialNode(nodeId);
    }
  }, [searchParams]);

  React.useEffect(() => {
    resetView();
  }, [userLocation.nodeId]); // Re-center when location/node changes (deployment links)
  
  return (
    <div className={styles.navContainer}>
      <div className={styles.instructionBanner}>
        <div className={styles.instructionText}>
          <h2 style={{ color: instruction.color }}>{instruction.title}</h2>
          <p>{instruction.subtitle}</p>
        </div>
        <CornerUpLeft size={40} color={instruction.color} style={{ opacity: 0.8 }} />
      </div>

      <div className={styles.mapArea}>
        <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 5, background: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid var(--bg-elevated)' }}>
           <div className="flex-center" style={{ gap: '8px', marginBottom: '4px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <Navigation size={14} /> <span>142m to exit</span>
           </div>
           <div className="flex-center" style={{ gap: '8px', color: 'var(--safe-green)', fontSize: '12px', fontWeight: 'bold' }}>
              <Clock size={14} /> <span>Rescue ETA: 3m</span>
           </div>
        </div>

        {/* Guest View: 100% Responsive SVG matched to 3000px CAD canvas */}
        <svg 
            width="100%" 
            height="100%" 
            viewBox="0 0 1200 1200" 
            preserveAspectRatio="xMidYMid meet" 
            className={styles.mapOverlay}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ 
                touchAction: 'none'
            }}
        >
          <g style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
              transformOrigin: '0 0', 
              transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)' 
          }}>
          <defs>
             <pattern id="grid-mobile" width="60" height="60" patternUnits="userSpaceOnUse">
               <circle cx="1" cy="1" r="1.5" fill="rgba(255,255,255,0.05)" />
             </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-mobile)" />
          {/* Render Architectural Zones */}
          {mapConfig.zones?.map((zone) => (
             <rect 
              key={zone.id} x={zone.x} y={zone.y} width={zone.w} height={zone.h} 
              fill={zone.type === 'ROOM_ZONE' ? 'rgba(254, 243, 199, 0.4)' : zone.type === 'CORRIDOR_ZONE' ? 'rgba(220, 252, 231, 0.2)' : 'rgba(243, 244, 246, 0.1)'} 
              stroke="rgba(255,255,255,0.1)" strokeWidth="2"
             />
          ))}
          
          {/* Zone Labels */}
          {mapConfig.zones?.map((zone) => (
             <text 
                key={`label-${zone.id}`} 
                x={zone.x + zone.w/2} 
                y={zone.y + zone.h/2} 
                textAnchor="middle" 
                fill="rgba(255,255,255,0.2)" 
                style={{ fontSize: '24px', fontWeight: 800, pointerEvents: 'none', letterSpacing: '4px' }}
             >
               {zone.label}
             </text>
          ))}

          {/* Render Physical Walls */}
          {mapConfig.walls?.map((wall) => (
             <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke="rgba(255,255,255,0.1)" strokeWidth="20" strokeLinecap="round" />
          ))}

          {/* Render All Node Types with distinct icons */}
          {mapConfig.nodes.map(node => (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              {node.type === 'ROOM' && <Box size={24} color="rgba(255,255,255,0.1)" transform="translate(-12,-12)" />}
              {node.type === 'EXTINGUISHER' && <Flame size={16} color="var(--warning-yellow)" transform="translate(-8,-8)" />}
              {node.type === 'HIDEOUT' && <ShieldAlert size={20} color="var(--safe-green)" transform="translate(-10,-10)" />}
              {node.type === 'FIRE_EXIT' && <ChevronRight size={24} color="#ef4444" transform="translate(-12,-12)" />}
              {node.type === 'QR_ANCHOR' && <MapPin size={16} color="var(--text-muted)" transform="translate(-8,-8)" />}
              
              {/* Node Labels */}
              {(node.type === 'ROOM' || node.type === 'FIRE_EXIT' || node.type === 'HIDEOUT') && (
                <text 
                  x="0" 
                  y="40" 
                  textAnchor="middle" 
                  fill="white" 
                  style={{ fontSize: '14px', fontWeight: 'bold', pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
                  {node.label}
                </text>
              )}

              {/* Deviation Trigger */}
              <circle cx="0" cy="0" r="30" fill="transparent" style={{ cursor: 'pointer' }} onClick={() => triggerDeviation(node.id)} />
            </g>
          ))}

          {/* Render Connections */}
          {mapConfig.links.map((link, i) => {
            const s = mapConfig.nodes.find(n => n.id === link.source);
            const t = mapConfig.nodes.find(n => n.id === link.target);
            return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="rgba(255,255,255,0.05)" strokeWidth="15" strokeLinecap="round" />;
          })}

          {/* Danger Zones (Dynamic) */}
          {hazardZones.map((hz, idx) => (
             <circle key={idx} className={styles.dangerZone} cx={hz.cx} cy={hz.cy} r={hz.r} />
          ))}
          
          {/* Safe Path (Dynamic BFS Path) - Rendered LAST for Layer Top Coverage */}
          {safeRoute && (
            <path className={styles.safePath} d={safeRoute} />
          )}

          {/* User Location */}
          <g transform={`translate(${userLocation.coords.x}, ${userLocation.coords.y})`}>
            <circle className={styles.userAura} cx="0" cy="0" r="30" />
            <circle className={styles.userDot} cx="0" cy="0" r="10" />
            <path d="M-8,12 L0,-12 L8,12 Z" fill="var(--safe-green)" transform="rotate(0) translate(0,-20)" />
          </g>
          </g>
        </svg>

        {/* Mobile Zoom Controls */}
        <div style={{ position: 'absolute', bottom: 100, right: 20, display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10 }}>
            <button onClick={() => setZoom(prev => Math.min(prev + 0.1, 2))} 
                style={{ width: 50, height: 50, background: 'rgba(56, 189, 248, 0.9)', border: 'none', borderRadius: '12px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                <Maximize size={24} />
            </button>
            <button onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.2))} 
                style={{ width: 50, height: 50, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                <Minimize size={24} />
            </button>
            <button onClick={resetView} 
                style={{ width: 50, height: 50, background: 'rgba(56, 189, 248, 0.2)', border: '2px solid #38bdf8', borderRadius: '12px', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}
                title="Locate Me"
            >
                <Locate size={24} />
            </button>
            <button onClick={() => { setPan({ x: 0, y: 0 }); setZoom(0.3); }} 
                style={{ width: 50, height: 50, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '9px', fontWeight: 'bold' }}>
                OVERVIEW
            </button>
        </div>

        {engineState === 'DEVIATED' && (
           <div style={{ position: 'absolute', bottom: 100, background: 'var(--primary-red)', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              OFF ROUTE DETECTED
           </div>
        )}
      </div>

      <div className={styles.bottomBar}>
        <button className={styles.speakBtn}>
          <Volume2 size={32} color="var(--text-main)" />
        </button>
      </div>
    </div>
  );
};
