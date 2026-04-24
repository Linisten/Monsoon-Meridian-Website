import React, { useState, useRef, useEffect } from 'react';
import Barcode from 'react-barcode';
import { 
  Printer, Settings2, CheckCircle2, AlertCircle, 
  Plus, Trash2, Layout, Image as ImageIcon, 
  Type, Move, Maximize2, Sparkles
} from 'lucide-react';
import { printLabels, checkPrintServer } from '../utils/printService';

const BarcodeGenerator = () => {
  const [barcodeValue, setBarcodeValue] = useState('1234567890');
  const [productName, setProductName] = useState('Premium Coffee 250g');
  const [price, setPrice] = useState('150.00');
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [serverStatus, setServerStatus] = useState({ online: false, checking: true });
  
  // ─── CUSTOM/ADVANCED DESIGNER STATE ──────────────────────────────────────
  const [labelMode, setLabelMode] = useState('standard'); // 'standard', 'custom', 'advanced'
  const [customFields, setCustomFields] = useState(() => {
    const saved = localStorage.getItem('mm_custom_fields');
    return saved ? JSON.parse(saved) : [
      { id: 1, text: 'PRODUCT NAME', x: 2, y: 5, size: 14, bold: true },
      { id: 2, text: 'BATCH: B123', x: 2, y: 12, size: 10, bold: false }
    ];
  });
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [customHeight, setCustomHeight] = useState(() => parseInt(localStorage.getItem('mm_custom_height')) || 20); 
  const [customWidth, setCustomWidth] = useState(75); 
  const [labelsPerRow, setLabelsPerRow] = useState(() => parseInt(localStorage.getItem('mm_labels_per_row')) || 1); 
  
  const [bgImage, setBgImage] = useState(localStorage.getItem('mm_label_template') || null);
  const [draggingFieldId, setDraggingFieldId] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // A4 Support State
  const [printTarget, setPrintTarget] = useState('pos'); // 'pos' or 'a4'
  const [a4Settings, setA4Settings] = useState({ cols: 3, rows: 8, gapX: 2, gapY: 0 });

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const mmToPx = 3.2; // Scale for preview
  const PREVIEW_SCALE = 1.5; // Scale applied in CSS transform

  // Persist settings
  useEffect(() => {
    localStorage.setItem('mm_custom_fields', JSON.stringify(customFields));
  }, [customFields]);

  useEffect(() => {
    localStorage.setItem('mm_custom_height', customHeight);
  }, [customHeight]);

  useEffect(() => {
    localStorage.setItem('mm_labels_per_row', labelsPerRow);
  }, [labelsPerRow]);

  useEffect(() => {
    const checkStatus = async () => {
      const status = await checkPrintServer();
      setServerStatus({ online: status.online, checking: false });
    };
    checkStatus();
  }, []);

  const formatItemName = (name) => {
    const max = 22; 
    if (name.length <= max) return name;
    return name.substring(0, max - 10) + "..." + name.slice(-7);
  };

  const handleAddField = () => {
    const newField = { 
      id: Date.now(), 
      text: 'NEW TEXT', 
      x: 5, 
      y: (customFields.length * 5) + 5, 
      size: 10, 
      bold: false 
    };
    setCustomFields([...customFields, newField]);
    setActiveFieldId(newField.id);
  };

  const updateField = (id, key, val) => {
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));
  };

  const removeField = (id) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
    if (activeFieldId === id) setActiveFieldId(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        const base64 = re.target.result;
        setBgImage(base64);
        localStorage.setItem('mm_label_template', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // ─── DRAG LOGIC (Fixed for Scale) ──────────────────────────────────────────
  const handleMouseDown = (e, id) => {
    if (labelMode === 'standard') return;
    e.stopPropagation();
    setDraggingFieldId(id);
    setActiveFieldId(id);
    const field = customFields.find(f => f.id === id);
    setDragStart({ 
      offsetX: e.clientX - (field.x * mmToPx * PREVIEW_SCALE), 
      offsetY: e.clientY - (field.y * mmToPx * PREVIEW_SCALE) 
    });
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (draggingFieldId === null) return;
      const newX = (e.clientX - dragStart.offsetX) / (mmToPx * PREVIEW_SCALE);
      const newY = (e.clientY - dragStart.offsetY) / (mmToPx * PREVIEW_SCALE);
      
      // Bounds check based on labels per row
      const maxWidthMm = labelsPerRow === 2 ? 37 : (labelMode === 'advanced' ? customWidth : 75);
      const clampedX = Math.max(0, Math.min(newX, maxWidthMm - 2));
      const clampedY = Math.max(0, Math.min(newY, customHeight - 2));
      
      updateField(draggingFieldId, 'x', clampedX);
      updateField(draggingFieldId, 'y', clampedY);
    };

    const handleGlobalMouseUp = () => setDraggingFieldId(null);

    if (draggingFieldId !== null) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingFieldId, dragStart, labelsPerRow, labelMode, customWidth, customHeight]);

  // ─── KEYBOARD NAVIGATION ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!activeFieldId || labelMode === 'standard') return;
      
      // Don't move if user is typing in an input field
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
      if (isInput) return;

      const step = e.shiftKey ? 5.0 : 1.0; // mm per keypress (Shift for fast move)
      let dx = 0;
      let dy = 0;

      switch (e.key) {
        case 'ArrowLeft': dx = -step; break;
        case 'ArrowRight': dx = step; break;
        case 'ArrowUp': dy = -step; break;
        case 'ArrowDown': dy = step; break;
        default: return; // Exit for other keys
      }

      e.preventDefault(); // Prevent page scroll

      setCustomFields(prev => prev.map(f => {
        if (f.id === activeFieldId) {
          // Calculate max bounds based on mode and target
          const colWidthMm = (75 - (labelsPerRow - 1)) / labelsPerRow;
          const currentLabelWidth = printTarget === 'a4' 
            ? (labelMode === 'advanced' ? customWidth : 75)
            : (labelsPerRow === 1 ? (labelMode === 'advanced' ? customWidth : 75) : colWidthMm);

          const newX = Math.max(0, Math.min(f.x + dx, currentLabelWidth - 2));
          const newY = Math.max(0, Math.min(f.y + dy, customHeight - 2));
          
          return { ...f, x: newX, y: newY };
        }
        return f;
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFieldId, labelMode, labelsPerRow, customWidth, customHeight, printTarget]);

  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const scale = 2; // Optimal balance for quality and payload size (Reduced from 3)
      
      const dotsPerMm = 8;
      const totalWidthMm = labelMode === 'advanced' ? customWidth : 75;
      const widthPx = Math.floor(totalWidthMm * dotsPerMm); 
      const heightPx = Math.floor(customHeight * dotsPerMm);
      
      canvas.width = widthPx * scale;
      canvas.height = heightPx * scale;
      ctx.scale(scale, scale);

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, widthPx, heightPx);

      if (labelMode === 'standard') {
        const svgElement = document.querySelector('.printable-sticker svg');
        if (!svgElement) throw new Error('Preview Barcode not found');
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const barcodeImg = new Image();
        await new Promise((res, rej) => { barcodeImg.onload = res; barcodeImg.onerror = rej; barcodeImg.src = svgUrl; });

        const drawLabel = (x) => {
          const sw = 37 * dotsPerMm; const sh = 20 * dotsPerMm;
          const safetyY = 8; // 1mm safety buffer
          ctx.fillStyle = 'black'; ctx.textAlign = 'center';
          ctx.font = 'bold 15px Arial';
          ctx.fillText(formatItemName(productName.toUpperCase()), x + sw/2, 24 + safetyY);
          const bW = 34 * dotsPerMm; const bH = 11 * dotsPerMm;
          ctx.drawImage(barcodeImg, x + (sw - bW)/2, 34 + safetyY, bW, bH);
          ctx.font = 'bold 20px Arial';
          ctx.fillText(`Rs ${price}`, x + sw/2, sh - 8 + safetyY);
        }
        drawLabel(0);
        drawLabel(38 * dotsPerMm);
        URL.revokeObjectURL(svgUrl);
      } else {
        // Custom & Advanced Mode
        const colWidthMm = (75 - (labelsPerRow - 1)) / labelsPerRow;
        const colWidthPx = colWidthMm * dotsPerMm;

        // Load background if needed
        let bgImgReady = null;
        if (labelMode === 'advanced' && bgImage) {
          bgImgReady = new Image();
          await new Promise((res) => { bgImgReady.onload = res; bgImgReady.src = bgImage; });
        }

        const drawFieldsAt = (offsetX) => {
          const safetyY = 1.0 * dotsPerMm; // 1mm safety margin for physical printers
          // 1. Draw background first
          if (bgImgReady) {
            ctx.drawImage(bgImgReady, offsetX, safetyY, colWidthPx, heightPx);
          }

          // 2. Overlay text
          ctx.fillStyle = 'black';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          customFields.forEach(f => {
            ctx.font = `${f.bold ? 'bold' : ''} ${f.size * 1.2}pt Arial`;
            ctx.fillText(f.text, (f.x * dotsPerMm) + offsetX, (f.y * dotsPerMm) + safetyY);
          });
        };

        for (let i = 0; i < labelsPerRow; i++) {
          const offsetX = i * (colWidthMm + 1) * dotsPerMm;
          drawFieldsAt(offsetX);
        }
      }

      const imageData = canvas.toDataURL('image/jpeg', 0.9);

      if (printTarget === 'pos') {
        const numRows = Math.ceil(copies / labelsPerRow);
        const result = await printLabels([imageData], numRows);
        if (!result.success) alert('Print server error: ' + result.error);
      } else {
        // A4 Printing via Browser
        const printWindow = window.open('', '_blank');
        const labelsCount = a4Settings.cols * a4Settings.rows;
        
        const labelHtml = `
          <div style="
            width: ${(labelMode === 'advanced' ? customWidth : 75)}mm; 
            height: ${customHeight}mm; 
            position: relative; 
            overflow: hidden;
            background: white;
          ">
            <img src="${imageData}" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
        `;

        printWindow.document.write(`
          <html>
            <head>
              <title>Print Labels - A4</title>
              <style>
                @page { size: A4; margin: 10mm; }
                body { margin: 0; padding: 0; }
                .grid { 
                  display: grid; 
                  grid-template-columns: repeat(${a4Settings.cols}, 1fr); 
                  gap: ${a4Settings.gapY}mm ${a4Settings.gapX}mm;
                  justify-items: center;
                }
                @media print {
                  .no-print { display: none; }
                }
              </style>
            </head>
            <body onload="window.print(); window.close();">
              <div class="grid">
                ${Array(parseInt(copies)).fill(labelHtml).join('')}
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (err) {
      console.error('Print Error:', err);
      alert('Printing failed: ' + err.message);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div 
      style={{ padding: '1.2rem', height: '100%', overflowY: 'auto', background: '#f1f5f9', userSelect: draggingFieldId ? 'none' : 'auto' }}
    >
      <style>{`
        .design-station-container {
          max-width: 1600px;
          margin: 0 auto;
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .glass-panel {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
          border-radius: 1.5rem;
          padding: 1.5rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .glass-panel:hover {
          background: rgba(255, 255, 255, 0.8);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
          transform: translateY(-2px);
        }

        .segmented-control {
          background: #e2e8f0;
          padding: 4px;
          border-radius: 12px;
          display: inline-flex;
          gap: 4px;
          border: 1px solid #cbd5e1;
        }

        .mode-btn {
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          background: transparent;
        }

        .mode-btn.active {
          background: white;
          color: #1e293b;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .mode-btn:not(.active):hover {
          background: rgba(255, 255, 255, 0.5);
          color: #1e293b;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          padding: 0.5rem 1rem;
          border-radius: 99px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          font-size: 0.75rem;
          font-weight: 700;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          position: relative;
        }

        .pulse-dot::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: inherit;
          animation: pulse 2s infinite;
          opacity: 0.6;
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        .studio-viewport {
          background: radial-gradient(circle at center, #334155 0%, #0f172a 100%);
          border-radius: 2rem;
          padding: 4rem;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 500px;
          box-shadow: inset 0 4px 20px rgba(0, 0, 0, 0.4);
          position: relative;
          overflow: hidden;
        }

        .studio-viewport::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 30px 30px;
          pointer-events: none;
        }

        .designer-canvas {
          background: white;
          position: relative;
          box-shadow: 0 30px 60px rgba(0,0,0,0.5);
          overflow: hidden;
          cursor: crosshair;
          transition: transform 0.3s ease;
        }

        .drag-field {
          position: absolute;
          cursor: move;
          white-space: nowrap;
          padding: 2px 4px;
          border: 1px solid transparent;
          border-radius: 6px;
          transition: background 0.2s, border-color 0.2s;
        }

        .drag-field:hover {
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(59, 130, 246, 0.05);
        }

        .drag-field.active {
          border-color: #2563eb;
          background: rgba(37, 99, 235, 0.1);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
          z-index: 50;
        }

        .overlay-item-card {
          padding: 1rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          transition: all 0.2s;
          cursor: pointer;
        }

        .overlay-item-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          transform: translateX(4px);
        }

        .overlay-item-card.active {
          border-color: #2563eb;
          border-width: 2px;
          background: #f8fafc;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .input-group label {
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .input-group input {
          padding: 0.75rem 1rem;
          font-size: 0.9rem;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          font-weight: 600;
          transition: all 0.2s;
        }

        .input-group input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .btn-add-field {
          background: #1e293b;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-add-field:hover {
          background: #334155;
          transform: translateY(-1px);
        }

        .print-btn {
          background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
          color: white;
          border: none;
          padding: 1.25rem;
          border-radius: 1rem;
          font-weight: 800;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 10px 20px -5px rgba(234, 88, 12, 0.4);
        }

        .print-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px -5px rgba(234, 88, 12, 0.5);
          filter: brightness(1.1);
        }

        .print-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .print-btn:disabled {
          background: #94a3b8;
          box-shadow: none;
          cursor: not-allowed;
        }
      `}</style>

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.04em', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Sparkles style={{ color: '#f97316' }} size={32} /> Design Station
            </h1>
            <div className="segmented-control" style={{ marginTop: '1rem' }}>
              <button onClick={() => setLabelMode('standard')} className={`mode-btn ${labelMode === 'standard' ? 'active' : ''}`}>
                <Layout size={16} /> Standard
              </button>
              <button onClick={() => setLabelMode('custom')} className={`mode-btn ${labelMode === 'custom' ? 'active' : ''}`}>
                <Settings2 size={16} /> Designer
              </button>
              <button onClick={() => setLabelMode('advanced')} className={`mode-btn ${labelMode === 'advanced' ? 'active' : ''}`}>
                <ImageIcon size={16} /> Advanced (Image)
              </button>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="segmented-control">
              <button onClick={() => setPrintTarget('pos')} className={`mode-btn ${printTarget === 'pos' ? 'active' : ''}`} title="Thermal Printer">
                <Printer size={16} /> POS
              </button>
              <button onClick={() => setPrintTarget('a4')} className={`mode-btn ${printTarget === 'a4' ? 'active' : ''}`} title="Standard A4 Printer">
                <Layout size={16} /> A4
              </button>
            </div>

            <div className="status-badge">
              <div className="pulse-dot" style={{ background: serverStatus.online ? '#10b981' : '#ef4444' }} />
              <span style={{ color: '#1e293b' }}>{serverStatus.online ? 'Printer Live' : 'Server Down'}</span>
            </div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
          
          {/* LEFT: SETTINGS */}
          <section className="glass-panel" style={{ height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {labelMode === 'standard' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="input-group">
                  <label><Type size={14} /> Barcode Value</label>
                  <input type="text" value={barcodeValue} onChange={e => setBarcodeValue(e.target.value)} placeholder="Enter barcode..." />
                </div>
                <div className="input-group">
                  <label><Layout size={14} /> Product Name</label>
                  <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Enter product name..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label>Price</label>
                    <input type="text" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="input-group">
                    <label>Copies</label>
                    <input type="number" value={copies} onChange={e => setCopies(e.target.value)} min="1" />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b' }}>Label Layout</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label>Labels / Row</label>
                      <input 
                        type="number" 
                        min="1" max="10" 
                        value={labelsPerRow} 
                        onChange={e => setLabelsPerRow(Math.max(1, parseInt(e.target.value) || 1))} 
                      />
                    </div>
                    <div className="input-group">
                      <label>Height (mm)</label>
                      <input 
                        type="number" 
                        min="5" max="150" 
                        value={customHeight} 
                        onChange={e => setCustomHeight(parseInt(e.target.value) || 20)} 
                      />
                    </div>
                  </div>

                  {labelMode === 'advanced' && (
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      style={{ 
                        width: '100%', marginTop: '1rem', padding: '1rem', border: '2px dashed #3b82f6', 
                        background: 'rgba(59,130,246,0.03)', color: '#3b82f6', fontWeight: 700, borderRadius: '12px', 
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' 
                      }}
                    >
                      <ImageIcon size={18} /> {bgImage ? 'Change Template' : 'Upload Template'}
                    </button>
                  )}

                  {printTarget === 'a4' && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                      <h3 style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.75rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layout size={14} /> A4 Grid Settings
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="input-group">
                          <label>Columns</label>
                          <input type="number" value={a4Settings.cols} onChange={e => setA4Settings({...a4Settings, cols: parseInt(e.target.value) || 1})} />
                        </div>
                        <div className="input-group">
                          <label>Gap (mm)</label>
                          <input type="number" value={a4Settings.gapX} onChange={e => setA4Settings({...a4Settings, gapX: parseInt(e.target.value) || 0})} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Text Overlays</h3>
                    <button onClick={handleAddField} className="btn-add-field">
                      <Plus size={14} /> Add Text
                    </button>
                  </div>
                  
                  <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '2px' }}>
                    {customFields.map(f => (
                      <div 
                        key={f.id} 
                        onClick={() => setActiveFieldId(f.id)} 
                        className={`overlay-item-card ${activeFieldId === f.id ? 'active' : ''}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <input 
                            value={f.text} 
                            onChange={e => updateField(f.id, 'text', e.target.value)} 
                            style={{ border: 'none', background: 'transparent', fontWeight: 700, padding: 0, width: '80%', fontSize: '0.85rem', color: '#1e293b' }} 
                          />
                          <button onClick={(e) => { e.stopPropagation(); removeField(f.id); }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Size</span>
                            <input type="number" value={f.size} onChange={e => updateField(f.id, 'size', parseInt(e.target.value))} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: '50px', borderRadius: '6px' }} />
                          </div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#475569' }}>
                            <input type="checkbox" checked={f.bold} onChange={e => updateField(f.id, 'bold', e.target.checked)} style={{ width: '14px', height: '14px' }} /> Bold
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label>Print Copies</label>
                  <input type="number" value={copies} onChange={e => setCopies(e.target.value)} min="1" />
                </div>
              </div>
            )}

            <button onClick={handlePrint} disabled={isPrinting} className="print-btn">
              {isPrinting ? (
                <>Preparing Output...</>
              ) : (
                <><Printer size={20} /> Print {copies} Labels Now</>
              )}
            </button>
          </section>

          {/* RIGHT: PREVIEW */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: printTarget === 'a4' ? '#10b981' : '#3b82f6' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {printTarget === 'a4' ? 'A4 Sheet Preview' : `Live Roll Preview (${labelsPerRow} Col)`}
                  </span>
                </div>
                <div style={{ background: '#dbeafe', color: '#1e40af', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Maximize2 size={14} /> {(labelMode === 'advanced' ? customWidth : 75)}mm × {(labelMode === 'standard' ? 20 : customHeight)}mm
                </div>
            </div>
            
            <div className="studio-viewport" style={{ 
              background: printTarget === 'a4' ? '#94a3b8' : undefined,
              boxShadow: printTarget === 'a4' ? 'inset 0 0 100px rgba(0,0,0,0.2)' : undefined,
              overflow: 'auto',
              padding: printTarget === 'a4' ? '2rem' : '4rem'
            }}>
              {printTarget === 'a4' ? (
                <div style={{ 
                  width: '210mm', 
                  minHeight: '297mm', 
                  background: 'white', 
                  padding: '10mm', 
                  boxShadow: '0 40px 100px rgba(0,0,0,0.4)',
                  display: 'grid',
                  gridTemplateColumns: `repeat(${a4Settings.cols}, 1fr)`,
                  gap: `${a4Settings.gapY}mm ${a4Settings.gapX}mm`,
                  transform: 'scale(0.8)', // Increased scale for better visibility
                  transformOrigin: 'top center',
                  marginBottom: '-60mm', // Adjusted offset
                  margin: '0 auto'
                }}>
                   {Array.from({ length: a4Settings.cols * 15 }).map((_, idx) => (
                    <div 
                      key={idx}
                      style={{ 
                        width: (labelMode === 'advanced' ? customWidth : 75) * mmToPx, 
                        height: customHeight * mmToPx,
                        background: (labelMode === 'advanced' && bgImage) ? `url(${bgImage})` : 'white', 
                        backgroundSize: '100% 100%',
                        position: 'relative', 
                        overflow: 'hidden',
                        border: idx === 0 ? '1px dashed #3b82f6' : '1px solid #f1f5f9'
                      }}
                    >
                      {customFields.map(f => (
                        <div 
                          key={f.id} 
                          className={`drag-field ${activeFieldId === f.id ? 'active' : ''}`} 
                          onMouseDown={idx === 0 ? (e) => handleMouseDown(e, f.id) : undefined} 
                          style={{ 
                            left: f.x * mmToPx, 
                            top: f.y * mmToPx, 
                            fontSize: `${f.size}px`, 
                            fontWeight: f.bold ? 700 : 400,
                            pointerEvents: idx === 0 ? 'auto' : 'none',
                            opacity: idx === 0 ? 1 : 0.3
                          }}
                        >
                          {f.text}
                        </div>
                      ))}
                      {idx === 0 && (
                         <div style={{ position: 'absolute', bottom: 4, right: 4, fontSize: '7px', color: 'white', fontWeight: 900, background: '#3b82f6', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Editor</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {labelMode === 'standard' ? (
                    <div style={{ 
                      width: 75 * mmToPx, 
                      height: 20 * mmToPx, 
                      background: 'white', 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1px 1fr', 
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                      transform: 'scale(1.5)',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      {[0, 1].map(i => (
                        <React.Fragment key={i}>
                          {i === 1 && <div style={{ background: '#f1f5f9' }} />}
                          <div className="printable-sticker" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '6px' }}>
                            <div style={{ fontSize: '7px', fontWeight: 800, color: '#1e293b', textAlign: 'center' }}>{formatItemName(productName.toUpperCase())}</div>
                            <div style={{ transform: 'scale(0.7)' }}><Barcode value={barcodeValue || 'VOID'} width={1.2} height={25} fontSize={10} margin={0} /></div>
                            <div style={{ fontSize: '9px', fontWeight: 900, color: '#1e293b' }}>Rs {price}</div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div 
                        className="designer-canvas" 
                        style={{ 
                            width: (labelMode === 'advanced' ? customWidth : 75) * mmToPx, 
                            height: customHeight * mmToPx,
                            display: 'grid',
                            gridTemplateColumns: `repeat(${labelsPerRow}, 1fr)`,
                            gap: '0.5mm',
                            background: '#e2e8f0',
                            transform: 'scale(1.5)',
                        }}
                    >
                      {Array.from({ length: labelsPerRow }).map((_, idx) => (
                        <div 
                          key={idx}
                          style={{ 
                            background: (labelMode === 'advanced' && bgImage) ? `url(${bgImage})` : 'white', 
                            backgroundSize: '100% 100%',
                            position: 'relative', 
                            height: '100%', 
                            overflow: 'hidden',
                            border: idx === 0 ? '1px dashed #3b82f6' : 'none'
                          }}
                        >
                          {customFields.map(f => (
                            <div 
                              key={f.id} 
                              className={`drag-field ${activeFieldId === f.id ? 'active' : ''}`} 
                              onMouseDown={idx === 0 ? (e) => handleMouseDown(e, f.id) : undefined} 
                              style={{ 
                                left: f.x * mmToPx, 
                                top: f.y * mmToPx, 
                                fontSize: `${f.size}px`, 
                                fontWeight: f.bold ? 700 : 400,
                                pointerEvents: idx === 0 ? 'auto' : 'none',
                                opacity: idx === 0 ? 1 : 0.4
                              }}
                            >
                              {f.text}
                            </div>
                          ))}
                          {idx === 0 && labelsPerRow > 1 && (
                            <div style={{ position: 'absolute', bottom: 4, right: 4, fontSize: '7px', color: 'white', fontWeight: 900, background: '#3b82f6', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Editor</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1.5rem' }}>
              <div className="glass-panel" style={{ flex: 1, padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '0.75rem', borderRadius: '12px' }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.4rem' }}>Designer Tip</h4>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
                    {labelMode === 'advanced' 
                      ? "Upload your high-res template. Changes to the first column are mirrored instantly across the entire roll width."
                      : "The preview represents your 75mm thermal roll. Adjust columns to match your physical sticker layout."}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default BarcodeGenerator;
