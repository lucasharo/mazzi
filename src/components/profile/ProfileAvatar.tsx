import React from 'react';

export interface ProfileAvatarProps {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  id?: string;
  loading?: 'eager' | 'lazy';
}

const SIZE_STYLES: Record<NonNullable<ProfileAvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base font-semibold',
  xl: 'h-20 w-20 text-xl font-bold',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Canonical MAZZI profile photo treatment: square, yellow frame, no green avatar background. */
export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  name,
  imageUrl,
  size = 'md',
  className = '',
  id,
  loading,
}) => (
  <div
    id={id}
    className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] ${SIZE_STYLES[size]} ${className}`}
  >
    {imageUrl ? (
      <img
        src={imageUrl}
        alt={`Foto de ${name}`}
        className="h-full w-full object-cover"
        loading={loading}
        referrerPolicy="no-referrer"
      />
    ) : (
      <span aria-hidden="true">{getInitials(name)}</span>
    )}
  </div>
);
