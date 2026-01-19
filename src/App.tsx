import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import './App.css';

interface Point {
  x: number;
  y: number;
}

interface Area {
  width: number;
  height: number;
  x: number;
  y: number;
}

function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [text, setText] = useState('Your Label');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textPos, setTextPos] = useState<Point>({ x: 200, y: 350 }); // Initial position near bottom
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [croppedreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const templateRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<Point>({ x: 0, y: 0 });

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const result = reader.result as string;
        
        // Create an image to get its dimensions
        const img = new Image();
        img.onload = () => {
          const imgAspect = img.width / img.height;
          // Since the template is square (aspect 1), 
          // to fill it we need zoom = max(1, 1/imgAspect) if we want the image to cover.
          // react-easy-crop with aspect={1} will fit the image.
          // If imgAspect > 1 (landscape), height is the limiting factor. 
          // react-easy-crop will set initial zoom so width fits.
          // Wait, react-easy-crop by default "contains" the image.
          // To "cover", if landscape (aspect > 1), we need to zoom by imgAspect.
          // If portrait (aspect < 1), we need to zoom by 1/imgAspect.
          
          let initialZoom: number;
          if (imgAspect > 1) {
            initialZoom = imgAspect;
          } else {
            initialZoom = 1 / imgAspect;
          }
          
          setImage(result);
          setZoom(initialZoom);
        };
        img.src = result;
      });
      reader.readAsDataURL(file);
    }
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    setImage(null);
    setText('Your Label');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setTextColor('#ffffff');
    setTextPos({ x: 200, y: 350 });
    console.log(croppedreaPixels);
    setCroppedAreaPixels(null);
  };

  const onTextMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingText(true);
    dragStartPos.current = {
      x: e.clientX - textPos.x,
      y: e.clientY - textPos.y
    };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingText) {
      let newX = e.clientX - dragStartPos.current.x;
      let newY = e.clientY - dragStartPos.current.y;

      // Constrain within the 400x400 container
      newX = Math.max(0, Math.min(400, newX));
      newY = Math.max(0, Math.min(400, newY));

      setTextPos({ x: newX, y: newY });
    }
  }, [isDraggingText]);

  const onMouseUp = useCallback(() => {
    setIsDraggingText(false);
  }, []);

  React.useEffect(() => {
    if (isDraggingText) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingText, onMouseMove, onMouseUp]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const downloadPdf = async () => {
    if (!templateRef.current) return;

    // Use a temporary container to avoid cropping issues with html2canvas and border-radius
    const canvas = await html2canvas(templateRef.current, {
      useCORS: true,
      scale: 2,
      backgroundColor: null, // Transparent background
    });
    
    const imgData = canvas.toDataURL('image/png');
    // A4 size in px (96 DPI) is approx 794x1123
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: 'a4'
    });

    // Center the image on the A4 page
    const pageWidth = pdf.internal.pageSize.getWidth();
    const x = (pageWidth - canvas.width / 2) / 2;
    const y = 40;

    pdf.addImage(imgData, 'PNG', x, y, canvas.width / 2, canvas.height / 2);
    pdf.save('pinner-template.pdf');
  };

  return (
    <div className="app-container">
      <h1>Pinner - Photo Template App</h1>

      <div className="controls">
        <div className="control-group">
          <label>1. Upload Photo: </label>
          <input type="file" accept="image/*" onChange={onSelectFile} />
        </div>

        <div className="control-group">
          <label>2. Text Label: </label>
          <input 
            type="text" 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="Enter label"
          />
        </div>

        <div className="control-group">
          <label>3. Label Color: </label>
          <input 
            type="color" 
            value={textColor} 
            onChange={(e) => setTextColor(e.target.value)} 
          />
        </div>

        <div className="control-group">
          <label>Zoom: </label>
          <input
            type="range"
            value={zoom}
            min={0.1}
            max={10}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </div>

        <div className="button-group">
          <button className="reset-btn" onClick={handleReset}>Reset</button>
          <button className="download-btn" onClick={downloadPdf}>4. Download PDF</button>
        </div>
      </div>

      <div className="template-wrapper">
        <div 
          className={`template-container ${isDragging ? 'dragging' : ''}`} 
          ref={templateRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {image ? (
            <div className="cropper-container">
              <Cropper
                image={image}
                crop={crop}
                zoom={zoom}
                aspect={1} // Square template example
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                showGrid={false}
                minZoom={0.1}
                cropShape="round"
                classes={{
                  containerClassName: 'custom-cropper-container',
                  cropAreaClassName: 'custom-crop-area',
                }}
              />
            </div>
          ) : (
            <div className="placeholder">
              {isDragging ? "Drop photo here" : "Drag'n'drop photo here or use 'Choose File'"}
            </div>
          )}
          <div className="dotted-guide" />
          <div 
            className="text-overlay" 
            style={{ 
              color: textColor,
              left: `${textPos.x}px`,
              top: `${textPos.y}px`
            }}
            onMouseDown={onTextMouseDown}
          >
            {text}
          </div>
        </div>
      </div>
      
      <p className="hint">Drag image to reposition. Drag the text label to move it. Use slider to zoom. You can also drag'n'drop a new image onto the circle.</p>
    </div>
  );
}

export default App;
