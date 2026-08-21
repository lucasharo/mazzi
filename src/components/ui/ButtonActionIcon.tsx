import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarCheck,
  Check,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Send,
  Undo2,
  X,
  XCircle,
} from 'lucide-react';

const iconClassName = 'h-4 w-4';

function textFromNode(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join(' ');
  if (React.isValidElement<{ children?: React.ReactNode }>(node) && typeof node.type === 'string') {
    return textFromNode(node.props.children);
  }
  return '';
}

function containsComponent(node: React.ReactNode): boolean {
  if (Array.isArray(node)) return node.some(containsComponent);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return false;
  if (typeof node.type !== 'string') return true;
  if (node.type === 'svg') return true;
  return containsComponent(node.props.children);
}

/** Supplies a semantic Lucide icon when a text action does not declare one. */
export function getDefaultButtonActionIcon(children: React.ReactNode): React.ReactNode {
  if (containsComponent(children)) return null;

  const label = textFromNode(children).trim().toLocaleLowerCase('pt-BR');
  const iconProps = { className: iconClassName, 'aria-hidden': true as const };

  if (/cancelar|cancelamento/.test(label)) return <XCircle {...iconProps} />;
  if (/fechar|remover|limpar/.test(label)) return <X {...iconProps} />;
  if (/voltar|retornar/.test(label)) return <ArrowLeft {...iconProps} />;
  if (/sair/.test(label)) return <LogOut {...iconProps} />;
  if (/entrar|login/.test(label)) return <LogIn {...iconProps} />;
  if (/rejeitar|reprovar|inativar/.test(label)) return <XCircle {...iconProps} />;
  if (/suspender|bloquear/.test(label)) return <Ban {...iconProps} />;
  if (/estornar|reembolsar/.test(label)) return <Undo2 {...iconProps} />;
  if (/ocultar/.test(label)) return <EyeOff {...iconProps} />;
  if (/exibir|visualizar|ver |ver$|abrir|detalhes/.test(label)) return <Eye {...iconProps} />;
  if (/tentar|atualizar|recarregar|sincronizar/.test(label)) return <RefreshCw {...iconProps} />;
  if (/enviar|publicar/.test(label)) return <Send {...iconProps} />;
  if (/salvar/.test(label)) return <Save {...iconProps} />;
  if (/confirmar|aprovar|aplicar|concluir|ativar/.test(label)) return <Check {...iconProps} />;
  if (/selecionar|escolher|horário|calendário/.test(label)) return <CalendarCheck {...iconProps} />;
  if (/adicionar|cadastrar|criar|carregar mais/.test(label)) return <Plus {...iconProps} />;
  if (/continuar|avançar|próxim|ir para/.test(label)) return <ArrowRight {...iconProps} />;
  return <ArrowRight {...iconProps} />;
}
