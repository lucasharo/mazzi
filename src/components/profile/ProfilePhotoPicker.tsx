import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';

interface ProfilePhotoPickerProps {
  value?: string;
  name?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}

function initials(name?: string) {
  return (name || 'Usuário')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const ProfilePhotoPicker: React.FC<ProfilePhotoPickerProps> = ({ value, name, onChange, disabled }) => {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraOpen(false);
  };

  useEffect(() => () => stopCamera(), []);

  const openCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('A câmera não está disponível neste navegador.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (cameraError: any) {
      const message = cameraError?.name === 'NotAllowedError'
        ? 'Permissão para acessar a câmera foi negada. Autorize a câmera nas configurações do navegador.'
        : 'Não foi possível acessar a câmera.';
      setError(message);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setError('A câmera ainda não está pronta. Tente novamente.');
      return;
    }
    const cropSize = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    canvas.getContext('2d')?.drawImage(
      video,
      (video.videoWidth - cropSize) / 2,
      (video.videoHeight - cropSize) / 2,
      cropSize,
      cropSize,
      0,
      0,
      512,
      512,
    );
    onChange(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem válida.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 8 MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const cropSize = Math.min(image.width, image.height);
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      canvas.getContext('2d')?.drawImage(
        image,
        (image.width - cropSize) / 2,
        (image.height - cropSize) / 2,
        cropSize,
        cropSize,
        0,
        0,
        512,
        512,
      );
      URL.revokeObjectURL(objectUrl);
      setError(null);
      onChange(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('Não foi possível ler a imagem.');
    };
    image.src = objectUrl;
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center font-black">
        {value ? <img src={value} alt="Foto do perfil" className="h-full w-full object-cover" /> : initials(name)}
      </div>
      <div className="space-y-1">
        <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFile} disabled={disabled} className="hidden" />
        <button
          type="button"
          onClick={() => void openCamera()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          Tirar foto
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={disabled}
          className="ml-2 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
          Galeria
        </button>
        {value && <button type="button" onClick={() => onChange(undefined)} disabled={disabled} className="block text-[11px] font-semibold text-rose-600">Remover foto</button>}
        {error && <p className="text-[11px] text-rose-600">{error}</p>}
      </div>
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Tirar foto do perfil">
          <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-2xl">
            <h3 className="mb-3 text-base font-black text-slate-900">Tirar foto do perfil</h3>
            <video ref={videoRef} autoPlay playsInline muted className="aspect-square w-full rounded-2xl bg-slate-950 object-cover" />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={stopCamera} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">Cancelar</button>
              <button type="button" onClick={capturePhoto} className="flex-1 rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-slate-950">Capturar foto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

