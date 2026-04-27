import React, { useState, useEffect } from 'react';
import { AlertTriangle, Map, MapPin, Activity, Wifi, Compass } from 'lucide-react';
import styles from './mobile.module.css';
import { useEmergencyEngine } from '../../context/EmergencyContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const EntryScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isConfirming, setIsConfirming] = useState(false);
  const { triggerSOS, engineState, instruction, userLocation, setInitialNode } = useEmergencyEngine();

  useEffect(() => {
    const nodeId = searchParams.get('nodeId');
    if (nodeId) {
      setInitialNode(nodeId);
    }
  }, [searchParams, setInitialNode]);

  const handleSosClick = () => {
    setIsConfirming(true);
    triggerSOS();
  };

  useEffect(() => {
    if (engineState === 'EVACUATING') {
      navigate('/map');
    }
  }, [engineState, navigate]);

  if (isConfirming) {
    return (
      <div className={styles.entryContainer} style={{ justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--primary-red)' }}>
        <AlertTriangle size={64} color="#fff" style={{ marginBottom: 24, animation: 'pulse 1s infinite' }} />
        <h1 style={{ color: '#fff', fontSize: 32, textAlign: 'center', fontWeight: 800 }}>{instruction.title || "SOS ACTIVATED"}</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, marginTop: 16 }}>Help is on the way.</p>
        <p style={{ color: '#fff', fontSize: 14, marginTop: 40, opacity: 0.8 }}>{instruction.subtitle || "Calculating safest route..."}</p>
      </div>
    );
  }

  return (
    <div className={styles.entryContainer}>
      <div className={styles.header}>
        <div className="flex-center" style={{ gap: '12px', marginBottom: '16px' }}>
          <div className="flex-center" style={{ gap: '4px', fontSize: '10px', color: 'var(--safe-green)', background: 'rgba(52, 199, 89, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
            <Wifi size={12} /> WLAN LOCAL
          </div>
          <div className="flex-center" style={{ gap: '4px', fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 8px', borderRadius: '4px' }}>
            <Compass size={12} /> CALIBRATED
          </div>
        </div>
        <div className="flex-center" style={{ gap: '8px', marginBottom: '8px', color: 'var(--safe-green)' }}>
          <MapPin size={16} /> <span style={{fontSize: 14}}>{userLocation.floor}, {userLocation.corridor}</span>
        </div>
        <h1>Welcome.</h1>
        <p>Emergency System Active</p>
      </div>
      
      <div className={styles.buttonGroup}>
        <button className={`${styles.btn} ${styles.btnSos}`} onClick={handleSosClick}>
          <AlertTriangle size={48} />
          <span>1. SOS</span>
          <span style={{ fontSize: 14, opacity: 0.8, fontWeight: 400 }}>Emergency</span>
        </button>
        
        <button 
            className={`${styles.btn} ${styles.btnMap}`} 
            onClick={() => window.location.href = `/map?nodeId=${userLocation.nodeId}`}
        >
          <Map size={48} color="var(--safe-green)" />
          <span>2. MAP</span>
          <span style={{ fontSize: 14, opacity: 0.8, fontWeight: 400 }}>View Evacuation Route</span>
        </button>
      </div>

      <div style={{ padding: '20px', marginTop: 'auto', borderTop: '1px solid var(--bg-elevated)' }}>
         <div className="flex-center" style={{ gap: '12px', justifyContent: 'space-between', opacity: 0.6 }}>
            <div className="flex-center" style={{ gap: '6px', fontSize: '11px' }}>
               <Activity size={14} color="var(--safe-green)" /> Motion Sensor Active
            </div>
            <div style={{ fontSize: '11px' }}>v2.4-LOCAL</div>
         </div>
      </div>
    </div>
  );
};
