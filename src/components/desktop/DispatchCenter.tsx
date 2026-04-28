import React from 'react';
import { AlertTriangle, Activity, CheckCircle, ShieldAlert, XCircle, Flame, Navigation, Video } from 'lucide-react';
import { useEmergencyEngine } from '../../context/EmergencyContext';
import styles from './desktop.module.css';

export const DispatchCenter: React.FC = () => {
  const { pendingIncident, confirmIncident, sosLogs, engineState, cctvFeed, mapConfig } = useEmergencyEngine();

  const activeAlerts = sosLogs.filter(l => l.status === 'ACTIVE');

  // Helper to render the specific threat icon
  const renderThreatIcon = (type: string, subtype: string) => {
    if (type === 'MEDICAL') return <Activity size={64} color="#38bdf8" />;
    if (subtype?.toUpperCase() === 'FIRE') return <Flame size={64} color="#ef4444" />;
    return <ShieldAlert size={64} color="#ef4444" />;
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <ShieldAlert size={32} color="#38bdf8" />
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: 2 }}>SECURITY DISPATCH</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>EMERGENCY RESPONSE CENTER</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 30 }}>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 800 }}>ACTIVE INCIDENTS</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: activeAlerts.length > 0 ? '#ef4444' : '#10b981' }}>{activeAlerts.length}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 800 }}>SYSTEM STATUS</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: engineState === 'IDLE' ? '#10b981' : '#f59e0b' }}>{engineState}</div>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', overflowY: 'auto' }}>
        
        {!pendingIncident ? (
          <div style={{ textAlign: 'center', opacity: 0.5 }}>
            <CheckCircle size={80} color="#10b981" style={{ marginBottom: 20 }} />
            <h2 style={{ fontSize: 32, fontWeight: 800, color: '#10b981', marginBottom: 10 }}>NO PENDING ALERTS</h2>
            <p style={{ fontSize: 18, color: '#94a3b8' }}>Listening for incoming SOS broadcasts...</p>
          </div>
        ) : (
          <div style={{ 
            width: '100%', 
            maxWidth: 1000, 
            backgroundColor: '#1e293b', 
            borderRadius: 24, 
            border: `4px solid ${pendingIncident.type === 'MEDICAL' ? '#38bdf8' : '#ef4444'}`,
            overflow: 'hidden',
            boxShadow: `0 0 50px ${pendingIncident.type === 'MEDICAL' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            animation: 'pulse 1.5s infinite'
          }}>
            {/* Alert Header */}
            <div style={{ 
              backgroundColor: pendingIncident.type === 'MEDICAL' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              padding: '30px 40px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #334155'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    {renderThreatIcon(pendingIncident.type, pendingIncident.subtype)}
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: pendingIncident.type === 'MEDICAL' ? '#38bdf8' : '#ef4444', letterSpacing: 2 }}>INCOMING SOS REPORT</div>
                        <h2 style={{ fontSize: 36, fontWeight: 900, margin: 0 }}>
                            {pendingIncident.type === 'MEDICAL' ? 'MEDICAL EMERGENCY' : `SECURITY THREAT: ${pendingIncident.subtype?.toUpperCase()}`}
                        </h2>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>ORIGIN NODE</div>
                    <div style={{ fontSize: 24, fontWeight: 900 }}>{mapConfig.nodes.find(n => n.id === pendingIncident.nodeId)?.label || pendingIncident.nodeId}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 5 }}>{new Date(pendingIncident.timestamp).toLocaleTimeString()}</div>
                </div>
            </div>

            {/* AI Analysis & CCTV */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 40, gap: 40 }}>
                {/* AI Verification */}
                <div>
                    <h3 style={{ fontSize: 18, color: '#94a3b8', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Activity size={20} color="#38bdf8" /> AI VISION VERIFICATION
                    </h3>
                    <div style={{ backgroundColor: '#0f172a', padding: 25, borderRadius: 16, border: '1px solid #334155' }}>
                        <p style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 20 }}>
                            "{pendingIncident.aiVerification?.aiAssessment || 'No assessment available.'}"
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', backgroundColor: 'rgba(56, 189, 248, 0.1)', borderRadius: 12 }}>
                            <span style={{ fontWeight: 800, color: '#38bdf8' }}>AI CONFIDENCE SCORE</span>
                            <span style={{ fontSize: 24, fontWeight: 900, color: '#38bdf8' }}>
                                {((pendingIncident.aiVerification?.confidence || 0) * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* CCTV Context */}
                <div>
                    <h3 style={{ fontSize: 18, color: '#94a3b8', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Video size={20} color="#38bdf8" /> CONTEXT CAMERA
                    </h3>
                    <div style={{ backgroundColor: '#000', height: 200, borderRadius: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #334155', position: 'relative', overflow: 'hidden' }}>
                        <Video size={48} color="rgba(255,255,255,0.1)" />
                        <div style={{ position: 'absolute', top: 10, left: 10, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 'bold' }}>CAM_SECURE_{pendingIncident.nodeId.slice(-4)}</div>
                        <div style={{ position: 'absolute', bottom: 10, right: 10, color: '#ef4444', fontSize: 12, fontWeight: 'bold', animation: 'pulse 2s infinite' }}>• REC</div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{ padding: '0 40px 40px 40px', display: 'flex', gap: 20 }}>
                <button 
                    onClick={() => confirmIncident(pendingIncident.id, true)}
                    style={{ flex: 2, padding: 25, backgroundColor: pendingIncident.type === 'MEDICAL' ? '#38bdf8' : '#ef4444', color: '#0f172a', border: 'none', borderRadius: 16, fontSize: 24, fontWeight: 900, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 15 }}
                >
                    <CheckCircle size={32} />
                    {pendingIncident.type === 'MEDICAL' ? 'ACCEPT & DEPLOY AID' : 'CONFIRM & TRIGGER EVACUATION'}
                </button>
                <button 
                    onClick={() => confirmIncident(pendingIncident.id, false)}
                    style={{ flex: 1, padding: 25, backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 16, fontSize: 18, fontWeight: 900, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}
                >
                    <XCircle size={24} /> SCRAP REPORT
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
