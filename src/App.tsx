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
      scale: 3, // Higher scale for better quality
      backgroundColor: null, // Transparent background
    });
    
    const imgData = canvas.toDataURL('image/png');
    
    // Create PDF in 'in' (inches) for precise physical sizing
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'a4'
    });

    const targetSizeInches = 3.5;
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Center the 3" circle on the page
    const x = (pageWidth - targetSizeInches) / 2;
    const y = 1; // 1 inch from top

    pdf.addImage(imgData, 'PNG', x, y, targetSizeInches, targetSizeInches);
    pdf.save('pinner-template.pdf');
  };

  return (
    <div className="container py-4">
      <header className="mb-4 text-center">
        <h1 className="display-4">Pinner</h1>
        <p className="lead">Photo Template App</p>
      </header>

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Controls</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-bold">1. Upload Photo</label>
                <input className="form-control" type="file" accept="image/*" onChange={onSelectFile} />
                <p className="text-muted small">Or drop a photo on the template area.</p>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">2. Text Label</label>
                <input 
                  className="form-control"
                  type="text" 
                  value={text} 
                  onChange={(e) => setText(e.target.value)} 
                  placeholder="Enter label"
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">3. Label Color</label>
                <input 
                  className="form-control form-control-color w-100"
                  type="color" 
                  value={textColor} 
                  onChange={(e) => setTextColor(e.target.value)} 
                />
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold">Zoom</label>
                <input
                  className="form-range"
                  type="range"
                  value={zoom}
                  min={0.1}
                  max={10}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </div>

              <div className="d-grid gap-2">
                <button className="btn btn-primary btn-lg" onClick={downloadPdf}>4. Download PDF</button>
                <button className="btn btn-outline-secondary" onClick={handleReset}>Reset</button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex flex-column align-items-center justify-content-center bg-light rounded overflow-hidden">
              <div className="template-wrapper p-2 bg-white shadow-sm mb-3">
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
                    <div className="placeholder text-muted">
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
              
              <div className="alert alert-info py-2 px-3 mb-0 w-100 text-center small">
                <i className="bi bi-info-circle me-2"></i>
                Drag image to reposition. Drag text to move. Use slider to zoom.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
