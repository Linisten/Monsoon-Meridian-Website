import React, { useState, useRef, useEffect } from 'react';
import Barcode from 'react-barcode';
import { 
  Printer, Settings2, CheckCircle2, AlertCircle, 
  Plus, Trash2, Layout, Image as ImageIcon, 
  Type, Move, Maximize2, Sparkles, RotateCw
} from 'lucide-react';
import { printLabels, checkPrintServer } from '../utils/printService';

const BarcodeGenerator = () => {
  const [barcodeValue, setBarcodeValue] = useState('1234567890');
  const [productName, setProductName] = useState('Premium Coffee 250g');
  const [price, setPrice] = useState('150.00');
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [serverStatus, setServerStatus] = useState({ online: false, checking: true });
  
  // ─── MODE-SPECIFIC CONFIGURATION ──────────────────────────────────────
  const [labelMode, setLabelMode] = useState('standard'); 

  // --- STANDARD MODE SETTINGS ---
  const [standardDpi, setStandardDpi] = useState(203);
  const [standardOffset, setStandardOffset] = useState({ x: 0, y: 0 });
  const [standardHeight, setStandardHeight] = useState(() => parseInt(localStorage.getItem('mm_standard_height_std')) || 25);
  const [standardWidth, setStandardWidth] = useState(() => parseInt(localStorage.getItem('mm_standard_width')) || 75);
  const [standardLpr, setStandardLpr] = useState(() => parseInt(localStorage.getItem('mm_standard_lpr')) || 2);
  const [standardBarcodeWidth, setStandardBarcodeWidth] = useState(() => parseFloat(localStorage.getItem('mm_standard_bc_w')) || 1.0);
  const [standardBarcodeHeight, setStandardBarcodeHeight] = useState(() => parseInt(localStorage.getItem('mm_standard_bc_h')) || 30);
  const [standardNameSize, setStandardNameSize] = useState(() => parseInt(localStorage.getItem('mm_standard_name_s')) || 10);
  const [standardPriceSize, setStandardPriceSize] = useState(() => parseInt(localStorage.getItem('mm_standard_price_s')) || 12);
  const [standardScale, setStandardScale] = useState(() => parseFloat(localStorage.getItem('mm_standard_scale')) || 1.0);
  const [standardGap, setStandardGap] = useState(() => parseInt(localStorage.getItem('mm_standard_gap')) || 4);

  // --- DESIGNER (CUSTOM) STATE ---
  const [designerFields, setDesignerFields] = useState(() => {
    const saved = localStorage.getItem('mm_designer_fields');
    return saved ? JSON.parse(saved) : [
      { id: 'designer_1', text: 'DESIGNER: NAME', x: 2, y: 5, size: 14, bold: true },
    ];
  });
  const [designerHeight, setDesignerHeight] = useState(() => parseInt(localStorage.getItem('mm_designer_height')) || 25);
  const [designerWidth, setDesignerWidth] = useState(() => parseInt(localStorage.getItem('mm_designer_width')) || 75);
  const [designerLpr, setDesignerLpr] = useState(() => parseInt(localStorage.getItem('mm_designer_lpr')) || 1);
  const [designerRotation, setDesignerRotation] = useState(() => parseInt(localStorage.getItem('mm_designer_rot')) || 0);
  const [designerDpi, setDesignerDpi] = useState(() => parseInt(localStorage.getItem('mm_designer_dpi')) || 203);
  const [designerOffset, setDesignerOffset] = useState(() => JSON.parse(localStorage.getItem('mm_designer_offset')) || { x: 0, y: 0 });
  const [designerA4, setDesignerA4] = useState(() => JSON.parse(localStorage.getItem('mm_designer_a4')) || { cols: 3, rows: 8, gapX: 2, gapY: 0 });
  const [designerBgImage, setDesignerBgImage] = useState(localStorage.getItem('mm_designer_bg') || null);
  const [designerBgSettings, setDesignerBgSettings] = useState(() => {
    const saved = localStorage.getItem('mm_designer_bg_settings');
    return saved ? JSON.parse(saved) : { x: 0, y: 0, width: 75, height: 20 };
  });

  const [designerFrame, setDesignerFrame] = useState(() => {
    const saved = localStorage.getItem('mm_designer_frame');
    return saved ? JSON.parse(saved) : { enabled: false, radius: 5, thickness: 1, padding: 1, color: '#000000', width: 75, height: 25, x: 0, y: 0 };
  });

  // --- ADVANCED (IMAGE) STATE ---
  const [advancedFields, setAdvancedFields] = useState(() => {
    const saved = localStorage.getItem('mm_custom_fields'); // Migrate legacy
    return saved ? JSON.parse(saved) : [
      { id: 'advanced_1', text: 'ADVANCED: NAME', x: 2, y: 5, size: 14, bold: true },
    ];
  });
  const [advancedHeight, setAdvancedHeight] = useState(() => parseInt(localStorage.getItem('mm_custom_height')) || 25);
  const [advancedWidth, setAdvancedWidth] = useState(() => parseInt(localStorage.getItem('mm_custom_width')) || 75);
  const [advancedLpr, setAdvancedLpr] = useState(() => parseInt(localStorage.getItem('mm_labels_per_row')) || 1);
  const [advancedRotation, setAdvancedRotation] = useState(() => parseInt(localStorage.getItem('mm_advanced_rot')) || 0);
  const [advancedDpi, setAdvancedDpi] = useState(() => parseInt(localStorage.getItem('mm_advanced_dpi')) || 203);
  const [advancedOffset, setAdvancedOffset] = useState(() => JSON.parse(localStorage.getItem('mm_advanced_offset')) || { x: 0, y: 0 });
  const [advancedA4, setAdvancedA4] = useState(() => JSON.parse(localStorage.getItem('mm_advanced_a4')) || { cols: 3, rows: 8, gapX: 2, gapY: 0 });
  const [advancedBgImage, setAdvancedBgImage] = useState(localStorage.getItem('mm_label_template') || null);
  const [advancedBgSettings, setAdvancedBgSettings] = useState(() => {
    const saved = localStorage.getItem('mm_bg_settings');
    return saved ? JSON.parse(saved) : { x: 0, y: 0, width: 75, height: 20 };
  });

  const [advancedFrame, setAdvancedFrame] = useState(() => {
    const saved = localStorage.getItem('mm_advanced_frame');
    return saved ? JSON.parse(saved) : { enabled: false, radius: 5, thickness: 1, padding: 1, color: '#000000', width: 75, height: 25, x: 0, y: 0 };
  });

  // Active State Accessors (Standard is fixed at 2-col, 38x25mm per sticker)
  const activeFields = labelMode === 'standard' ? [] : (labelMode === 'custom' ? designerFields : advancedFields);
  const setActiveFields = labelMode === 'standard' ? (() => {}) : (labelMode === 'custom' ? setDesignerFields : setAdvancedFields);
  const activeLpr = labelMode === 'standard' ? standardLpr : (labelMode === 'custom' ? designerLpr : advancedLpr);
  const setActiveLpr = labelMode === 'standard' ? setStandardLpr : (labelMode === 'custom' ? setDesignerLpr : setAdvancedLpr);
  const activeHeight = labelMode === 'custom' ? designerHeight : (labelMode === 'standard' ? standardHeight : advancedHeight);
  const setActiveHeight = labelMode === 'custom' ? setDesignerHeight : (labelMode === 'standard' ? setStandardHeight : setAdvancedHeight);
  const activeWidth = labelMode === 'custom' ? designerWidth : (labelMode === 'standard' ? standardWidth : advancedWidth);
  const setActiveWidth = labelMode === 'custom' ? setDesignerWidth : (labelMode === 'standard' ? setStandardWidth : setAdvancedWidth);
  const activeRotation = labelMode === 'custom' ? designerRotation : (labelMode === 'advanced' ? advancedRotation : 0);
  const setActiveRotation = labelMode === 'custom' ? setDesignerRotation : setAdvancedRotation;
  const activeBgImage = labelMode === 'standard' ? null : (labelMode === 'custom' ? designerBgImage : advancedBgImage);
  const setActiveBgImage = labelMode === 'standard' ? (() => {}) : (labelMode === 'custom' ? setDesignerBgImage : setAdvancedBgImage);
  const activeBgSettings = labelMode === 'standard' ? { x: 0, y: 0, width: 75, height: 25 } : (labelMode === 'custom' ? designerBgSettings : advancedBgSettings);
  const setActiveBgSettings = labelMode === 'standard' ? (() => {}) : (labelMode === 'custom' ? setDesignerBgSettings : setAdvancedBgSettings);
  
  const activeDpi = labelMode === 'custom' ? designerDpi : (labelMode === 'standard' ? standardDpi : advancedDpi);
  const setActiveDpi = labelMode === 'custom' ? setDesignerDpi : (labelMode === 'standard' ? setStandardDpi : setAdvancedDpi);
  const activeOffset = labelMode === 'custom' ? designerOffset : (labelMode === 'standard' ? standardOffset : advancedOffset);
  const setActiveOffset = labelMode === 'custom' ? setDesignerOffset : (labelMode === 'standard' ? setStandardOffset : setAdvancedOffset);
  const activeA4 = labelMode === 'custom' ? designerA4 : (labelMode === 'advanced' ? advancedA4 : { cols: 3, rows: 8, gapX: 2, gapY: 0 });
  const setActiveA4 = labelMode === 'custom' ? setDesignerA4 : setAdvancedA4;

  const activeFrame = labelMode === 'custom' ? designerFrame : (labelMode === 'advanced' ? advancedFrame : { enabled: false });
  const setActiveFrame = labelMode === 'custom' ? setDesignerFrame : (labelMode === 'advanced' ? setAdvancedFrame : () => {});

  const [activeFieldId, setActiveFieldId] = useState(null);
  const [draggingFieldId, setDraggingFieldId] = useState(null);
  const [resizeMode, setResizeMode] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // A4 Support State
  const [printTarget, setPrintTarget] = useState('pos'); // 'pos' or 'a4'
  const dotsPerMm = activeDpi / 25.4;

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const mmToPx = 4.4; // Updated to match print scale for perfect WYSIWYG
  const PREVIEW_SCALE = 1.5; // Scale applied in CSS transform

  // Persist settings
  useEffect(() => {
    // Designer
    localStorage.setItem('mm_designer_fields', JSON.stringify(designerFields));
    localStorage.setItem('mm_designer_height', designerHeight);
    localStorage.setItem('mm_designer_width', designerWidth);
    localStorage.setItem('mm_designer_lpr', designerLpr);
    localStorage.setItem('mm_designer_rot', designerRotation);
    localStorage.setItem('mm_designer_dpi', designerDpi);
    localStorage.setItem('mm_designer_offset', JSON.stringify(designerOffset));
    localStorage.setItem('mm_designer_a4', JSON.stringify(designerA4));
    if (designerBgImage) localStorage.setItem('mm_designer_bg', designerBgImage);
    localStorage.setItem('mm_designer_bg_settings', JSON.stringify(designerBgSettings));
    localStorage.setItem('mm_designer_frame', JSON.stringify(designerFrame));

    // Advanced
    localStorage.setItem('mm_custom_fields', JSON.stringify(advancedFields));
    localStorage.setItem('mm_custom_height', advancedHeight);
    localStorage.setItem('mm_custom_width', advancedWidth);
    localStorage.setItem('mm_labels_per_row', advancedLpr);
    localStorage.setItem('mm_advanced_rot', advancedRotation);
    localStorage.setItem('mm_advanced_dpi', advancedDpi);
    localStorage.setItem('mm_advanced_offset', JSON.stringify(advancedOffset));
    localStorage.setItem('mm_advanced_a4', JSON.stringify(advancedA4));
    if (advancedBgImage) localStorage.setItem('mm_label_template', advancedBgImage);
    localStorage.setItem('mm_bg_settings', JSON.stringify(advancedBgSettings));
    localStorage.setItem('mm_advanced_frame', JSON.stringify(advancedFrame));

    // Standard
    localStorage.setItem('mm_standard_width', standardWidth);
    localStorage.setItem('mm_standard_height_std', standardHeight);
    localStorage.setItem('mm_standard_lpr', standardLpr);
    localStorage.setItem('mm_standard_bc_w', standardBarcodeWidth);
    localStorage.setItem('mm_standard_bc_h', standardBarcodeHeight);
    localStorage.setItem('mm_standard_name_s', standardNameSize);
    localStorage.setItem('mm_standard_price_s', standardPriceSize);
    localStorage.setItem('mm_standard_scale', standardScale);
    localStorage.setItem('mm_standard_gap', standardGap);
  }, [designerFields, designerHeight, designerWidth, designerLpr, designerRotation, designerDpi, designerOffset, designerA4, designerBgImage, designerBgSettings,
      advancedFields, advancedHeight, advancedWidth, advancedLpr, advancedRotation, advancedDpi, advancedOffset, advancedA4, advancedBgImage, advancedBgSettings,
      standardWidth, standardHeight, standardLpr, standardBarcodeWidth, standardBarcodeHeight, standardNameSize, standardPriceSize, standardScale, standardGap]);

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
      y: (activeFields.length * 5) + 5, 
      size: 10, 
      bold: false,
      underline: false,
      uThickness: 0.5,
      uOffset: 0.5
    };
    setActiveFields([...activeFields, newField]);
    setActiveFieldId(newField.id);
  };

  const updateField = (id, key, val) => {
    setActiveFields(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));
  };

  const removeField = (id) => {
    setActiveFields(prev => prev.filter(f => f.id !== id));
    if (activeFieldId === id) setActiveFieldId(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        const base64 = re.target.result;
        setActiveBgImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const rotateLabel = (e) => {
    if (e) e.stopPropagation();
    setActiveRotation(prev => (prev + 90) % 360);
  };

  // ─── DRAG LOGIC (Fixed for Scale) ──────────────────────────────────────────
  const handleMouseDown = (e, id, mode = 'move') => {
    if (labelMode === 'standard') return;
    e.stopPropagation();
    setDraggingFieldId(id);
    setActiveFieldId(id);
    setResizeMode(mode === 'resize');
    
    let currentX, currentY, currentW, currentH;
    if (id === 'background') {
      currentX = activeBgSettings.x;
      currentY = activeBgSettings.y;
      currentW = activeBgSettings.width;
      currentH = activeBgSettings.height;
    } else {
      const field = activeFields.find(f => f.id === id);
      currentX = field.x;
      currentY = field.y;
    }

    if (mode === 'resize') {
      setDragStart({ 
        startX: e.clientX, 
        startY: e.clientY,
        startW: currentW,
        startH: currentH
      });
    } else {
      setDragStart({ 
        offsetX: e.clientX - (currentX * mmToPx * PREVIEW_SCALE), 
        offsetY: e.clientY - (currentY * mmToPx * PREVIEW_SCALE) 
      });
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (draggingFieldId === null) return;

      if (resizeMode) {
        const deltaX = (e.clientX - dragStart.startX) / (mmToPx * PREVIEW_SCALE);
        const deltaY = (e.clientY - dragStart.startY) / (mmToPx * PREVIEW_SCALE);
        
        if (draggingFieldId === 'background') {
          setActiveBgSettings(prev => ({
            ...prev,
            width: Math.max(5, dragStart.startW + deltaX),
            height: Math.max(5, dragStart.startH + deltaY)
          }));
        }
        return;
      }

      const newX = (e.clientX - dragStart.offsetX) / (mmToPx * PREVIEW_SCALE);
      const newY = (e.clientY - dragStart.offsetY) / (mmToPx * PREVIEW_SCALE);
      
      // Bounds check based on labels per row
      const maxWidthMm = activeLpr === 2 ? 37 : (labelMode === 'advanced' ? activeWidth : 75);
      const clampedX = Math.max(-50, Math.min(newX, maxWidthMm + 50));
      const clampedY = Math.max(-50, Math.min(newY, activeHeight + 50));
      
      if (draggingFieldId === 'background') {
        setActiveBgSettings(prev => ({ ...prev, x: newX, y: newY }));
      } else {
        updateField(draggingFieldId, 'x', clampedX);
        updateField(draggingFieldId, 'y', clampedY);
      }
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
  }, [draggingFieldId, dragStart, activeLpr, labelMode, activeWidth, activeHeight]);

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

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeFieldId === 'background') {
          setActiveBgImage(null);
          setActiveFieldId(null);
        } else if (activeFieldId) {
          removeField(activeFieldId);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft': dx = -step; break;
        case 'ArrowRight': dx = step; break;
        case 'ArrowUp': dy = -step; break;
        case 'ArrowDown': dy = step; break;
        default: return; // Exit for other keys
      }

      e.preventDefault(); // Prevent page scroll

      setActiveFields(prev => prev.map(f => {
        if (f.id === activeFieldId) {
          // Calculate max bounds based on mode and target
          const colWidthMm = (75 - (activeLpr - 1)) / activeLpr;
          const currentLabelWidth = printTarget === 'a4' 
            ? (labelMode === 'advanced' ? activeWidth : 75)
            : (activeLpr === 1 ? (labelMode === 'advanced' ? activeWidth : 75) : colWidthMm);

          const newX = Math.max(0, Math.min(f.x + dx, currentLabelWidth - 2));
          const newY = Math.max(0, Math.min(f.y + dy, activeHeight - 2));
          
          return { ...f, x: newX, y: newY };
        }
        return f;
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFieldId, labelMode, activeLpr, activeWidth, activeHeight, printTarget, activeDpi, activeOffset, activeA4]);

  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const scale = 1; // 1:1 pixel to dot mapping for exact physical dimensions
      
      const totalWidthMm = activeWidth;
      const widthPx = Math.floor(totalWidthMm * dotsPerMm); 
      const heightPx = Math.floor(activeHeight * dotsPerMm);
      
      canvas.width = widthPx * scale;
      canvas.height = heightPx * scale;
      ctx.scale(scale, scale);

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, widthPx, heightPx);

      const globalOffsetX = activeOffset.x * dotsPerMm;
      const globalOffsetY = activeOffset.y * dotsPerMm;

      if (labelMode === 'standard') {
        const svgElement = document.querySelector('.printable-sticker svg');
        if (!svgElement) throw new Error('Preview Barcode not found');
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const barcodeImg = new Image();
        await new Promise((res, rej) => { barcodeImg.onload = res; barcodeImg.onerror = rej; barcodeImg.src = svgUrl; });

        const drawLabel = (x) => {
          const sw = ((activeWidth - (activeLpr - 1)) / activeLpr) * dotsPerMm; 
          const sh = activeHeight * dotsPerMm;
          const p = 6 * (dotsPerMm / mmToPx); 

          ctx.save();
          ctx.translate(x + sw/2 + globalOffsetX, sh/2 + globalOffsetY);
          ctx.rotate((activeRotation * Math.PI) / 180);
          ctx.translate(-(x + sw/2 + globalOffsetX), -(sh/2 + globalOffsetY));

          ctx.fillStyle = 'black'; ctx.textAlign = 'center';
          const nSize = standardNameSize * standardScale;
          const pSize = standardPriceSize * standardScale;
          const bH = standardBarcodeHeight * standardScale * (dotsPerMm / mmToPx);
          const bW = (activeWidth / activeLpr) * 0.8 * standardScale * dotsPerMm;
          const gapPx = standardGap * standardScale * (dotsPerMm / mmToPx);

          // Name
          ctx.font = `bold ${nSize * (dotsPerMm/4.4)}px Arial`;
          const nameY = p + (nSize * dotsPerMm / 4.4) + globalOffsetY;
          ctx.fillText(productName.toUpperCase(), x + sw/2 + globalOffsetX, nameY);
          
          // Barcode
          const bcY = nameY + gapPx;
          ctx.drawImage(barcodeImg, x + (sw - bW)/2 + globalOffsetX, bcY, bW, bH);
          
          // Price
          const priceY = bcY + bH + gapPx + (pSize * dotsPerMm / 4.4);
          ctx.font = `bold ${pSize * (dotsPerMm/4.4)}px Arial`;
          ctx.fillText(`Rs ${price}`, x + sw/2 + globalOffsetX, priceY);
          ctx.restore();
        }
        for (let i = 0; i < activeLpr; i++) {
          const offsetX = i * (((activeWidth - (activeLpr - 1)) / activeLpr) + 1) * dotsPerMm;
          drawLabel(offsetX);
        }
        URL.revokeObjectURL(svgUrl);
      } else {
        // Custom & Advanced Mode
        const colWidthMm = (activeWidth - (activeLpr - 1)) / activeLpr;
        const colWidthPx = colWidthMm * dotsPerMm;

        // Load background if needed
        let bgImgReady = null;
        if (activeBgImage) {
          bgImgReady = new Image();
          await new Promise((res) => { bgImgReady.onload = res; bgImgReady.src = activeBgImage; });
        }

        const drawFieldsAt = (offsetX) => {
          const ch = activeHeight * dotsPerMm;
          
          ctx.save();
          // Rotate around the center of the label slot
          ctx.translate(offsetX + colWidthPx/2, ch/2);
          ctx.rotate((activeRotation * Math.PI) / 180);
          ctx.translate(-(offsetX + colWidthPx/2), -(ch/2));

          // 1. Draw background first
          if (bgImgReady) {
            ctx.drawImage(
              bgImgReady, 
              (activeBgSettings.x * dotsPerMm) + offsetX, 
              (activeBgSettings.y * dotsPerMm), 
              activeBgSettings.width * dotsPerMm, 
              activeBgSettings.height * dotsPerMm
            );
          }

          // 1.5 Draw Frame
          if (activeFrame.enabled) {
            ctx.strokeStyle = activeFrame.color;
            ctx.lineWidth = activeFrame.thickness * dotsPerMm;
            const p = activeFrame.padding * dotsPerMm;
            const r = activeFrame.radius * dotsPerMm;
            const fx = (activeFrame.x * dotsPerMm) + offsetX + p;
            const fy = (activeFrame.y * dotsPerMm) + p;
            const fw = (activeFrame.width * dotsPerMm) - (p * 2);
            const fh = (activeFrame.height * dotsPerMm) - (p * 2);

            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(fx, fy, fw, fh, r);
            } else {
              ctx.rect(fx, fy, fw, fh);
            }
            ctx.stroke();
          }

          // 2. Overlay text
          ctx.fillStyle = 'black';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          activeFields.forEach(f => {
            const dotSize = (f.size * dotsPerMm) / 4.4; // Using 4.4 as confirmed perfect factor
            ctx.font = `${f.bold ? 'bold' : ''} ${dotSize}px Arial`;
            // Apply global offsets to final calculated points
            const fx = (f.x * dotsPerMm) + offsetX + globalOffsetX;
            const fy = (f.y * dotsPerMm) + globalOffsetY;
            ctx.fillText(f.text, fx, fy);

            if (f.underline) {
              const textWidth = ctx.measureText(f.text).width;
              ctx.beginPath();
              ctx.lineWidth = (f.uThickness || 0.5) * dotsPerMm;
              ctx.strokeStyle = 'black';
              const underlineY = fy + (dotSize * 0.9) + ((f.uOffset || 0.5) * dotsPerMm);
              ctx.moveTo(fx, underlineY);
              ctx.lineTo(fx + textWidth, underlineY);
              ctx.stroke();
            }
          });
          ctx.restore();
        };

        for (let i = 0; i < activeLpr; i++) {
          const offsetX = i * (colWidthMm + 1) * dotsPerMm;
          drawFieldsAt(offsetX);
        }
      }

      const imageData = canvas.toDataURL('image/jpeg', 0.9);

      if (printTarget === 'pos') {
        const numRows = Math.ceil(copies / activeLpr);
        const result = await printLabels([imageData], numRows);
        if (!result.success) alert('Print server error: ' + result.error);
      } else {
        // A4 Printing via Browser
        const printWindow = window.open('', '_blank');
        
        const labelHtml = `
          <div style="
            width: ${activeWidth}mm; 
            height: ${activeHeight}mm; 
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
          z-index: 10;
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label><Maximize2 size={14} /> Global Scale</label>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.05"
                      value={standardScale} 
                      onChange={e => setStandardScale(parseFloat(e.target.value))} 
                      style={{ width: '100%', height: '6px', appearance: 'none', background: '#e2e8f0', borderRadius: '3px', cursor: 'pointer' }}
                    />
                  </div>
                  <div className="input-group">
                    <label>Element Gap</label>
                    <input 
                      type="range" min="0" max="20" step="1"
                      value={standardGap} 
                      onChange={e => setStandardGap(parseInt(e.target.value))} 
                      style={{ width: '100%', height: '6px', appearance: 'none', background: '#e2e8f0', borderRadius: '3px', cursor: 'pointer' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                  <div className="input-group">
                    <label><Maximize2 size={14} /> Width (mm)</label>
                    <input 
                      type="number" 
                      value={standardWidth} 
                      onChange={e => setStandardWidth(parseInt(e.target.value) || 75)} 
                    />
                  </div>
                  <div className="input-group">
                    <label>Height (mm)</label>
                    <input 
                      type="number" 
                      value={standardHeight} 
                      onChange={e => setStandardHeight(parseInt(e.target.value) || 25)} 
                    />
                  </div>
                  <div className="input-group">
                    <label>Labels / Row</label>
                    <input 
                      type="number" 
                      min="1" max="6" 
                      value={standardLpr} 
                      onChange={e => setStandardLpr(parseInt(e.target.value) || 1)} 
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                  <div className="input-group">
                    <label>Name Size</label>
                    <input 
                      type="number" min="4" max="50"
                      value={standardNameSize} 
                      onChange={e => setStandardNameSize(parseInt(e.target.value) || 10)} 
                    />
                  </div>
                  <div className="input-group">
                    <label>Price Size</label>
                    <input 
                      type="number" min="4" max="50"
                      value={standardPriceSize} 
                      onChange={e => setStandardPriceSize(parseInt(e.target.value) || 12)} 
                    />
                  </div>
                  <div className="input-group">
                    <label>Barcode Width</label>
                    <input 
                      type="number" step="0.1" min="0.1" max="5.0"
                      value={standardBarcodeWidth} 
                      onChange={e => setStandardBarcodeWidth(parseFloat(e.target.value) || 1.0)} 
                    />
                  </div>
                  <div className="input-group">
                    <label>Barcode Height</label>
                    <input 
                      type="number" min="5" max="100"
                      value={standardBarcodeHeight} 
                      onChange={e => setStandardBarcodeHeight(parseInt(e.target.value) || 30)} 
                    />
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
                        value={activeLpr} 
                        onChange={e => setActiveLpr(Math.max(1, parseInt(e.target.value) || 1))} 
                      />
                    </div>
                    <div className="input-group">
                      <label>Height (mm)</label>
                      <input 
                        type="number" 
                        min="5" max="150" 
                        value={activeHeight} 
                        onChange={e => setActiveHeight(parseInt(e.target.value) || 20)} 
                      />
                    </div>
                    <div className="input-group">
                      <label>Rotation</label>
                      <button 
                        onClick={(e) => { e.preventDefault(); rotateLabel(); }}
                        className="mode-btn"
                        style={{ 
                          background: 'white', border: '1px solid #cbd5e1', width: '100%', 
                          justifyContent: 'center', color: '#1e293b', padding: '0.75rem' 
                        }}
                      >
                        <RotateCw size={16} /> {activeRotation}°
                      </button>
                    </div>
                    <div className="input-group">
                      <label>Printer DPI</label>
                      <select 
                        value={activeDpi} 
                        onChange={e => setActiveDpi(parseInt(e.target.value))}
                        style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', width: '100%' }}
                      >
                        <option value={203}>203 DPI (Standard)</option>
                        <option value={300}>300 DPI (High Res)</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label>Offset X/Y (mm)</label>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <input 
                          type="number" step="0.5" value={activeOffset.x} 
                          onChange={e => setActiveOffset(prev => ({ ...prev, x: parseFloat(e.target.value) }))}
                          style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '50%' }}
                          placeholder="X"
                        />
                        <input 
                          type="number" step="0.5" value={activeOffset.y} 
                          onChange={e => setActiveOffset(prev => ({ ...prev, y: parseFloat(e.target.value) }))}
                          style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '50%' }}
                          placeholder="Y"
                        />
                      </div>
                    </div>
                  </div>

                  {labelMode === 'advanced' && (
                    <div className="input-group" style={{ marginTop: '1rem' }}>
                      <label>Canvas Width (mm)</label>
                      <input 
                        type="number" 
                        min="5" max="300" 
                        value={activeWidth} 
                        onChange={e => setActiveWidth(parseInt(e.target.value) || 75)} 
                      />
                    </div>
                  )}

                  {(labelMode === 'advanced' || labelMode === 'custom') && (
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      style={{ 
                        width: '100%', marginTop: '1rem', padding: '1rem', border: '2px dashed #3b82f6', 
                        background: 'rgba(59,130,246,0.03)', color: '#3b82f6', fontWeight: 700, borderRadius: '12px', 
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' 
                      }}
                    >
                      <ImageIcon size={18} /> {activeBgImage ? 'Change Template' : 'Upload Template'}
                    </button>
                  )}

                  {activeBgImage && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Image Controls</h4>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => setActiveBgSettings({ x: 0, y: 0, width: activeWidth, height: activeHeight })}
                            style={{ fontSize: '0.7rem', color: '#3b82f6', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Fit
                          </button>
                          <button 
                            onClick={() => {
                              setActiveBgImage(null);
                              setActiveFieldId(null);
                            }}
                            style={{ fontSize: '0.7rem', color: '#ef4444', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="input-group">
                          <label>Img Width</label>
                          <input 
                            type="number" 
                            value={activeBgSettings.width} 
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) setActiveBgSettings(prev => ({ ...prev, width: val }));
                            }} 
                          />
                        </div>
                        <div className="input-group">
                          <label>Img Height</label>
                          <input 
                            type="number" 
                            value={activeBgSettings.height} 
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) setActiveBgSettings(prev => ({ ...prev, height: val }));
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LABEL FRAME CONTROLS */}
                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f1f5f9', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layout size={14} /> Label Frame
                      </h3>
                      <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={activeFrame.enabled} 
                          onChange={e => setActiveFrame(prev => ({ ...prev, enabled: e.target.checked }))}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: activeFrame.enabled ? '#3b82f6' : '#64748b' }}>
                          {activeFrame.enabled ? 'ON' : 'OFF'}
                        </span>
                      </label>
                    </div>

                    {activeFrame.enabled && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="input-group">
                          <label>Radius (mm)</label>
                          <input 
                            type="number" step="0.5" min="0"
                            value={activeFrame.radius} 
                            onChange={e => setActiveFrame(prev => ({ ...prev, radius: parseFloat(e.target.value) || 0 }))} 
                          />
                        </div>
                        <div className="input-group">
                          <label>Thickness (mm)</label>
                          <input 
                            type="number" step="0.1" min="0.1"
                            value={activeFrame.thickness} 
                            onChange={e => setActiveFrame(prev => ({ ...prev, thickness: parseFloat(e.target.value) || 0.1 }))} 
                          />
                        </div>
                        <div className="input-group">
                          <label>Padding (mm)</label>
                          <input 
                            type="number" step="0.5" min="0"
                            value={activeFrame.padding} 
                            onChange={e => setActiveFrame(prev => ({ ...prev, padding: parseFloat(e.target.value) || 0 }))} 
                          />
                        </div>
                        <div className="input-group">
                          <label>Width (mm)</label>
                          <input 
                            type="number" step="1" min="1"
                            value={activeFrame.width} 
                            onChange={e => setActiveFrame(prev => ({ ...prev, width: parseFloat(e.target.value) || activeWidth }))} 
                          />
                        </div>
                        <div className="input-group">
                          <label>Height (mm)</label>
                          <input 
                            type="number" step="1" min="1"
                            value={activeFrame.height} 
                            onChange={e => setActiveFrame(prev => ({ ...prev, height: parseFloat(e.target.value) || activeHeight }))} 
                          />
                        </div>
                        <div className="input-group">
                          <label>Offset X (mm)</label>
                          <input 
                            type="number" step="0.5"
                            value={activeFrame.x} 
                            onChange={e => setActiveFrame(prev => ({ ...prev, x: parseFloat(e.target.value) || 0 }))} 
                          />
                        </div>
                        <div className="input-group">
                          <label>Offset Y (mm)</label>
                          <input 
                            type="number" step="0.5"
                            value={activeFrame.y} 
                            onChange={e => setActiveFrame(prev => ({ ...prev, y: parseFloat(e.target.value) || 0 }))} 
                          />
                        </div>
                        <div className="input-group">
                          <label>Color</label>
                          <select 
                            value={activeFrame.color} 
                            onChange={e => setActiveFrame(prev => ({ ...prev, color: e.target.value }))}
                            style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                          >
                            <option value="#000000">Black</option>
                            <option value="#ffffff">White</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {printTarget === 'a4' && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                      <h3 style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.75rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layout size={14} /> A4 Grid Settings
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="input-group">
                          <label>Columns</label>
                          <input type="number" value={activeA4.cols} onChange={e => setActiveA4({...activeA4, cols: parseInt(e.target.value) || 1})} />
                        </div>
                        <div className="input-group">
                          <label>Gap (mm)</label>
                          <input type="number" value={activeA4.gapX} onChange={e => setActiveA4({...activeA4, gapX: parseInt(e.target.value) || 0})} />
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
                    {activeFields.map(f => (
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
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#475569' }}>
                            <input type="checkbox" checked={f.underline} onChange={e => updateField(f.id, 'underline', e.target.checked)} style={{ width: '14px', height: '14px' }} /> Underline
                          </label>
                        </div>
                        {f.underline && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div className="input-group">
                              <label>Line Thickness</label>
                              <input 
                                type="number" step="0.1" min="0.1"
                                value={f.uThickness || 0.5} 
                                onChange={e => updateField(f.id, 'uThickness', parseFloat(e.target.value) || 0.1)} 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              />
                            </div>
                            <div className="input-group">
                              <label>Line Offset</label>
                              <input 
                                type="number" step="0.1"
                                value={f.uOffset || 0.5} 
                                onChange={e => updateField(f.id, 'uOffset', parseFloat(e.target.value) || 0)} 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              />
                            </div>
                          </div>
                        )}
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
          <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* TOP: LABEL EDITOR */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#3b82f6' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Label Designer (Single)
                    </span>
                  </div>
                  <div style={{ background: '#dbeafe', color: '#1e40af', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Maximize2 size={14} /> {activeWidth}mm × {activeHeight}mm
                  </div>
              </div>

              <div className="studio-viewport" style={{ minHeight: '400px' }}>
                <div 
                  className="designer-canvas" 
                  style={{ 
                    width: activeWidth * mmToPx, 
                    height: activeHeight * mmToPx,
                    background: labelMode === 'standard' ? '#f8fafc' : 'white', 
                    transform: `scale(1.5) rotate(${activeRotation}deg)`,
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: labelMode === 'standard' ? 'flex' : 'block',
                    gap: '1px',
                    overflow: 'hidden'
                  }}
                  onMouseDown={labelMode === 'advanced' || labelMode === 'custom' ? (e) => setActiveFieldId(null) : undefined}
                >
                  {activeBgImage && (
                    <div 
                      style={{ 
                        position: 'absolute',
                        left: activeBgSettings.x * mmToPx,
                        top: activeBgSettings.y * mmToPx,
                        width: activeBgSettings.width * mmToPx,
                        height: activeBgSettings.height * mmToPx,
                        zIndex: 1,
                        border: activeFieldId === 'background' ? '2px solid #3b82f6' : 'none',
                      }}
                      onMouseDown={(e) => handleMouseDown(e, 'background')}
                    >
                      <img 
                        src={activeBgImage} 
                        style={{ 
                          width: '100%',
                          height: '100%',
                          cursor: 'move',
                          userSelect: 'none',
                          display: 'block'
                        }}
                        alt="Template"
                      />
                      {activeFieldId === 'background' && (
                        <div 
                          onMouseDown={(e) => handleMouseDown(e, 'background', 'resize')}
                          style={{
                            position: 'absolute',
                            right: -6,
                            bottom: -6,
                            width: 12,
                            height: 12,
                            background: '#3b82f6',
                            borderRadius: '50%',
                            cursor: 'nwse-resize',
                            border: '2px solid white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            zIndex: 10
                          }}
                        />
                      )}
                    </div>
                  )}

                  {activeFrame.enabled && (
                    <div 
                      style={{ 
                        position: 'absolute',
                        left: (activeFrame.x + activeFrame.padding) * mmToPx,
                        top: (activeFrame.y + activeFrame.padding) * mmToPx,
                        width: (activeFrame.width - (activeFrame.padding * 2)) * mmToPx,
                        height: (activeFrame.height - (activeFrame.padding * 2)) * mmToPx,
                        border: `${activeFrame.thickness * mmToPx}px solid ${activeFrame.color}`,
                        borderRadius: `${activeFrame.radius * mmToPx}px`,
                        pointerEvents: 'none',
                        zIndex: 5
                      }} 
                    />
                  )}
                  {labelMode === 'standard' ? (
                    <>
                      {Array.from({ length: activeLpr }).map((_, i) => (
                        <div 
                          key={i}
                          className="printable-sticker" 
                          style={{ 
                            background: 'white', 
                            width: `${100 / activeLpr}%`, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'flex-start', 
                            padding: `${6 * (mmToPx / 4.4)}px`, 
                            height: '100%', 
                            borderRight: i < activeLpr - 1 ? '1px dashed #cbd5e1' : 'none',
                            gap: `${standardGap * standardScale * (mmToPx / 4.4)}px`
                          }}
                        >
                          <div style={{ fontSize: `${(standardNameSize * standardScale) * (mmToPx / 4.4)}px`, fontWeight: 800, color: '#1e293b', textAlign: 'center', lineHeight: 1.1 }}>{productName.toUpperCase()}</div>
                          <div style={{ transform: `scale(${standardBarcodeWidth * standardScale * (mmToPx / 4.4)})`, transformOrigin: 'top center' }}>
                            <Barcode 
                              value={barcodeValue || 'VOID'} 
                              width={1.0} 
                              height={standardBarcodeHeight * (mmToPx / 4.4)} 
                              fontSize={10 * (mmToPx / 4.4)} 
                              margin={0} 
                            />
                          </div>
                          <div style={{ fontSize: `${(standardPriceSize * standardScale) * (mmToPx / 4.4)}px`, fontWeight: 900, color: '#1e293b' }}>Rs {price}</div>
                        </div>
                      ))}
                    </>
                    ) : (
                      <>
                        {activeFields.map(f => (
                          <div 
                            key={f.id} 
                            className={`drag-field ${activeFieldId === f.id ? 'active' : ''}`} 
                            onMouseDown={(e) => handleMouseDown(e, f.id)} 
                            style={{ 
                              left: f.x * mmToPx, 
                              top: f.y * mmToPx, 
                              fontSize: `${f.size}px`, 
                              fontWeight: f.bold ? 700 : 400,
                              fontFamily: 'Arial, sans-serif',
                              borderBottom: f.underline ? `${(f.uThickness || 0.5) * mmToPx}px solid black` : 'none',
                              paddingBottom: f.underline ? `${(f.uOffset || 0.5) * mmToPx}px` : '0px'
                            }}
                          >
                            {f.text}
                          </div>
                        ))}
                      </>
                    )}
                </div>
              </div>
            </div>

            {/* BOTTOM: PRINT LAYOUT PREVIEW */}
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: printTarget === 'a4' ? '#10b981' : '#f97316' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {printTarget === 'a4' ? 'A4 Layout Preview' : `Live Roll Preview (${activeLpr} Col)`}
                      </span>
                    </div>
                    <div style={{ background: '#ffedd5', color: '#9a3412', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {printTarget === 'pos' ? `${copies} Labels Total` : 'A4 Grid'}
                    </div>
                </div>

                <div className="studio-viewport" style={{ 
                  background: printTarget === 'a4' ? '#94a3b8' : undefined,
                  boxShadow: printTarget === 'a4' ? 'inset 0 0 100px rgba(0,0,0,0.2)' : undefined,
                  overflow: 'auto',
                  padding: printTarget === 'a4' ? '2rem' : '3rem',
                  minHeight: '300px'
                }}>
                  {printTarget === 'a4' ? (
                    <div style={{ 
                      width: '210mm', 
                      minHeight: '297mm', 
                      background: 'white', 
                      padding: '10mm', 
                      boxShadow: '0 40px 100px rgba(0,0,0,0.4)',
                      display: 'grid',
                      gridTemplateColumns: `repeat(${activeA4.cols}, 1fr)`,
                      gap: `${activeA4.gapY}mm ${activeA4.gapX}mm`,
                      transform: 'scale(0.7)',
                      transformOrigin: 'top center',
                      margin: '0 auto',
                      marginBottom: '-80mm'
                    }}>
                      {Array.from({ length: Math.min(60, copies) }).map((_, idx) => (
                        <div 
                          key={idx}
                          style={{ 
                            width: activeWidth * mmToPx, 
                            height: (labelMode === 'standard' ? 20 : activeHeight) * mmToPx,
                            background: 'white', 
                            position: 'relative', 
                            overflow: 'hidden',
                            border: '1px solid #f1f5f9',
                            transform: `rotate(${activeRotation}deg)`,
                            transition: 'transform 0.3s ease'
                          }}
                        >
                          {activeBgImage && (
                            <img 
                              src={activeBgImage} 
                              style={{ 
                                position: 'absolute',
                                left: activeBgSettings.x * mmToPx,
                                top: activeBgSettings.y * mmToPx,
                                width: activeBgSettings.width * mmToPx,
                                height: activeBgSettings.height * mmToPx,
                              }}
                              alt="Template"
                            />
                          )}
                          {activeFrame.enabled && (
                            <div 
                              style={{ 
                                position: 'absolute',
                                left: (activeFrame.x + activeFrame.padding) * mmToPx,
                                top: (activeFrame.y + activeFrame.padding) * mmToPx,
                                width: (activeFrame.width - (activeFrame.padding * 2)) * mmToPx,
                                height: (activeFrame.height - (activeFrame.padding * 2)) * mmToPx,
                                border: `${activeFrame.thickness * mmToPx}px solid ${activeFrame.color}`,
                                borderRadius: `${activeFrame.radius * mmToPx}px`,
                                pointerEvents: 'none',
                                zIndex: 5
                              }} 
                            />
                          )}
                          {labelMode === 'standard' ? (
                            <div className="printable-sticker" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '6px', height: '100%' }}>
                              <div style={{ fontSize: `${standardNameSize * standardScale}px`, fontWeight: 800, color: '#1e293b', textAlign: 'center' }}>{formatItemName(productName.toUpperCase())}</div>
                              <div style={{ transform: `scale(${standardBarcodeWidth * standardScale})` }}><Barcode value={barcodeValue || 'VOID'} width={1.0} height={standardBarcodeHeight * standardScale} fontSize={10} margin={0} /></div>
                              <div style={{ fontSize: `${standardPriceSize * standardScale}px`, fontWeight: 900, color: '#1e293b' }}>Rs {price}</div>
                            </div>
                          ) : (
                            activeFields.map(f => (
                              <div 
                                key={f.id} 
                                className="drag-field" 
                                style={{ 
                                  left: f.x * mmToPx, 
                                  top: f.y * mmToPx, 
                                  fontSize: `${f.size}px`, 
                                  fontWeight: f.bold ? 700 : 400,
                                  fontFamily: 'Arial, sans-serif',
                                  borderBottom: f.underline ? `${(f.uThickness || 0.5) * mmToPx}px solid black` : 'none',
                                  paddingBottom: f.underline ? `${(f.uOffset || 0.5) * mmToPx}px` : '0px',
                                  pointerEvents: 'none'
                                }}
                              >
                                {f.text}
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div 
                      className="designer-canvas" 
                      style={{ 
                        width: activeWidth * mmToPx, 
                        height: activeHeight * mmToPx * Math.ceil(copies / activeLpr),
                        display: 'grid',
                        gridTemplateColumns: `repeat(${activeLpr}, 1fr)`,
                        gap: '1px',
                        background: '#e2e8f0',
                        transform: 'scale(1.2)',
                        transformOrigin: 'top center'
                      }}
                    >
                      {Array.from({ length: copies }).map((_, idx) => (
                        <div 
                          key={idx}
                          style={{ 
                            background: 'white', 
                            position: 'relative', 
                            width: (activeWidth - (activeLpr - 1)) / activeLpr * mmToPx,
                            height: activeHeight * mmToPx, 
                            overflow: 'hidden',
                            borderRight: '1px solid #f1f5f9',
                            transform: `rotate(${activeRotation}deg)`,
                            transition: 'transform 0.3s ease'
                          }}
                        >
                          {activeBgImage && (
                            <img 
                              src={activeBgImage} 
                              style={{ 
                                position: 'absolute',
                                left: activeBgSettings.x * mmToPx,
                                top: activeBgSettings.y * mmToPx,
                                width: activeBgSettings.width * mmToPx,
                                height: activeBgSettings.height * mmToPx,
                              }}
                              alt="Template"
                            />
                          )}
                          {activeFrame.enabled && (
                            <div 
                              style={{ 
                                position: 'absolute',
                                left: (activeFrame.x + activeFrame.padding) * mmToPx,
                                top: (activeFrame.y + activeFrame.padding) * mmToPx,
                                width: (activeFrame.width - (activeFrame.padding * 2)) * mmToPx,
                                height: (activeFrame.height - (activeFrame.padding * 2)) * mmToPx,
                                border: `${activeFrame.thickness * mmToPx}px solid ${activeFrame.color}`,
                                borderRadius: `${activeFrame.radius * mmToPx}px`,
                                pointerEvents: 'none',
                                zIndex: 5
                              }} 
                            />
                          )}
                          {labelMode === 'standard' ? (
                            <div className="printable-sticker" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '6px', height: '100%', gap: `${standardGap * standardScale}px` }}>
                              <div style={{ fontSize: `${(standardNameSize * standardScale) * (mmToPx / 4.4)}px`, fontWeight: 800, color: '#1e293b', textAlign: 'center' }}>{formatItemName(productName.toUpperCase())}</div>
                              <div style={{ transform: `scale(${standardBarcodeWidth * standardScale * (mmToPx / 4.4)})`, transformOrigin: 'top center' }}><Barcode value={barcodeValue || 'VOID'} width={1.0} height={standardBarcodeHeight * (mmToPx / 4.4)} fontSize={10} margin={0} /></div>
                              <div style={{ fontSize: `${(standardPriceSize * standardScale) * (mmToPx / 4.4)}px`, fontWeight: 900, color: '#1e293b' }}>Rs {price}</div>
                            </div>
                          ) : (
                            activeFields.map(f => (
                              <div 
                                key={f.id} 
                                className="drag-field" 
                                style={{ 
                                  left: f.x * mmToPx, 
                                  top: f.y * mmToPx, 
                                  fontSize: `${f.size}px`, 
                                  fontWeight: f.bold ? 700 : 400,
                                  fontFamily: 'Arial, sans-serif',
                                  borderBottom: f.underline ? `${(f.uThickness || 0.5) * mmToPx}px solid black` : 'none',
                                  paddingBottom: f.underline ? `${(f.uOffset || 0.5) * mmToPx}px` : '0px',
                                  pointerEvents: 'none'
                                }}
                              >
                                {f.text}
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          </section>
            
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        style={{ display: 'none' }} 
        accept="image/*"
      />
    </div>
  );
};

export default BarcodeGenerator;
