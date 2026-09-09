export interface ProfessionalTermsSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface ProfessionalTermsVersion {
  version: 'v2';
  displayVersion: '2.0';
  title: string;
  summary: string;
  effectiveFrom: string;
  documentHash: string;
  legalEntityDetailsConfigured: false;
  sections: ProfessionalTermsSection[];
}

export const CURRENT_PROFESSIONAL_TERMS_VERSION = 'v2' as const;
export const CURRENT_PROFESSIONAL_TERMS_DISPLAY_VERSION = '2.0' as const;
export const PROFESSIONAL_TERMS_LEGAL_REVIEW_MARKER = 'LEGAL_ENTITY_DETAILS_REQUIRED_FOR_PRODUCTION' as const;

/**
 * Canonical v2 content. Keep this object immutable: an accepted version must
 * always resolve to the same text and hash. Company placeholders are
 * intentional until the legal entity is configured for production.
 */
export const PROFESSIONAL_TERMS_V2: ProfessionalTermsVersion = Object.freeze({
  version: CURRENT_PROFESSIONAL_TERMS_VERSION,
  displayVersion: CURRENT_PROFESSIONAL_TERMS_DISPLAY_VERSION,
  title: 'Termo de Adesão, Uso e Conduta do Profissional MAZZI',
  summary: 'Leia as regras para trabalhar pelo MAZZI. Elas tratam de segurança, documentos, aulas, veículos, pagamentos, privacidade e conduta.',
  effectiveFrom: '2026-09-09T00:00:00-03:00',
  documentHash: 'sha256:c256a7d94920ada35d9a7ad6528cb38a1bf7cdd23e0e336d6b4c48eba2c8b69f',
  legalEntityDetailsConfigured: false,
  sections: [
    {
      id: 'introduction',
      title: 'Introdução',
      paragraphs: [
        'Este Termo de Adesão, Uso e Conduta do Profissional (“Termo”) estabelece as condições aplicáveis ao uso da plataforma MAZZI por instrutores de trânsito, autoescolas, Centros de Formação de Condutores — CFCs — e demais prestadores profissionais habilitados a oferecer serviços por meio da plataforma (“PRO” ou “Profissional”).',
        'O MAZZI é operado por: [RAZÃO SOCIAL DA EMPRESA]. CNPJ: [CNPJ]. Endereço: [ENDEREÇO]. Esses dados ainda não estão configurados para produção.',
        'Ao selecionar “Li e aceito o Termo de Adesão, Uso e Conduta do Profissional MAZZI” e concluir o aceite eletrônico, o Profissional declara que leu, teve oportunidade de consultar, compreendeu e concorda com este Termo.',
      ],
    },
    {
      id: 'object',
      title: '1. Objeto',
      paragraphs: [
        'O MAZZI é uma plataforma tecnológica destinada a aproximar pessoas interessadas em serviços relacionados à formação prática de condutores de profissionais e estabelecimentos aptos a prestar esses serviços.',
        'A plataforma atua como instrumento de intermediação tecnológica e não ministra diretamente as aulas disponibilizadas pelos Profissionais.',
      ],
      bullets: ['divulgação de perfil profissional', 'localização e busca de profissionais', 'agenda', 'solicitações e contratações', 'gerenciamento de aulas', 'comunicação entre Aluno e Profissional', 'avaliações', 'pagamentos e repasses quando habilitados', 'recursos de segurança', 'acompanhamento de aulas', 'ferramentas administrativas e de gestão'],
    },
    {
      id: 'requirements',
      title: '2. Requisitos para atuação',
      paragraphs: [
        'O Profissional declara possuir e manter autorizações, registros, credenciamentos, habilitações, documentos e demais requisitos legais e regulatórios necessários ao exercício de sua atividade.',
        'O instrutor deve estar legalmente apto ao exercício da profissão e autorizado a ministrar aulas nas categorias anunciadas. A autoescola/CFC deve possuir registros, credenciamentos, estrutura, profissionais e requisitos necessários à atividade.',
        'O Profissional é responsável por acompanhar alterações nas normas aplicáveis. O MAZZI poderá solicitar documentação comprobatória.',
      ],
    },
    {
      id: 'truthfulness',
      title: '3. Veracidade das informações',
      paragraphs: ['Todas as informações fornecidas devem ser verdadeiras, completas, atualizadas e pertencentes ao respectivo titular.', 'A aprovação documental pelo MAZZI não substitui fiscalização ou autorização dos órgãos públicos.'],
      bullets: ['É proibido usar documento falso ou adulterado.', 'É proibido apresentar documento vencido como vigente.', 'É proibido usar documento pertencente a terceiro ou identidade falsa.', 'É proibida a falsificação de registros.', 'É proibida a omissão de suspensão ou impedimento relevante.', 'É proibido cadastrar veículo sem legitimidade de uso.', 'É proibido utilizar dados de terceiros sem autorização.'],
    },
    {
      id: 'account-security',
      title: '4. Conta e segurança',
      paragraphs: ['A conta é pessoal. Cada pessoa deve possuir sua própria identidade de acesso. Autoescola/CFC não deve compartilhar uma única credencial entre vários funcionários.', 'Suspeitas de acesso indevido devem ser comunicadas ao MAZZI.'],
      bullets: ['Não compartilhe senha, OTP, código de acesso ou credenciais pessoais.'],
    },
    {
      id: 'professional-conduct',
      title: '5. Conduta profissional',
      paragraphs: ['O Profissional deve atuar com respeito, segurança, responsabilidade, boa-fé e profissionalismo.', 'Deve tratar o Aluno com respeito, cumprir horários, observar normas de trânsito, orientar com segurança, preservar a integridade física e emocional do Aluno e respeitar sua privacidade.'],
      bullets: ['É proibida discriminação, abuso, ameaça ou constrangimento.', 'É proibido assédio moral ou sexual e violência.', 'É proibido ministrar aula sob efeito de álcool ou drogas.', 'É proibido incentivar conduta ilegal.', 'É proibido manipular avaliações.', 'É proibido fraudar reserva, pagamento, localização, horário ou registro de aula.'],
    },
    {
      id: 'vehicles',
      title: '6. Veículos',
      paragraphs: ['Quando o veículo for fornecido pelo Profissional, ele declara que o veículo está regularmente registrado e licenciado, atende às exigências aplicáveis, está em condições adequadas, possui equipamentos obrigatórios e pode ser legitimamente utilizado na prestação do serviço.', 'O Profissional é responsável pela regularidade, manutenção e segurança. O MAZZI pode bloquear veículo irregular, vencido, pendente, rejeitado ou incompatível com os requisitos da plataforma.'],
    },
    {
      id: 'availability',
      title: '7. Disponibilidade e agenda',
      paragraphs: ['O Profissional é responsável por manter sua disponibilidade atualizada. Horário disponibilizado representa disponibilidade real para eventual contratação válida.', 'O Profissional deverá evitar faltas injustificadas, cancelamentos abusivos, atrasos recorrentes e agenda desatualizada.'],
    },
    {
      id: 'pricing',
      title: '8. Preço e contratação',
      paragraphs: ['Salvo regra específica, o Profissional possui autonomia para definir os valores dos serviços oferecidos. O Aluno deve receber previamente as informações essenciais da oferta. Não se devem cobrar valores adicionais não informados previamente.', 'Quando existir mecanismo de “quanto o Aluno aceita pagar”, a decisão de aceitar ou não a oportunidade continua pertencendo ao Profissional.'],
    },
    {
      id: 'payments',
      title: '9. Pagamentos, taxas e repasses',
      paragraphs: ['Quando pagamentos reais forem habilitados, as condições financeiras serão apresentadas previamente. O MAZZI poderá cobrar comissão, taxa, intermediação ou outros valores claramente informados.', 'O Profissional é responsável por suas obrigações fiscais, tributárias e contábeis. O MAZZI poderá reter temporariamente valores em hipóteses legítimas como contestação, fraude, segurança ou obrigação legal.', 'No ambiente atual, o sistema continua MOCK / MOCK_VALIDATION. Este Termo não implementa pagamento real.'],
    },
    {
      id: 'cancellations',
      title: '10. Cancelamentos, faltas e reembolsos',
      paragraphs: ['Aplica-se a política vigente do MAZZI. Podem ser considerados antecedência, ausência, segurança, força maior e falha operacional. Determinadas hipóteses podem gerar reembolso, não pagamento ou estorno conforme as regras aplicáveis.'],
    },
    {
      id: 'location',
      title: '11. Localização',
      paragraphs: ['O MAZZI poderá tratar dados de localização para busca, encontro, segurança e execução das aulas.', 'Endereço exato e coordenadas privadas não devem ser apresentados publicamente de forma indiscriminada. A busca pública continua utilizando o contrato de localização protegida existente.'],
    },
    {
      id: 'reviews',
      title: '12. Avaliações',
      paragraphs: ['Alunos poderão avaliar a experiência. As avaliações poderão ser usadas para informar usuários, indicadores de qualidade, relatórios ao PRO, segurança, identificação de problemas e medidas administrativas.'],
      bullets: ['É proibido comprar, fabricar, manipular ou coagir usuário para obter avaliação.'],
    },
    {
      id: 'data-protection',
      title: '13. Proteção de dados',
      paragraphs: ['O MAZZI trata dados pessoais de acordo com a legislação aplicável. As finalidades podem incluir conta, identidade, elegibilidade, compliance, contratação, fraude, segurança, pagamentos, atendimento, obrigações legais e melhoria dos serviços.', 'Este Termo deve ser interpretado em conjunto com a Política de Privacidade do MAZZI.'],
    },
    {
      id: 'relationship-mazzi',
      title: '14. Relação MAZZI / Profissional',
      paragraphs: ['O MAZZI fornece infraestrutura tecnológica. A adesão à plataforma, por si só, não cria sociedade, representação comercial, franquia ou vínculo empregatício.', 'O Profissional mantém autonomia sobre a prestação dos seus serviços, observada a legislação aplicável.'],
    },
    {
      id: 'relationship-student',
      title: '15. Relação Profissional / Aluno',
      paragraphs: ['O Profissional é responsável pela execução técnica e segura do serviço e deve fornecer informações verdadeiras e claras. A plataforma não elimina obrigações legais que possam existir na relação com o consumidor.'],
    },
    {
      id: 'cooperation',
      title: '16. Fiscalização e cooperação',
      paragraphs: ['O Profissional deverá cooperar com solicitações legítimas das autoridades. É proibido utilizar o MAZZI para ocultar atividade irregular. O MAZZI poderá atender requisições legais válidas.'],
    },
    {
      id: 'suspension',
      title: '17. Suspensão e bloqueio',
      paragraphs: ['O MAZZI poderá restringir, suspender ou bloquear funcionalidades em casos como documento vencido, perda de requisito, fraude, risco à segurança, reclamação grave, investigação, violação do Termo ou determinação de autoridade competente.', 'Quando apropriado, o Profissional deverá receber informação sobre o motivo e possibilidade de regularização.'],
    },
    {
      id: 'termination',
      title: '18. Encerramento',
      paragraphs: ['O Profissional poderá solicitar encerramento observadas obrigações pendentes. Registros poderão ser preservados quando necessários para obrigação legal, fraude, auditoria, segurança, exercício regular de direitos ou disputa.'],
    },
    {
      id: 'changes',
      title: '19. Alterações do Termo',
      paragraphs: ['O MAZZI poderá atualizar o Termo. Cada versão deve possuir identificação própria. Mudanças relevantes exigem novo aceite. O aceite de uma versão não significa aceite automático de versões futuras.'],
    },
    {
      id: 'communications',
      title: '20. Comunicações',
      paragraphs: ['O MAZZI poderá se comunicar por app, e-mail, push ou outros canais cadastrados. O Profissional deve manter os contatos atualizados.'],
    },
    {
      id: 'law',
      title: '21. Legislação',
      paragraphs: ['Este Termo será interpretado de acordo com a legislação brasileira. A atividade deverá observar, conforme aplicável, o Código de Trânsito Brasileiro, a legislação da profissão de Instrutor de Trânsito, CONTRAN, SENATRAN, DETRAN e demais autoridades competentes.'],
    },
    {
      id: 'final',
      title: '22. Disposições finais',
      paragraphs: ['Tolerância eventual não significa renúncia de direito. A invalidade de uma cláusula não invalida automaticamente as demais.', 'Este Termo deve ser interpretado junto com a Política de Privacidade, Política de Cancelamento, regras de pagamento e demais políticas MAZZI.'],
    },
    {
      id: 'acceptance',
      title: 'Declaração de aceite',
      paragraphs: ['Ao prosseguir, o Profissional declara que leu o Termo, teve oportunidade de consultar o conteúdo, compreendeu suas condições, forneceu informações verdadeiras, compromete-se a manter os requisitos profissionais, compromete-se com segurança e respeito, concorda com as regras do MAZZI e sabe que nova versão relevante poderá exigir novo aceite.'],
    },
  ],
});

export const PROFESSIONAL_TERMS_BY_VERSION: Record<string, ProfessionalTermsVersion> = {
  [PROFESSIONAL_TERMS_V2.version]: PROFESSIONAL_TERMS_V2,
};

export const serializeProfessionalTerms = (terms: ProfessionalTermsVersion) => JSON.stringify({
  version: terms.version,
  displayVersion: terms.displayVersion,
  title: terms.title,
  summary: terms.summary,
  effectiveFrom: terms.effectiveFrom,
  legalEntityDetailsConfigured: terms.legalEntityDetailsConfigured,
  sections: terms.sections,
});

export const getProfessionalTermsVersion = (version: string | undefined) => (
  version ? PROFESSIONAL_TERMS_BY_VERSION[version] : undefined
);

export const hasConfiguredLegalEntityDetails = (terms: ProfessionalTermsVersion) => terms.legalEntityDetailsConfigured;
