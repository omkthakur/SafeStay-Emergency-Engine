import React, { useState, useEffect } from 'react';
import { Activity, Flame, ShieldAlert, MapPin, ArrowLeft, Heart, Siren } from 'lucide-react';
import styles from './mobile.module.css';
import { useEmergencyEngine } from '../../context/EmergencyContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const SosPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { triggerSOS, engineState, instruction, setInitialNode, pendingIncident } = useEmergencyEngine();
  const [stage, setStage] = useState<'TRIAGE' | 'THREAT_TYPE' | 'CONFIRMING'>('TRIAGE');
  const [selectedType, setSelectedType] = useState<'MEDICAL' | 'THREAT' | null>(null);

  // Auto-transition when staff handles the incident
  useEffect(() => {
    if (stage === 'CONFIRMING' && !pendingIncident) {
      // If we were confirming and the incident is gone, it means staff accepted or rejected it.
      // The text will be driven by the synced 'instruction' state.
    }
  }, [pendingIncident, stage]);

  useEffect(() => {
    const nodeId = searchParams.get('nodeId');
    if (nodeId) {
      setInitialNode(nodeId);
    }
  }, [searchParams, setInitialNode]);

  const handleTriage = (type: 'MEDICAL' | 'THREAT') => {
    setSelectedType(type);
    if (type === 'MEDICAL') {
      setStage('CONFIRMING');
      triggerSOS('MEDICAL');
    } else {
      setStage('THREAT_TYPE');
    }
  };

  const handleThreat = (subtype: string) => {
    setSelectedType('THREAT');
    setStage('CONFIRMING');
    triggerSOS('THREAT', subtype);
  };

  useEffect(() => {
    if (engineState === 'EVACUATING' && selectedType !== 'MEDICAL') {
      navigate('/map');
    }
  }, [engineState, navigate, selectedType]);

  if (stage === 'CONFIRMING') {
    const isMedical = selectedType === 'MEDICAL';
    return (
      <div className={styles.entryContainer} style={{ 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: isMedical ? '#38bdf8' : '#ef4444',
        padding: 40,
        textAlign: 'center'
      }}>
        {isMedical ? <Heart size={80} color="#000" style={{ animation: 'pulse 1s infinite' }} /> : <Siren size={80} color="#fff" style={{ animation: 'pulse 1s infinite' }} />}
        <h1 style={{ color: isMedical ? '#000' : '#fff', fontSize: 42, fontWeight: 900, marginTop: 30 }}>{instruction.title || "REPORT SENT"}</h1>
        <p style={{ color: isMedical ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)', fontSize: 20, marginTop: 20 }}>{instruction.subtitle || "Awaiting staff response..."}</p>
        
        <div style={{ marginTop: 60, padding: 20, background: 'rgba(255,255,255,0.1)', borderRadius: 16 }}>
             <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>AI GUIDANCE</p>
             <p style={{ fontSize: 16, fontWeight: 600 }}>Stay calm. Help is being dispatched based on your current location.</p>
        </div>

        <button 
            onClick={() => navigate('/')}
            style={{ marginTop: 'auto', background: 'none', border: 'none', color: isMedical ? '#000' : '#fff', opacity: 0.6, fontWeight: 800 }}
        >CANCEL REQUEST</button>
      </div>
    );
  }

  return (
    <div className={styles.entryContainer} style={{ padding: '30px 20px' }}>
      <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 30 }}>
        <ArrowLeft size={20} /> BACK
      </button>

      {stage === 'TRIAGE' ? (
        <>
          <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 10 }}>Emergency</h1>
          <p style={{ color: '#94a3b8', marginBottom: 40 }}>Select the type of emergency for immediate aid.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <button 
              className={styles.btn} 
              style={{ background: '#38bdf8', color: '#000', height: 160, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 15 }} 
              onClick={() => handleTriage('MEDICAL')}
            >
              <Heart size={48} fill="currentColor" />
              <span style={{ fontSize: 28, fontWeight: 900 }}>MEDICAL</span>
              <span style={{ fontSize: 14, opacity: 0.7 }}>Accident, injury, or health crisis</span>
            </button>

            <button 
              className={styles.btn} 
              style={{ background: '#ef4444', color: '#fff', height: 160, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 15 }} 
              onClick={() => handleTriage('THREAT')}
            >
              <ShieldAlert size={48} fill="currentColor" />
              <span style={{ fontSize: 28, fontWeight: 900 }}>SECURITY THREAT</span>
              <span style={{ fontSize: 14, opacity: 0.7 }}>Fire, violence, or danger</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 10 }}>Specify Threat</h1>
          <p style={{ color: '#94a3b8', marginBottom: 40 }}>This helps the AI analyze CCTV faster.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            <button className={styles.btn} style={{ background: '#1e293b', height: 140 }} onClick={() => handleThreat('Fire')}>
              <Flame size={32} color="#ef4444" />
              <span style={{ marginTop: 10, fontWeight: 800 }}>FIRE</span>
            </button>
            <button className={styles.btn} style={{ background: '#1e293b', height: 140 }} onClick={() => handleThreat('Violence')}>
              <ShieldAlert size={32} color="#ef4444" />
              <span style={{ marginTop: 10, fontWeight: 800 }}>VIOLENCE</span>
            </button>
            <button className={styles.btn} style={{ background: '#1e293b', height: 140 }} onClick={() => handleThreat('Suspicious')}>
              <Activity size={32} color="#38bdf8" />
              <span style={{ marginTop: 10, fontWeight: 800 }}>SUSPICIOUS</span>
            </button>
            <button className={styles.btn} style={{ background: '#1e293b', height: 140 }} onClick={() => handleThreat('Theft')}>
              <MapPin size={32} color="#38bdf8" />
              <span style={{ marginTop: 10, fontWeight: 800 }}>THEFT</span>
            </button>
          </div>
          <button 
            style={{ background: 'none', border: 'none', color: '#94a3b8', marginTop: 40, width: '100%', fontWeight: 700 }} 
            onClick={() => setStage('TRIAGE')}
          >
            CHANGE CATEGORY
          </button>
        </>
      )}
    </div>
  );
};
