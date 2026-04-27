import React from 'react';
import { AlertOctagon, Video, Users, CheckCircle, Maximize, Minimize } from 'lucide-react';
import styles from './desktop.module.css';
import { useEmergencyEngine } from '../../context/EmergencyContext';

export const StaffDashboard: React.FC = () => {
  const { engineState, cctvFeed, incidentType, userLocation, guestDB, otherActiveAlerts, mapConfig, hazardZones, resetSystem, activeGuests } = useEmergencyEngine();
  
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [isDragging, setIsDragging] = React.useState(false);
  const [startPos, setStartPos] = React.useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const isEmergency = engineState !== 'IDLE' && engineState !== 'THREAT_DETECTED';
  const isThreatDetected = engineState === 'THREAT_DETECTED';

  const { cloudId, syncStatus, pullFromCloud } = useEmergencyEngine();

  const handleManualSync = () => {
    pullFromCloud(cloudId);
  };

  return (
    <div className={styles.dashboardLayout}>
      {/* Top Global Alert Bar */}
      <div className={styles.topBar} style={{ 
        backgroundColor: isEmergency ? 'var(--primary-red-dim)' : isThreatDetected ? 'var(--warning-yellow)' : 'var(--bg-elevated)', 
        borderBottomColor: isEmergency ? 'var(--primary-red)' : isThreatDetected ? 'var(--warning-yellow)' : 'var(--safe-green)' 
      }}>
        {isEmergency ? (
          <AlertOctagon size={40} color="#fff" style={{ animation: 'pulse 1s infinite' }} />
        ) : isThreatDetected ? (
          <AlertOctagon size={40} color="#000" />
        ) : (
          <CheckCircle size={40} color="var(--safe-green)" />
        )}
        <h1 style={{ color: isThreatDetected ? '#000' : '#fff' }}>
           {isThreatDetected ? `AI ALERT: ${incidentType}` : (incidentType || 'SYSTEM NORMAL')}
        </h1>
        {isEmergency && (
          <button onClick={resetSystem} style={{ 
            marginLeft: 'auto', background: '#fff', color: '#ef4444', border: 'none', 
            padding: '10px 24px', borderRadius: '8px', fontWeight: '900', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>NORMALIZE SYSTEM</button>
        )}
      </div>

      {/* Left Panel: Active SOS Alerts */}
      <div className={`${styles.panel} ${styles.leftPanel}`}>
        <div className={styles.panelHeader}>Active SOS Alerts ({isEmergency ? 1 + otherActiveAlerts : '0'})</div>
        <div className={styles.listContent}>
          {isEmergency && [
            { room: userLocation.floor + ' ' + userLocation.corridor, type: incidentType, time: 'Just now', id: 'SOS_01' },
            { room: 'Room 315', type: 'Smoke Reported', time: '2m ago', id: 'SOS_02' },
            { room: 'Hallway B', type: 'System Auto-Trigger', time: '3m ago', id: 'SOS_03' },
          ].map((alert, i) => (
            <div key={i} className={styles.alertCard} style={{ background: i === 0 ? 'rgba(255,59,48,0.15)' : 'var(--bg-elevated)' }}>
              <div className="flex-center" style={{ justifyContent: 'space-between' }}>
                 <div className={styles.alertTitle}>{alert.room}</div>
                 <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{alert.id}</span>
              </div>
              <div className={styles.alertMeta}>{alert.type} • {alert.time}</div>
            </div>
          ))}
          {!isEmergency && <span className={styles.alertMeta}>Monitoring building feeds...</span>}
        </div>
      </div>

      {/* Center Panel: Map & Heatmap */}
      <div className={`${styles.panel} ${styles.centerPanel}`}>
        <div className={styles.panelHeader} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Live Building Overview</span>
          <div className="flex-center" style={{ gap: '12px' }}>
            <button 
                onClick={handleManualSync}
                style={{ 
                    fontSize: '10px', 
                    padding: '4px 8px', 
                    background: syncStatus === 'SUCCESS' ? 'var(--safe-green)' : 'var(--bg-elevated)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: syncStatus === 'SUCCESS' ? '#000' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                }}
            >
                {syncStatus === 'SYNCING' ? 'SYNCING...' : syncStatus === 'SUCCESS' ? 'DATABASE UPDATED' : 'REFRESH FROM DB'}
            </button>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning-yellow)' }}>
                <Users size={16} /> Crowd Density active
            </span>
          </div>
        </div>
        <div className={styles.mapWrapper} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} style={{ cursor: isDragging ? 'grabbing' : 'grab', overflow: 'hidden', position: 'relative' }}>
          <div className={styles.heatmap} />
          
          <svg className={styles.buildingPlan} viewBox="0 0 3000 3000" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
            {/* Architectural Zones */}
            {mapConfig.zones?.map((zone) => (
               <rect 
                key={zone.id} x={zone.x} y={zone.y} width={zone.w} height={zone.h} 
                fill={zone.type === 'ROOM_ZONE' ? 'rgba(254, 243, 199, 0.7)' : zone.type === 'CORRIDOR_ZONE' ? 'rgba(220, 252, 231, 0.4)' : 'rgba(255, 255, 255, 0.2)'} 
                stroke="rgba(255,255,255,0.2)" strokeWidth={2/zoom}
                onClick={() => console.log('Zone:', zone.label)}
               />
            ))}
            
            {/* Architectural Labels for Staff */}
            {mapConfig.zones?.map((zone) => (
              <text 
                key={`label-staff-${zone.id}`} 
                x={zone.x + zone.w/2} 
                y={zone.y + zone.h/2} 
                textAnchor="middle" 
                fill="rgba(255,255,255,0.6)" 
                style={{ fontSize: '32px', fontWeight: 900, pointerEvents: 'none', letterSpacing: '4px', textShadow: '0 0 10px rgba(0,0,0,0.8)' }}
              >
                {zone.label}
              </text>
            ))}
            
            {/* Context nodes for staff (hidden markers) */}
            {mapConfig.nodes.map(n => <circle key={n.id} cx={n.x} cy={n.y} r={5/zoom} fill="rgba(255,255,255,0.2)" /> )}

            {/* Walls */}
            {mapConfig.walls?.map((wall) => (
               <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke="rgba(255,255,255,0.05)" strokeWidth={30/zoom} strokeLinecap="round" />
            ))}

            {/* Dynamic Graph Links (Corridors) */}
            {mapConfig.links.map((link, i) => {
              const s = mapConfig.nodes.find(n => n.id === link.source);
              const t = mapConfig.nodes.find(n => n.id === link.target);
              if (!s || !t) return null;
              return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="var(--bg-elevated)" strokeWidth={60/zoom} strokeLinecap="round" opacity="0.3" />;
            })}
            
            {/* Dynamic Graph Nodes (Rooms/Hallways) */}
            {mapConfig.nodes.map((node) => (
              <g key={node.id}>
                {node.type === 'ROOM' ? (
                  <rect 
                    x={node.x - 40} y={node.y - 40} 
                    width="80" height="80" 
                    fill={node.isHazard ? 'var(--primary-red-dim)' : 'var(--bg-surface)'} 
                    stroke="var(--bg-elevated)"
                  />
                ) : (
                  <circle 
                    cx={node.x} cy={node.y} r="20" 
                    fill={node.isHazard ? 'var(--primary-red-dim)' : 'var(--bg-elevated)'} 
                  />
                )}
                {node.isHazard && (
                  <circle cx={node.x} cy={node.y} r="30" fill="var(--primary-red)" opacity="0.4" />
                )}
              </g>
            ))}
            
            {/* Real-time Hazard Zones (Heat) */}
            {hazardZones.map((hz, i) => (
              <circle key={`hz-${i}`} cx={hz.cx} cy={hz.cy} r={hz.r} fill="var(--primary-red)" opacity="0.2">
                <animate attributeName="r" values={`${hz.r};${parseInt(hz.r)+20};${hz.r}`} dur="2s" repeatCount="indefinite" />
              </circle>
            ))}
            
            {/* Real-time Guest RADAR (All Active Sessions) */}
            {activeGuests.map((guest) => {
               const node = mapConfig.nodes.find(n => n.id === guest.nodeId);
               if (!node) return null;
               const isMe = guest.nodeId === userLocation.nodeId;
               
               return (
                 <g key={guest.id} transform={`translate(${node.x}, ${node.y})`}>
                   <circle 
                     r={24/zoom} 
                     fill={isEmergency ? 'var(--primary-red)' : 'var(--safe-green)'} 
                     style={{ animation: 'pulse 2s infinite', opacity: 0.6 }} 
                   />
                   <circle r={8/zoom} fill={isMe ? '#38bdf8' : '#fff'} />
                   <text y="-35" textAnchor="middle" fill={isEmergency ? 'var(--primary-red)' : 'var(--safe-green)'} style={{ fontSize: '12px', fontWeight: 900 }}>
                     {isMe ? "YOU" : `GUEST_${guest.id.slice(5,8).toUpperCase()}`}
                   </text>
                 </g>
               );
            })}
          </svg>

          {/* Tactical Zoom Controls - High Visibility Overlay */}
          <div style={{ 
            position: 'absolute', 
            top: 20, 
            right: 20, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 8, 
            zIndex: 100 
          }}>
              <button onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(prev + 0.2, 4)); }} 
                style={{ 
                  width: 50, height: 50, 
                  background: 'var(--bg-surface)', 
                  border: '2px solid var(--safe-green)', 
                  borderRadius: 12, 
                  color: 'var(--safe-green)', 
                  boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  transition: 'transform 0.2s'
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Maximize size={24} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(prev - 0.2, 0.5)); }} 
                style={{ 
                  width: 50, height: 50, 
                  background: 'var(--bg-surface)', 
                  border: '2px solid var(--text-muted)', 
                  borderRadius: 12, 
                  color: '#fff', 
                  boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  transition: 'transform 0.2s'
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Minimize size={24} />
              </button>
              
              <div style={{ 
                  background: 'rgba(0,0,0,0.8)', 
                  padding: '4px 8px', 
                  borderRadius: 6, 
                  fontSize: '10px', 
                  textAlign: 'center', 
                  color: 'var(--safe-green)',
                  fontWeight: 'bold',
                  marginTop: 4
              }}>
                {Math.round(zoom * 100)}%
              </div>
          </div>
        </div>
      </div>

      {/* Right Panel: CCTV & Priority Rescues */}
      <div className={`${styles.panel} ${styles.rightPanel}`}>
        <div className={styles.cctvContainer}>
          <div className={styles.cctvLabel}>
            {cctvFeed !== 'STANDBY' && <span className={styles.recDot}></span>}
            {cctvFeed}
          </div>
          <div className={styles.cctvFeed}>
            {cctvFeed === 'STANDBY' ? (
               <Video size={48} color="rgba(255,255,255,0.2)" />
            ) : (
               <div style={{ color: "rgba(255,255,255,0.5)", textShadow: "0 0 10px red" }}>LIVE FOOTAGE</div>
            )}
          </div>
          <div className={styles.cctvEffect}></div>
        </div>
        
        <div className={styles.panelHeader}>Priority Rescue Ranking ({guestDB.filter(() => isEmergency).length})</div>
        <div className={styles.listContent}>
          {guestDB
            .sort((a, b) => {
              if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
              if (a.priority !== 'HIGH' && b.priority === 'HIGH') return 1;
              return 0;
            })
            .map((item, i) => (
            <div key={i} className={styles.priorityCard} style={{ 
               opacity: isEmergency ? 1 : 0.3,
               borderLeft: item.priority === 'HIGH' ? '4px solid var(--warning-yellow)' : 'none'
            }}>
              <div className="flex-col">
                <span className={styles.priorityName}>{item.name}</span>
                <span className={styles.alertMeta}>{item.room}</span>
                <div className="flex-center" style={{ gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                   {item.tags.map((t, idx) => (
                      <span key={idx} style={{ fontSize: '9px', padding: '2px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', color: 'var(--text-muted)' }}>{t}</span>
                   ))}
                </div>
              </div>
              {item.priority === 'HIGH' && <span className={styles.tagWheelchair}>PRIORITY</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
