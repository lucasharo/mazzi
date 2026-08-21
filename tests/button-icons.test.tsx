import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Check } from 'lucide-react';
import { Button, PrimaryButton, SecondaryButton } from '../src/components/ui/Button';
import { Tabs } from '../src/components/ui/Tabs';
import { ProfilePhotoPicker } from '../src/components/profile/ProfilePhotoPicker';

describe('global button icon policy', () => {
  it('uses the canonical small action scale by default across all button primitives', () => {
    const markups = [
      renderToStaticMarkup(<Button>Ação</Button>),
      renderToStaticMarkup(<PrimaryButton>Ação</PrimaryButton>),
      renderToStaticMarkup(<SecondaryButton>Ação</SecondaryButton>),
    ];

    markups.forEach((markup) => {
      expect(markup).toContain('text-xs');
      expect(markup).toContain('min-h-[44px]');
    });
  });

  it('adds semantic icons to text actions across all button primitives', () => {
    expect(renderToStaticMarkup(<Button>Salvar alterações</Button>)).toContain('lucide-save');
    expect(renderToStaticMarkup(<PrimaryButton>Confirmar</PrimaryButton>)).toContain('lucide-check');
    expect(renderToStaticMarkup(<SecondaryButton>Cancelar</SecondaryButton>)).toContain('lucide-circle-x');
  });

  it('does not duplicate an explicitly supplied icon', () => {
    const markup = renderToStaticMarkup(<Button leftIcon={<Check />}>Salvar</Button>);
    expect(markup.match(/<svg/g)).toHaveLength(1);
  });

  it('provides a fallback icon when a tab does not declare one', () => {
    const markup = renderToStaticMarkup(
      <Tabs activeTab="upcoming" onChange={() => undefined} tabs={[{ id: 'upcoming', label: 'Próximas' }]} />,
    );
    expect(markup).toContain('lucide-panels-top-left');
  });

  it('uses the shared small button typography for profile photo actions', () => {
    const markup = renderToStaticMarkup(<ProfilePhotoPicker name="Perfil" onChange={() => undefined} />);
    const photoActions = [...markup.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
      .map(([button]) => button)
      .filter((button) => /Tirar foto|Galeria/.test(button));

    expect(photoActions).toHaveLength(2);
    photoActions.forEach((button) => {
      expect(button).toContain('text-xs');
      expect(button).toContain('font-bold');
      expect(button).toContain('min-h-[44px]');
      expect(button).not.toContain('font-extrabold');
    });
  });
});
