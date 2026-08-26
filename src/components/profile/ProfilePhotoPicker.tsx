import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, ButtonBase } from '../ui/Button';
import { Modal } from '../ui/Modal';

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
  const [isUploading, setIsUploading] = useState(false);

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

  const uploadBlobToStorage = async (blob: Blob): Promise<string> => {
    const isRealSupabase = !!((import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder'));
    
    if (isRealSupabase) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        throw new Error('Usuário não autenticado para upload.');
      }
      const userId = authData.user.id;
      const fileName = `${userId}/avatar-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error('Falha ao enviar a foto para o armazenamento.');
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    }

    // Fallback for local mock/dev testing without Supabase credentials
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const capturePhoto = async () => {
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

    stopCamera();
    setIsUploading(true);
    setError(null);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError('Não foi possível processar a foto.');
        setIsUploading(false);
        return;
      }
      try {
        const publicUrl = await uploadBlobToStorage(blob);
        onChange(publicUrl);
      } catch (err: any) {
        setError(err?.message || 'Falha ao salvar a foto de perfil.');
      } finally {
        setIsUploading(false);
      }
    }, 'image/jpeg', 0.85);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    // Validate type and size (5MB limit)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Selecione uma imagem em formato JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5 MB.');
      return;
    }

    setIsUploading(true);
    setError(null);

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

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setError('Não foi possível processar a imagem.');
          setIsUploading(false);
          return;
        }
        try {
          const publicUrl = await uploadBlobToStorage(blob);
          onChange(publicUrl);
        } catch (err: any) {
          setError(err?.message || 'Falha ao enviar a foto para o armazenamento.');
        } finally {
          setIsUploading(false);
        }
      }, 'image/jpeg', 0.85);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('Não foi possível ler a imagem.');
      setIsUploading(false);
    };
    image.src = objectUrl;
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-[var(--mazzi-surface-soft)] border border-[var(--mazzi-border)] text-[var(--mazzi-dark)] flex items-center justify-center font-black">
        {isUploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-[var(--mazzi-muted)]" aria-label="Enviando foto..." />
        ) : value ? (
          <img src={value} alt="Foto do perfil" className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
      </div>
      <div className="space-y-1">
        <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} disabled={disabled || isUploading} className="hidden" />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void openCamera()}
            disabled={disabled || isUploading}
            leftIcon={<Camera className="h-4 w-4 text-amber-500" aria-hidden="true" />}
          >
            Tirar foto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => galleryInputRef.current?.click()}
            disabled={disabled || isUploading}
            leftIcon={<ImagePlus className="h-4 w-4 text-amber-500" aria-hidden="true" />}
          >
            Galeria
          </Button>
        </div>
        {value && !isUploading && (
          <ButtonBase
            type="button"
            onClick={() => onChange(undefined)}
            disabled={disabled}
            className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-rose-600 transition hover:text-rose-700"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remover foto
          </ButtonBase>
        )}
        {error && <p role="alert" className="text-[11px] font-semibold text-rose-600">{error}</p>}
      </div>

      <Modal
        isOpen={isCameraOpen}
        onClose={stopCamera}
        title="Tirar foto do perfil"
        size="sm"
        footer={(
          <>
              <Button
                type="button"
                variant="dangerSoft"
                size="sm"
                onClick={stopCamera}
                leftIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => void capturePhoto()}
                leftIcon={<Camera className="h-4 w-4" aria-hidden="true" />}
              >
                Capturar foto
              </Button>
          </>
        )}
      >
        <video ref={videoRef} autoPlay playsInline muted className="aspect-square w-full rounded-2xl bg-slate-950 object-cover" />
      </Modal>
    </div>
  );
};
