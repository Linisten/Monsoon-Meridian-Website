import React, { createContext, useContext, useState } from 'react';
import { AlertCircle, HelpCircle, CheckCircle } from 'lucide-react';

const ConfirmContext = createContext();

export const ConfirmProvider = ({ children }) => {
  const [config, setConfig] = useState(null);

  const confirm = (options) => {
    return new Promise((resolve) => {
      setConfig({
        ...options,
        resolve,
      });
    });
  };

  const alert = (message, type = 'success') => {
    return new Promise((resolve) => {
      setConfig({
        message,
        type,
        isAlert: true,
        title: type === 'success' ? 'Success!' : 'Notification',
        confirmText: 'OK',
        resolve,
      });
    });
  };

  const handleClose = (res) => {
    config.resolve(res);
    setConfig(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      {config && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'white',
            width: '100%',
            maxWidth: '400px',
            borderRadius: '24px',
            padding: '2.5rem 2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            textAlign: 'center',
            animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: config.type === 'danger' || config.type === 'error' ? '#fee2e2' : (config.type === 'success' ? '#f0fdf4' : '#dbeafe'),
              color: config.type === 'danger' || config.type === 'error' ? '#ef4444' : (config.type === 'success' ? '#10b981' : '#3b82f6'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
            }}>
              {config.type === 'success' ? <CheckCircle size={40} /> : (config.type === 'danger' || config.type === 'error' ? <AlertCircle size={40} /> : <HelpCircle size={40} />)}
            </div>
            
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.75rem' }}>
              {config.title || 'Notification'}
            </h3>
            
            <p style={{ color: '#475569', lineHeight: 1.6, fontSize: '1.05rem', marginBottom: '2.5rem' }}>
              {config.message}
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
              {!config.isAlert && (
                <button
                  onClick={() => handleClose(false)}
                  style={{
                    flex: 1,
                    padding: '0.85rem',
                    borderRadius: '14px',
                    border: '2px solid #e2e8f0',
                    background: 'white',
                    color: '#64748b',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {config.cancelText || 'Cancel'}
                </button>
              )}
              <button
                onClick={() => handleClose(true)}
                style={{
                  flex: 1,
                  padding: '0.85rem',
                  borderRadius: '14px',
                  border: 'none',
                  background: (config.type === 'danger' || config.type === 'error') ? '#ef4444' : (config.type === 'success' ? '#10b981' : '#3b82f6'),
                  color: 'white',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s'
                }}
              >
                {config.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
          `}</style>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => useContext(ConfirmContext);
