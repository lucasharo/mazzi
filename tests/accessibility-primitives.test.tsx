import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet } from '../src/components/ui/BottomSheet';
import { Button } from '../src/components/ui/Button';
import { IconButton } from '../src/components/ui/IconButton';
import { Input } from '../src/components/ui/Input';
import { Modal } from '../src/components/ui/Modal';
import { Rating } from '../src/components/ui/Rating';
import { Tabs, TabPanel, getTabId, getTabPanelId } from '../src/components/ui/Tabs';

describe('accessible UI primitives', () => {
  it('renders labelled modal and bottom-sheet dialogs', () => {
    const modal = renderToStaticMarkup(<Modal isOpen onClose={vi.fn()} title="Detalhes">Conteúdo</Modal>);
    const sheet = renderToStaticMarkup(<BottomSheet isOpen onClose={vi.fn()} title="Opções">Conteúdo</BottomSheet>);

    for (const markup of [modal, sheet]) {
      expect(markup).toContain('role="dialog"');
      expect(markup).toContain('aria-modal="true"');
      expect(markup).toContain('aria-labelledby=');
      expect(markup).toContain('aria-label="Fechar');
      expect(markup).toContain('tabindex="-1"');
    }
  });

  it('keeps modal chrome outside programmatic scrolling', () => {
    const markup = renderToStaticMarkup(
      <Modal isOpen onClose={vi.fn()} title="Editar perfil" footer={<Button>Salvar</Button>}>
        Conteúdo longo
      </Modal>,
    );

    expect(markup).toContain('overflow-clip');
    expect(markup).toContain('mazzi-modal-content p-4 sm:p-6 overflow-y-auto');
    expect(markup).not.toContain('overflow-hidden flex flex-col max-h-[90vh]');
  });

  it('associates stable input labels and accessible error messages', () => {
    const markup = renderToStaticMarkup(
      <Input id="email" label="E-mail" error="Informe um e-mail válido" defaultValue="inválido" />,
    );

    expect(markup).toContain('for="email"');
    expect(markup).toContain('id="email"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="email-error"');
    expect(markup).toContain('id="email-error"');
    expect(markup).toContain('role="alert"');
  });

  it('connects tabs and panels with roving tabindex semantics', () => {
    const tabs = renderToStaticMarkup(
      <Tabs
        id="account-tabs"
        activeTab="profile"
        onChange={vi.fn()}
        tabs={[{ id: 'profile', label: 'Perfil' }, { id: 'security', label: 'Segurança' }]}
      />,
    );
    const panel = renderToStaticMarkup(
      <TabPanel tabListId="account-tabs" tabId="profile" activeTab="profile">Perfil</TabPanel>,
    );

    expect(tabs).toContain('role="tablist"');
    expect(tabs).toContain('role="tab"');
    expect(tabs).toContain('aria-selected="true"');
    expect(tabs).toContain('tabindex="0"');
    expect(tabs).toContain('tabindex="-1"');
    expect(panel).toContain('role="tabpanel"');
    expect(getTabId('account-tabs', 'profile')).toBe('account-tabs-tab-profile');
    expect(getTabPanelId('account-tabs', 'profile')).toBe('account-tabs-panel-profile');
  });

  it('renders an interactive rating as a labelled radio group', () => {
    const markup = renderToStaticMarkup(<Rating value={4} interactive onChange={vi.fn()} />);

    expect(markup).toContain('role="radiogroup"');
    expect(markup.match(/role="radio"/g)).toHaveLength(5);
    expect(markup).toContain('aria-label="4 de 5 estrelas"');
    expect(markup).toContain('aria-checked="true"');
  });

  it('requires a named, touch-sized icon button', () => {
    const markup = renderToStaticMarkup(<IconButton label="Fechar"><span aria-hidden="true">x</span></IconButton>);

    expect(markup).toContain('aria-label="Fechar"');
    expect(markup).toContain('min-h-11');
    expect(markup).toContain('min-w-11');
    expect(markup).toContain('focus-visible:outline');
  });

  it('validates MAZZI focus ring and touch target standards on Button and Input', () => {
    const buttonMarkup = renderToStaticMarkup(<Button variant="primary">Agendar</Button>);
    const inputMarkup = renderToStaticMarkup(<Input label="Nome" defaultValue="Lucas" />);

    expect(buttonMarkup).toContain('bg-[var(--mazzi-yellow)]');
    expect(buttonMarkup).toContain('min-h-[44px]');
    expect(inputMarkup).toContain('min-h-11');
    expect(inputMarkup).toContain('focus:border-[var(--mazzi-yellow)]');
    expect(inputMarkup).not.toContain('focus:border-[var(--mazzi-dark)]');
  });
});
