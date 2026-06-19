export type WhatsAppPipelineStage =
  | 'LEAD'
  | 'QUALIFICACAO'
  | 'EM_NEGOCIACAO'
  | 'FECHAMENTO'
  | 'NAO_FECHOU';

export type WhatsAppMessageAnalysis = {
  stage: WhatsAppPipelineStage;
  summary: string;
  nextStep: string;
  suggestedReply: string;
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function analyzeWhatsAppMessage(message: string): WhatsAppMessageAnalysis {
  const text = normalizeText(message);

  if (
    hasAny(text, [
      'nao tenho interesse',
      'sem interesse',
      'nao quero',
      'desisti',
      'cancelar',
      'ficou caro',
      'muito caro',
      'nao vou fechar',
    ])
  ) {
    return {
      stage: 'NAO_FECHOU',
      summary: 'Cliente demonstrou sem interesse ou recusou a proposta.',
      nextStep: 'Registrar o motivo da perda e encerrar a negociação.',
      suggestedReply: 'Tudo bem. Obrigado pelo retorno, fico à disposição se precisar no futuro.',
    };
  }

  if (
    hasAny(text, [
      'pode fechar',
      'vamos fechar',
      'fechado',
      'aceito',
      'quero contratar',
      'contrato',
      'pix',
      'pagamento',
    ])
  ) {
    return {
      stage: 'FECHAMENTO',
      summary: 'O cliente aceitou a proposta e está pronto para fechar.',
      nextStep: 'Enviar os dados finais e confirmar pagamento ou assinatura.',
      suggestedReply: 'Perfeito. Vou separar os próximos passos para concluirmos.',
    };
  }

  if (
    hasAny(text, [
      'valor',
      'preco',
      'preço',
      'desconto',
      'proposta',
      'orcamento',
      'orçamento',
      'condicao',
      'condição',
      'negociar',
    ])
  ) {
    return {
      stage: 'EM_NEGOCIACAO',
      summary: 'Cliente está negociando valores, condições ou proposta.',
      nextStep: 'Responder com preço, condição comercial ou ajuste possível.',
      suggestedReply: 'Consigo te passar as condições e ver a melhor opção para o seu caso.',
    };
  }

  if (
    hasAny(text, [
      'tenho interesse',
      'quero saber',
      'preciso',
      'duvida',
      'dúvida',
      'como funciona',
      'me explica',
    ])
  ) {
    return {
      stage: 'QUALIFICACAO',
      summary: 'Cliente demonstrou interesse e precisa ser qualificado.',
      nextStep: 'Entender necessidade, prazo e orçamento antes de enviar proposta.',
      suggestedReply: 'Claro. Me conta um pouco mais sobre o que você precisa?',
    };
  }

  return {
    stage: 'LEAD',
    summary: 'Nova mensagem recebida pelo WhatsApp.',
    nextStep: 'Responder e iniciar a qualificação do contato.',
    suggestedReply: 'Olá. Recebi sua mensagem e já vou te ajudar.',
  };
}
