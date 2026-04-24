import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const SearchableSelect = ({ options, value, onChange, placeholder = "Search or select..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [displayAll, setDisplayAll] = useState(false);
  const [search, setSearch] = useState(value || '');
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const updatePosition = () => {
      if (isOpen && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setDropdownStyle({
          position: 'fixed',
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          maxHeight: '220px',
          zIndex: 99999
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true); // true for capture phase to catch scroll events on any parent

    if (isOpen) updatePosition();

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const filteredOptions = displayAll 
    ? options 
    : options.filter(opt => (opt || '').toLowerCase().includes((search || '').toLowerCase()));

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
            setDisplayAll(false);
          }}
          onFocus={(e) => {
             setIsOpen(true);
             setDisplayAll(true);
             e.target.select();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (filteredOptions.length > 0) {
                const opt = filteredOptions[0];
                setSearch(opt);
                onChange(opt);
                setIsOpen(false);
              } else {
                setIsOpen(false);
              }
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          style={{ width: '100%', padding: '0.5rem 2.2rem 0.5rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--c-border)', borderRadius: '4px', backgroundColor: 'var(--c-bg-card)' }}
        />
        <div 
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setDisplayAll(true);
          }}
          style={{ position: 'absolute', right: '0', top: '0', bottom: '0', width: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronDown size={14} style={{ color: 'var(--c-text-secondary)' }} />
        </div>
      </div>
      
      {isOpen && createPortal(
        <div ref={dropdownRef} className="card" style={{ 
          ...dropdownStyle,
          padding: 0, overflowY: 'auto', background: 'var(--c-bg-card)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)', border: '1px solid var(--c-border)'
        }}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, i) => (
              <div 
                key={i} 
                onClick={() => {
                  setSearch(opt);
                  onChange(opt);
                  setIsOpen(false);
                }}
                style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', cursor: 'pointer', borderBottom: '1px solid var(--c-border)', transition: 'background 0.1s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-bg)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {opt}
              </div>
            ))
          ) : (
            <div style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--c-text-secondary)', textAlign: 'center' }}>
              Press Enter to use '{search}'
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default SearchableSelect;
