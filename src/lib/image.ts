// Procesamiento de fotografías en el dispositivo antes de subirlas:
// - redimensiona a un máximo de 1600 px (reduce consumo de datos móviles)
// - recodifica a JPEG, lo que ELIMINA los metadatos EXIF (incluida la ubicación
//   GPS del teléfono y el modelo del dispositivo) → protección de privacidad (RNF02).

export interface ProcessedPhoto {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  originalBytes: number;
}

const MAX_SIDE = 1600;
const QUALITY = 0.82;

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* se intenta con <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No fue posible leer la imagen. Intente con otra foto (JPG o PNG).')); };
    img.src = url;
  });
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const source = await loadBitmap(file);
  const w0 = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h0 = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!w0 || !h0) throw new Error('La imagen no tiene dimensiones válidas.');
  if (Math.min(w0, h0) < 200) throw new Error('La imagen es demasiado pequeña (mínimo 200 px).');

  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const width = Math.round(w0 * scale);
  const height = Math.round(h0 * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite procesar imágenes.');
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  if ('close' in source) source.close();

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen.'))), 'image/jpeg', QUALITY),
  );
  return { blob, previewUrl: URL.createObjectURL(blob), width, height, originalBytes: file.size };
}

export const formatBytes = (n: number) =>
  n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
