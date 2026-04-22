# 1. Justificativa da problemática

Atualmente, o WhatsApp é um dos principais canais de comunicação entre empresas e clientes. Apesar de sua praticidade, ele não foi projetado para operar como ferramenta completa de gestão comercial e atendimento. Em ambientes com maior volume de contatos, a ausência de controle estruturado dificulta o acompanhamento do ciclo de atendimento, a distribuição de responsabilidades entre usuários e a rastreabilidade das interações realizadas.

Em muitos cenários, as conversas permanecem dispersas entre diferentes atendentes ou dispositivos, o que prejudica a continuidade do relacionamento com o cliente. Isso gera perda de contexto, falhas de comunicação, atraso em respostas, retrabalho operacional e baixa visibilidade sobre o andamento das negociações. Além disso, a falta de centralização impede que gestores acompanhem de forma confiável indicadores como tempo de resposta, conversão por etapa, volume de leads em aberto e taxa de perda de oportunidades.

Como alternativa, muitas empresas ainda recorrem a planilhas, anotações manuais e controles paralelos. Embora esses métodos possam funcionar em operações pequenas, eles se tornam frágeis conforme o volume cresce. Esse tipo de processo tende a ser repetitivo, sujeito a erros, difícil de auditar e desconectado do canal onde a comunicação realmente acontece.

Diante desse contexto, torna-se necessária a criação de um sistema que una comunicação, histórico, acompanhamento comercial e organização operacional em um único ambiente. O CRM BOT DE IA VIA WHATSAPP surge para atender essa necessidade, integrando o canal do WhatsApp a uma estrutura de CRM com registro automático de interações, organização por funil e apoio assistido por inteligência artificial.

# 2. Objetivos da aplicação

## 2.1 Objetivo geral

Desenvolver um sistema de CRM integrado ao WhatsApp capaz de registrar, centralizar e organizar automaticamente as interações com clientes e leads, apoiando o processo de atendimento, qualificação e acompanhamento de oportunidades comerciais.

## 2.2 Objetivos específicos

O projeto busca estruturar o atendimento comercial em torno de uma operação mais organizada, rastreável e menos dependente de controles manuais. Para isso, os objetivos específicos da solução são:

* organizar contatos recebidos pelo WhatsApp em registros estruturados de leads e clientes
* registrar mensagens recebidas e enviadas, além de eventos internos relevantes
* permitir acompanhamento visual das oportunidades por meio de etapas de funil
* centralizar o histórico de atendimento em um único sistema
* reduzir o uso de planilhas e anotações paralelas
* apoiar o usuário com recursos de inteligência artificial voltados à sugestão de respostas, sumarização de contexto e apoio à classificação de leads

## 2.3 Resultados esperados

Com a implantação da solução, espera-se melhorar a continuidade do atendimento, reduzir perda de leads por ausência de retorno, aumentar a visibilidade do pipeline comercial e apoiar a padronização do atendimento com recursos assistidos por IA. Também se espera criar uma base mínima de métricas que permita acompanhamento gerencial e identificação de gargalos operacionais.

## 2.4 Valor para uma empresa de maior porte

Em um cenário corporativo com múltiplos atendentes, supervisores e fluxos simultâneos, o sistema oferece benefícios adicionais. Entre eles estão a centralização de informações, melhor governança sobre o atendimento, maior controle sobre histórico e responsabilidade por ação, além de uma base mais sólida para evolução futura em relatórios, automações, gestão de performance e auditoria operacional.

# 3. Visão geral e descrição do sistema

## 3.1 O que é o sistema

O CRM BOT DE IA VIA WHATSAPP é um sistema de gestão de relacionamento com clientes voltado para operações em que o WhatsApp é o principal canal de atendimento. A proposta do sistema é transformar interações de conversa em registros estruturados de CRM, permitindo acompanhar leads, histórico, etapas de negociação e ações futuras em uma interface única.

A solução combina quatro pilares principais:

* organização de leads em formato visual por etapas
* histórico estruturado de mensagens e interações
* integração com WhatsApp por meio de API externa
* apoio de inteligência artificial como recurso assistido ao usuário

## 3.2 Problema que o sistema resolve

O sistema foi concebido para resolver a falta de controle operacional em atendimentos feitos exclusivamente pelo WhatsApp. Sem uma camada de CRM, a empresa perde visibilidade sobre quem atendeu, qual foi a última tratativa, em que etapa a oportunidade se encontra e qual ação deve ocorrer em seguida. O sistema reduz essa dependência de memória individual e transforma o processo em algo mais padronizado, compartilhável e gerenciável.

## 3.3 Público-alvo e usuários principais

### Atendente ou SDR

Responsável pelo primeiro contato, qualificação inicial do lead, registro de informações e continuidade básica do relacionamento.

### Vendedor ou Closer

Responsável por conduzir negociação, registrar proposta, acompanhar follow-ups e concluir a oportunidade como ganha ou perdida.

### Gestor

Responsável por acompanhar produtividade, gargalos por etapa, quantidade de leads em aberto e tempo sem resposta.

### Administrador

Responsável por usuários, permissões, parâmetros do sistema, integrações e possíveis ajustes no funil.

## 3.4 Conceitos centrais da solução

**Lead ou Cliente**
Contato identificado, principalmente, por número de telefone vinculado ao WhatsApp.

**Oportunidade**
Negociação associada ao lead, podendo no MVP ser tratada de forma simplificada.

**Etapa**
Posição do lead dentro do funil comercial.

**Card**
Representação visual do lead no kanban.

**Interação**
Qualquer evento relevante registrado no histórico, como mensagem, nota, mudança de etapa ou follow-up.

**Follow-up**
Próxima ação planejada, com data e hora, para dar continuidade ao atendimento.

## 3.5 Componentes que formam o sistema

### Interface web

Camada utilizada pelos usuários para login, operação do funil, consulta de histórico, registro de ações, filtros, busca e gestão operacional do atendimento.

### API principal do CRM

Camada responsável por regras de negócio, validações, autenticação, persistência, integração com banco e orquestração com serviços externos.

### Integração com WhatsApp

Camada que recebe eventos e mensagens vindas do canal e também permite o envio de mensagens pelo sistema.

### Microserviço de inteligência artificial

Camada separada para geração de sugestões, resumos e apoio à classificação de contexto. A IA é tratada como assistida, ou seja, ela sugere e o usuário decide o que será efetivamente enviado.

## 3.6 Fluxo geral de funcionamento

1. O cliente envia uma mensagem pelo WhatsApp.
2. A integração recebe esse evento e encaminha ao CRM.
3. O CRM localiza ou cria o lead correspondente.
4. A mensagem é registrada no histórico da conversa.
5. O front-end atualiza o kanban e a timeline.
6. O usuário atende o lead, registra observações e movimenta etapas.
7. A IA pode apoiar com sugestão de resposta, resumo e classificação.

# 4. Regras de negócio do CRM e do funil

## 4.1 Organização por funil

O sistema organiza os leads em etapas de atendimento e negociação. Como fluxo padrão, podem ser utilizadas as etapas Novo, Em contato, Qualificação, Proposta, Negociação, Ganho e Perdido. Preferencialmente, essas etapas devem ser configuráveis em nome, ordem e identificação visual.

Essa configuração permite adaptar o sistema a diferentes modelos de operação sem alterar a base estrutural da aplicação.

## 4.2 Regras de movimentação de etapas

A mudança de etapa não deve ser tratada apenas como alteração visual. Cada movimentação precisa gerar histórico rastreável, incluindo origem, destino, data e usuário responsável. Em operações com maior necessidade de controle, o sistema pode ainda impedir saltos arbitrários entre etapas, exigindo progressão sequencial quando essa política estiver habilitada.

Quando a oportunidade for encerrada, a regra de negócio deve exigir informações mínimas de fechamento. No caso de ganho, pode ser registrado valor estimado e data de fechamento. No caso de perda, deve ser informado o motivo, com observação opcional. Isso fortalece a qualidade analítica dos dados e melhora a leitura de resultados futuros.

## 4.3 Qualificação do lead

A qualificação do lead deve considerar um conjunto de campos que ajudem na organização comercial e futura segmentação. Entre os principais atributos, destacam-se origem, tags, score ou temperatura, interesse, orçamento e prazo. Esses dados ajudam na priorização, no contexto comercial e na tomada de decisão do time.

## 4.4 Follow-up e continuidade operacional

O sistema deve permitir associar ao lead uma próxima ação com data e hora. Esse follow-up funciona como mecanismo de continuidade do atendimento e evita abandono de oportunidades. Quando a ação estiver vencida, o sistema pode destacar esse lead no kanban e em áreas de acompanhamento gerencial, ajudando a reduzir atrasos e perda de oportunidades por esquecimento.

## 4.5 Histórico e auditoria

Toda mudança relevante deve gerar um evento rastreável. Isso inclui mensagens recebidas e enviadas, mudança de etapa, alteração de campos críticos, criação de registros e fechamento de oportunidades. Em uma visão mais empresarial, isso é essencial para garantir governança operacional, reconstituição de contexto e suporte a auditoria interna.

## 4.6 Diretrizes operacionais para ambiente corporativo

Para um cenário de empresa maior, essas regras ganham ainda mais importância porque reduzem dependência de atuação individual e fortalecem padronização. Em vez de o processo ficar preso à memória do atendente, ele passa a estar documentado dentro do próprio sistema. Isso melhora transferência entre usuários, supervisão, qualidade do atendimento e capacidade de escalar a operação com maior consistência.

# 5. Stack Tecnológica

## 5.1 Visão geral da stack

A solução foi estruturada em camadas independentes, com tecnologias específicas para interface web, regras de negócio, persistência de dados, inteligência artificial, integração com WhatsApp, testes e documentação da API. Essa separação tem como objetivo melhorar a organização do projeto, facilitar a manutenção, permitir evolução modular do sistema e apoiar uma arquitetura escalável para cenários corporativos.

A stack adotada foi definida para atender tanto às necessidades operacionais do CRM quanto à integração com automação de atendimento via WhatsApp, mantendo clareza arquitetural, produtividade de desenvolvimento e facilidade de testes.

## 5.2 Front-end

O front-end será desenvolvido com **TypeScript**, **React**, **Vite**, **Tailwind CSS** e **Zustand**.

**TypeScript** será utilizado para adicionar tipagem estática ao projeto, reduzindo erros, melhorando a previsibilidade do código e facilitando a manutenção em sistemas com maior volume de regras e componentes.

**React** será a biblioteca responsável pela construção da interface da aplicação. Sua abordagem baseada em componentes favorece reaproveitamento, organização da interface e evolução do sistema de forma modular.

**Vite** será utilizado como ferramenta de build e ambiente de desenvolvimento do front-end. Sua adoção contribui para inicialização rápida do projeto, atualização ágil durante o desenvolvimento e boa performance na etapa de empacotamento da aplicação.

**Tailwind CSS** será a biblioteca de estilização da interface. Seu uso permite padronização visual, maior agilidade na construção das telas e melhor controle sobre responsividade.

**Zustand** será utilizado no gerenciamento de estado global da aplicação, especialmente para autenticação, filtros, dados de interface e informações compartilhadas entre páginas e componentes.

**Papel do front-end no sistema:**
A camada de front-end será responsável por apresentar o CRM ao usuário, incluindo login, dashboard, funil de leads, cards do kanban, histórico de conversas, formulários, filtros, follow-ups e interações com os módulos de atendimento e gestão.

## 5.3 Back-end

O back-end será desenvolvido com **TypeScript**, **Express.js** e **Prisma ORM**.

**TypeScript** será utilizado também no servidor para manter consistência entre as camadas da aplicação, melhorar a legibilidade do código e reduzir falhas em contratos de dados, validações e regras de negócio.

**Express.js** será o framework responsável pela API REST do sistema. Sua escolha se justifica pela simplicidade de estruturação, facilidade de organização por rotas e middleware, além de boa aderência para projetos que exigem integração com serviços externos e separação clara entre módulos de negócio.

**Prisma ORM** será utilizado para o acesso ao banco de dados. Ele facilita a modelagem das entidades, melhora a segurança nas consultas, simplifica operações de leitura e escrita e contribui para uma camada de persistência mais organizada.

**Papel do back-end no sistema:**
A API será responsável por autenticação, controle de acesso, cadastro e atualização de leads, movimentação de cards no funil, registro de interações, histórico de mensagens, integração com a Evolution API, consumo do microserviço de IA e persistência dos dados operacionais do CRM.

## 5.4 Banco de dados

O banco de dados principal do sistema será o **PostgreSQL**, com apoio do **DBeaver** como ferramenta auxiliar de administração.

O **PostgreSQL** foi escolhido por ser um banco relacional robusto, confiável e amplamente utilizado em aplicações corporativas. Sua adoção é adequada para cenários que exigem integridade de dados, relações estruturadas, histórico rastreável e consistência transacional.

O **DBeaver** será utilizado como ferramenta de apoio para administração, inspeção e validação do banco durante desenvolvimento e manutenção. Ele não compõe a stack produtiva da aplicação, mas apoia a operação técnica do projeto.

## 5.5 Inteligência Artificial

A camada de IA será desenvolvida com **Python**, **FastAPI**, **OpenAI API** e **LangChain**.

**Python** foi escolhido pela maturidade no ecossistema de inteligência artificial.

**FastAPI** será utilizado para expor o microserviço de IA por endpoints independentes.

**OpenAI API** será aplicada nas funções de sugestão de resposta, sumarização e apoio à classificação.

**LangChain** será utilizado para estruturar o fluxo de prompts e tratamento de contexto, quando necessário.

**Papel da IA no sistema:**
Apoiar o atendimento, reduzir tempo de resposta, resumir histórico de interações, sugerir mensagens e auxiliar na qualificação do lead.

## 5.6 Integração com WhatsApp

A integração com o canal será realizada por meio da **Evolution API**, responsável por receber eventos do WhatsApp e permitir envio de mensagens a partir do CRM.

Essa camada tem papel central no projeto porque conecta o canal de comunicação externo ao ambiente interno de gestão, permitindo que as interações sejam registradas, rastreadas e utilizadas dentro do fluxo comercial.

## 5.7 Testes

A estratégia de testes utilizará **Vitest**, **Supertest** e **React Testing Library**.

**Vitest** será utilizado em testes unitários no front-end e no back-end.
**Supertest** será utilizado para testes de integração da API.
**React Testing Library** será utilizada para validar componentes e comportamento da interface.

Essa composição atende bem aos fluxos críticos do sistema, como autenticação, webhook, envio de mensagem, movimentação de etapa, kanban e timeline.

## 5.8 Documentação da API

A documentação técnica da API será feita com **Swagger**, seguindo padrão OpenAPI. Isso permite documentar endpoints, payloads, respostas, erros e exemplos de consumo, facilitando integração entre camadas e entendimento da API por diferentes perfis técnicos.

## 5.9 Resumo executivo da stack

| Camada                       | Tecnologias                                    |
| ---------------------------- | ---------------------------------------------- |
| Front-end                    | TypeScript, React, Vite, Tailwind CSS, Zustand |
| Back-end                     | TypeScript, Express.js, Prisma ORM             |
| Banco de Dados               | PostgreSQL                                     |
| Ferramenta de Apoio ao Banco | DBeaver                                        |
| Inteligência Artificial      | Python, FastAPI, OpenAI API, LangChain         |
| Testes                       | Vitest, Supertest, React Testing Library       |
| Documentação                 | Swagger / OpenAPI                              |
| Integrações                  | Evolution API                                  |

## 5.10 Consideração arquitetural

Para uma empresa de maior porte, essa stack é adequada porque separa interface, regras de negócio, persistência, integração e IA em camadas distintas. Isso melhora a manutenção, facilita divisão de responsabilidades entre equipes e permite evolução modular do sistema sem concentrar toda a complexidade em um único ponto.

# 6. Arquitetura do sistema

## 6.1 Visão arquitetural

A arquitetura do CRM BOT DE IA VIA WHATSAPP foi definida de forma modular, separando claramente as responsabilidades entre interface, regras de negócio, persistência de dados, integração com canal externo e processamento de inteligência artificial. Essa divisão reduz acoplamento, melhora a manutenção do sistema e facilita futuras evoluções da solução.

Em um ambiente corporativo, essa organização é importante porque permite que cada camada tenha função bem definida. O front-end concentra a experiência operacional do usuário. O back-end centraliza validações, regras e orquestração. O banco de dados preserva consistência das informações. A integração com WhatsApp conecta o sistema ao canal real de atendimento. O microserviço de IA atua como apoio especializado, sem misturar sua lógica com a API principal.

## 6.2 Componentes principais da arquitetura

A solução pode ser entendida a partir de cinco blocos principais:

### Interface Web

Camada usada por atendentes, vendedores, gestores e administradores para operar o CRM.

### API do CRM

Camada central do sistema, responsável por autenticação, regras de negócio, validações, persistência e integração com serviços externos.

### Banco de Dados

Camada responsável pelo armazenamento estruturado de usuários, leads, etapas, mensagens, interações, histórico e registros operacionais.

### Integração com WhatsApp

Camada encarregada de receber eventos do canal e permitir envio de mensagens a partir do sistema.

### Microserviço de Inteligência Artificial

Camada dedicada a funções específicas de apoio textual, como sugestão de resposta, sumarização de histórico e classificação de contexto.

## 6.3 Comunicação entre os componentes

O fluxo geral da arquitetura segue uma lógica centralizada na API do CRM:

1. O usuário interage com a interface web.
2. O front-end envia requisições HTTP para a API principal.
3. A API processa regras de negócio e consulta ou grava dados no banco.
4. Quando necessário, a API também se comunica com a Evolution API e com o microserviço de IA.
5. A resposta é devolvida ao front-end, que atualiza a interface operacional.

Esse modelo permite que o front-end não tenha responsabilidade direta sobre regras sensíveis, integrações externas ou consistência transacional, o que fortalece segurança e governança da aplicação.

## 6.4 Princípios arquiteturais adotados

Para um cenário de empresa maior, a arquitetura deve seguir alguns princípios claros:

* separação de responsabilidades entre camadas
* centralização das regras de negócio no back-end
* uso de integração por contrato definido
* rastreabilidade de eventos relevantes
* capacidade de evolução modular
* possibilidade de ampliação futura sem reescrita completa da base

# 7. Arquitetura do Front-end

## 7.1 Visão geral

O front-end foi concebido como uma aplicação web do tipo SPA, com foco em operação contínua, leitura rápida das informações e atualização ágil da interface. Em termos práticos, essa camada precisa sustentar o uso diário do CRM por perfis diferentes, exibindo leads, mensagens, etapas e ações de forma clara e produtiva.

Em um sistema voltado para uma empresa de maior porte, a interface não deve apenas ser bonita. Ela deve ser operacional, objetiva e consistente. O principal papel do front-end é transformar os dados e eventos do CRM em uma experiência de uso que reduza esforço, melhore a leitura do funil e facilite a execução do atendimento.

## 7.2 Estrutura funcional da interface

### Login

Tela responsável por autenticação do usuário e início da sessão.

### Dashboard

Área de acompanhamento gerencial e operacional, com visão resumida de pendências, leads sem resposta, follow-ups vencidos e distribuição por etapa.

### Funil ou Kanban

Tela central da operação, na qual os leads são exibidos em colunas correspondentes às etapas do processo comercial.

### Detalhe do Lead

Área dedicada à visualização completa do lead, incluindo dados cadastrais, histórico, mensagens, notas internas, classificação e ações futuras.

### Histórico de Conversas

Área voltada à consulta e navegação pelas conversas registradas no sistema.

### Configurações

Área reservada para parametrizações do sistema, usuários, permissões e ajustes administrativos.

## 7.3 Componentes principais

**KanbanBoard**
Componente responsável pela montagem do funil visual.

**PipelineColumn**
Representa cada etapa do pipeline, agrupando os leads correspondentes.

**LeadCard**
Exibe informações resumidas do lead dentro do kanban.

**LeadDetailsHeader**
Apresenta dados principais do lead no topo da visualização detalhada.

**LeadForm**
Responsável por cadastro e edição de informações estruturadas.

**ConversationTimeline**
Exibe o histórico cronológico de mensagens e interações.

**MessageComposer**
Área de composição e envio de mensagens.

**InteractionList**
Lista eventos complementares, como notas e alterações internas.

**FollowUpWidget**
Permite registrar e acompanhar próximas ações.

**FiltersBar**
Concentra busca, filtros e critérios de segmentação.

## 7.4 Gerenciamento de estado

O gerenciamento de estado global será realizado com Zustand, distribuindo a responsabilidade entre stores com funções específicas. Essa organização é adequada para manter a camada de interface organizada sem criar dependência excessiva entre componentes.

Em uma visão corporativa, isso significa que o front-end terá controle centralizado sobre:

* sessão do usuário
* permissões e dados de autenticação
* estados de interface
* filtros ativos
* lead selecionado
* dados de timeline e contexto operacional

Essa organização melhora previsibilidade e facilita manutenção.

## 7.5 Comunicação com a API

A comunicação com a API ocorrerá por meio de cliente HTTP padronizado, com tratamento central de autenticação, erros e respostas. O sistema deve prever comportamento esperado para erros como 401, 403, 422 e 500. Isso é importante porque define uma experiência mais consistente para o usuário e reduz tratamento improvisado em cada tela.

Em um contexto empresarial, a interface deve reagir de forma previsível a falhas, exibindo mensagens claras, evitando perda de contexto e mantendo integridade do fluxo operacional.

## 7.6 Organização técnica do front-end

A estrutura recomendada para o front-end considera a separação em diretórios como pages, components, store, services, types, utils e styles. Essa divisão favorece organização, reaproveitamento, manutenção e clareza no crescimento da aplicação.

## 7.7 Papel estratégico do front-end

Para uma empresa maior, o front-end não é apenas uma camada visual. Ele é a superfície operacional do negócio. Sua responsabilidade é permitir que diferentes usuários consigam compreender rapidamente o estado do atendimento, atuar com agilidade e reduzir falhas humanas no uso do CRM. Por isso, clareza, consistência e foco operacional devem ser prioridades permanentes dessa camada.

# 8. Arquitetura do Back-end

## 8.1 Visão geral

O back-end do sistema foi definido como a camada central de orquestração da solução. É nele que ficam concentradas as regras de negócio, a autenticação, o controle de acesso, a comunicação com o banco de dados e a integração com serviços externos. Em termos arquiteturais, isso garante que o front-end opere de maneira mais simples, enquanto a lógica crítica permanece protegida e centralizada.

## 8.2 Estrutura em camadas

### Controllers

Recebem as requisições HTTP, executam validações iniciais, encaminham o processamento e retornam respostas padronizadas.

### Services

Concentram as regras de negócio do sistema, como movimentação de etapa, validações do funil, deduplicação de leads e orquestração de integrações.

### Repositories

Intermediam o acesso aos dados persistidos, organizando a comunicação com o Prisma e o PostgreSQL.

### DTOs e Validators

Definem os contratos de entrada e saída da API, ajudando a garantir consistência dos dados e previsibilidade entre as camadas.

## 8.3 Módulos do back-end

* **Auth**: autenticação, autorização e perfil de acesso
* **Leads**: cadastro, consulta, edição e busca de registros
* **Pipeline**: gestão das etapas e histórico de movimentação
* **Conversations**: controle lógico das conversas por canal e lead
* **Messages**: registro e envio de mensagens
* **Interactions**: notas, eventos internos e follow-ups
* **Integrations/Evolution**: recebimento de webhook e envio via WhatsApp
* **AI**: integração com o microserviço de inteligência artificial
* **Reports**: base futura para indicadores e visões gerenciais

## 8.4 Padrão de endpoints

A API foi pensada com endpoints REST voltados às ações centrais do sistema, como login, listagem de leads, consulta de lead por identificador, atualização de dados, movimentação de etapa, listagem de mensagens, envio de mensagem, recebimento de webhook e chamadas ao módulo de IA.

Essa organização é suficiente para um MVP e também fornece boa base de expansão, desde que mantidos contratos claros, versionamento e padronização de retorno.

## 8.5 Regras de validação e consistência

Entre os pontos críticos de validação no back-end, destacam-se:

* normalização do telefone
* prevenção de duplicidade de lead
* validação de payloads obrigatórios

Em um ambiente corporativo, esses três pontos são essenciais. O telefone atua como identificador operacional do lead, a deduplicação evita fragmentação do histórico, e a validação de payload protege a integridade da API.

## 8.6 Transações e atomicidade

Operações relevantes, como movimentação de etapa com registro de histórico e criação de interação associada, devem ser tratadas de forma atômica, garantindo que a atualização só seja concluída se todas as partes do processo forem persistidas corretamente.

Isso é importante porque, em cenários maiores, inconsistências desse tipo comprometem auditoria, relatórios e confiança operacional no sistema.

## 8.7 Documentação técnica da API

A documentação via Swagger deve registrar endpoints, payloads, exemplos de uso e códigos de erro. Em operações com mais de um time ou com integrações simultâneas, essa documentação deixa de ser apenas apoio e passa a ser parte do contrato técnico entre camadas e serviços.

## 8.8 Papel estratégico do back-end

Para uma grande empresa, o back-end precisa ser o ponto de controle da aplicação. Ele deve garantir consistência, rastreabilidade, segurança, previsibilidade de contratos e possibilidade de evolução. Por isso, sua arquitetura deve ser tratada como a base de governança técnica do sistema.

# 9. Integração com WhatsApp

## 9.1 Objetivo da integração

A integração com WhatsApp tem como função conectar o principal canal de contato do cliente ao ambiente interno do CRM. Isso permite que as mensagens trocadas deixem de existir apenas no aplicativo e passem a compor o histórico estruturado do atendimento.

## 9.2 Fluxo de entrada de mensagens

Quando o cliente envia uma mensagem, a Evolution API recebe esse evento e o encaminha ao CRM por webhook. A API principal então normaliza o payload recebido, localiza ou cria o lead correspondente, identifica ou cria a conversa associada e persiste a nova mensagem no histórico.

Esse fluxo é central para a proposta do projeto porque transforma uma conversa isolada em dado operacional útil dentro do sistema.

## 9.3 Fluxo de saída de mensagens

No sentido oposto, quando o usuário envia uma mensagem pelo CRM, o sistema registra primeiro a ação internamente, com status inicial, e depois realiza o envio pela Evolution API. Quando houver retorno da integração, o status da mensagem pode ser atualizado para refletir o resultado real da operação.

Essa sequência é importante porque preserva histórico mesmo em caso de falha externa.

## 9.4 Cuidados técnicos essenciais

Entre os cuidados técnicos fundamentais para essa integração, destacam-se:

* mapear o lead pelo telefone normalizado
* garantir idempotência no webhook
* armazenar identificador externo da mensagem para rastreio

Em ambiente corporativo, isso evita duplicidade, melhora auditabilidade e reduz inconsistência entre canal e CRM.

## 9.5 Importância operacional

Sem uma integração estável com o WhatsApp, o sistema perde sua principal proposta de valor. Essa camada precisa ser tratada como componente crítico da solução, porque ela é a ponte entre o canal real de comunicação e a gestão interna do atendimento.

# 10. Módulo de Inteligência Artificial

## 10.1 Objetivo do módulo

A inteligência artificial no projeto tem papel de apoio ao atendimento. Ela não substitui a decisão humana no fluxo principal, mas atua como recurso assistido para melhorar produtividade, padronização e leitura de contexto. As três funções centrais para essa camada são sugerir resposta, resumir histórico e classificar intenção ou temperatura do lead.

## 10.2 Estrutura do microserviço

O módulo de IA será exposto como microserviço em FastAPI, separado da API principal do CRM. Essa decisão é importante porque isola responsabilidades, reduz acoplamento técnico e facilita evolução específica da camada de IA sem comprometer a lógica central do sistema.

## 10.3 Endpoints funcionais

Os principais endpoints funcionais da camada de IA são:

* sugestão de resposta
* sumarização de histórico
* classificação de contexto

Cada chamada recebe contexto do lead e mensagens selecionadas, e devolve uma saída estruturada para apoio ao operador.

## 10.4 Diretrizes para uso corporativo

A IA deve atuar preferencialmente em modo assistido. Isso significa que a resposta gerada não deve ser enviada automaticamente ao cliente sem revisão do usuário.

Para uma grande empresa, essa diretriz é ainda mais importante porque reduz risco de comunicação inadequada, preserva controle humano e evita automação cega em situações sensíveis.

## 10.5 Controles adicionais recomendados

A camada de IA também deve observar:

* limitação de contexto enviado
* cuidado com dados sensíveis
* registro controlado de chamadas
* previsibilidade de custo por uso
* transparência de que a saída é sugestão, não decisão final

## 10.6 Papel estratégico da IA

Dentro deste projeto, a IA não é o sistema principal. Ela é um acelerador operacional. Seu valor está em reduzir tempo de resposta, melhorar consistência do atendimento e apoiar leitura rápida de contexto. Essa abordagem é mais realista, mais segura e mais adequada ao estágio de implantação do projeto.

# 11. Modelo de dados

## 11.1 Visão geral

O modelo de dados proposto cobre as principais entidades necessárias para operação do CRM integrado ao WhatsApp. A modelagem foi construída com foco em rastreabilidade, relacionamento entre registros e capacidade de acompanhar o ciclo completo do lead.

## 11.2 Entidades principais

### User

Armazena os usuários do sistema, com nome, e-mail, hash de senha, papel de acesso e data de criação.

### Lead

Representa o contato comercial principal, identificado por telefone único e complementado por dados como origem, responsável, etapa atual e temperatura.

### PipelineStage

Representa as etapas do funil, com nome, ordem e identificação visual.

### LeadStageHistory

Registra cada mudança de etapa, incluindo origem, destino, usuário responsável, data e observação.

### Conversation

Representa a conversa vinculada ao lead e ao canal utilizado.

### Message

Registra mensagens da conversa, com direção, conteúdo, identificador externo, status e horário.

### Interaction

Registra eventos complementares do lead, como nota, follow-up, mudança de etapa e evento do sistema.

### AiSuggestion

Armazena sugestões geradas pela IA, com tipo, entrada de referência, saída gerada e eventual aprovação por usuário.

## 11.3 Relações de negócio

A partir dessas entidades, o sistema consegue sustentar relações importantes, como:

* um usuário pode ser responsável por vários leads
* um lead pertence a uma etapa atual do pipeline
* um lead pode ter histórico de movimentações
* um lead pode possuir uma ou mais interações
* uma conversa pertence a um lead
* uma conversa contém várias mensagens
* um lead pode acumular várias sugestões de IA ao longo do tempo

Essa estrutura favorece histórico completo e leitura contextual consistente.

## 11.4 Adequação para empresa maior

Para uma empresa de maior porte, esse modelo atende bem ao MVP porque privilegia rastreabilidade e integridade. Além disso, ele já abre espaço para futuras extensões, como múltiplas oportunidades por lead, mais de um canal por conversa, segmentações adicionais, relatórios e políticas mais refinadas de governança de dados.

# 12. Módulos do sistema

## 12.1 Módulos do Front-end

### Autenticação

Responsável por login, proteção de rotas e controle inicial da sessão do usuário.

### Dashboard

Responsável por apresentar visão geral do funil, pendências e indicadores operacionais.

### Kanban ou Funil

Responsável pela visualização dos leads por etapa e movimentação operacional dos cards.

### Lead

Responsável pela visualização detalhada do lead, seus dados, suas ações e seu histórico.

### Conversas

Responsável pela timeline das mensagens e pela interação direta com o canal.

### Configurações

Responsável pelos parâmetros básicos do sistema, conforme permissões habilitadas.

## 12.2 Módulos do Back-end

### Auth

Responsável por autenticação e RBAC.

### Leads

Responsável por CRUD, validações e consultas.

### Pipeline

Responsável por etapas, regras e histórico de movimentação.

### Messages e Conversations

Responsável por persistência, paginação e contexto das conversas.

### Webhook Evolution

Responsável por entrada de eventos oriundos da integração com WhatsApp.

### IA

Responsável por orquestração do microserviço de inteligência artificial.

## 12.3 Visão modular para ambiente corporativo

Em uma empresa maior, essa divisão por módulos facilita manutenção, distribuição entre equipes e evolução progressiva da solução. Também torna mais claro onde cada responsabilidade técnica e funcional está localizada dentro do sistema.

# 13. Fluxos principais

## 13.1 Lead novo via WhatsApp

Quando uma nova mensagem chega pelo WhatsApp, o CRM recebe o evento, identifica se o contato já existe, cria o lead quando necessário, cria ou associa a conversa correta e registra a mensagem no histórico. Em seguida, esse lead aparece na etapa inicial do funil.

## 13.2 Resposta pelo CRM

O usuário seleciona o lead, redige a mensagem no sistema, realiza o envio e o CRM registra a saída antes de encaminhar a mensagem para a integração externa. Depois disso, a timeline é atualizada para refletir o novo evento.

## 13.3 Movimentação no funil

Ao arrastar ou atualizar a etapa de um card, o CRM valida a operação, registra histórico da mudança e atualiza a posição do lead no kanban.

## 13.4 Sugestão por IA

O usuário solicita apoio da IA, o CRM envia contexto selecionado ao microserviço, a IA retorna uma proposta de resposta e o usuário avalia se deseja utilizar ou não a sugestão gerada.

## 13.5 Importância dos fluxos end-to-end

Esses fluxos representam o núcleo funcional do sistema. Em um cenário corporativo, eles devem ser tratados como jornadas críticas, pois concentram a maior parte do valor operacional percebido pelos usuários e pelo negócio.

# 14. Requisitos do sistema

## 14.1 Requisitos funcionais

### Gestão de leads e oportunidades

* criar registros automaticamente a partir de mensagens recebidas
* permitir cadastro manual
* editar e consultar dados de leads
* armazenar e validar informações no banco
* registrar histórico de interações

### Integração e automação

* integrar o sistema com o canal de mensagens
* registrar interações automaticamente
* permitir comunicação entre serviços da solução

### Interface e operação

* exibir lista e detalhe de leads
* apresentar histórico de mensagens
* organizar dados de forma visual e clara
* atualizar interface automaticamente
* permitir navegação entre telas
* operar em diferentes dispositivos

### Evoluções previstas

* movimentar leads entre etapas
* registrar follow-up
* classificar lead
* solicitar sugestão de resposta por IA
* gerar sumarização do histórico

## 14.2 Requisitos não funcionais

### Arquitetura e integração

* a API deve ter estrutura adequada para integração
* deve existir controle de acesso às rotas
* logs das operações devem ser registrados

### Banco e integridade

* o banco deve ser confiável e seguro
* os dados devem manter integridade
* operações críticas devem preservar consistência

### Performance e usabilidade

* tempo de resposta deve ser adequado
* navegação deve ser simples
* o sistema deve ser compatível com navegadores modernos

### Interface

* o design deve ser consistente
* a interface deve ser responsiva
* o padrão visual deve se manter entre telas

### Segurança e operação

* dados sensíveis devem ser protegidos
* custos e limites de uso de IA devem ser controlados
* o sistema deve utilizar variáveis de ambiente para configurações sensíveis

## 14.3 Papel dos requisitos em uma grande empresa

Em cenário corporativo, requisitos funcionais garantem o que o sistema precisa fazer. Requisitos não funcionais garantem como ele deve se comportar. Os dois conjuntos são igualmente importantes, porque um sistema pode até atender o fluxo de negócio, mas ainda assim falhar se não oferecer segurança, rastreabilidade, desempenho e padronização.

# 15. Testes

## 15.1 Estratégia de testes do Back-end

A camada de back-end deve utilizar Supertest para rotas críticas e Vitest para serviços e validações internas. Essa combinação é adequada para verificar tanto o comportamento externo da API quanto a lógica interna das regras de negócio.

Entre os pontos críticos de back-end, merecem prioridade:

* autenticação
* recebimento de webhook
* envio de mensagem
* movimentação de etapa
* deduplicação de lead
* registro de histórico

## 15.2 Estratégia de testes do Front-end

No front-end, a estratégia deve utilizar React Testing Library e Vitest para validar componentes, renderização, estados e comportamento da interface. Isso é especialmente importante para telas centrais como kanban, filtros, timeline e widgets de follow-up.

## 15.3 Casos críticos destacados

Os cenários mais sensíveis do sistema incluem:

* duplicidade de lead por telefone
* repetição de webhook
* movimentação de etapa com histórico
* envio de outbound mesmo quando há falha externa, com status apropriado

## 15.4 Visão corporativa de qualidade

Para uma empresa maior, testes não devem ser vistos apenas como etapa complementar. Eles representam mecanismo de proteção contra regressão, redução de falhas em produção e sustentação da confiança operacional no sistema.

# 16. Observabilidade, auditoria, privacidade e segurança

## 16.1 Logs e auditoria

O sistema deve registrar eventos como login, logout, falhas, criação e edição de lead, mudança de etapa, envio e recebimento de mensagens e chamadas ao microserviço de IA. Esse conjunto é essencial para manter rastreabilidade e apoiar diagnóstico de falhas.

Em ambiente corporativo, logs também servem para accountability, investigação de incidentes e reconstrução de contexto operacional.

## 16.2 Privacidade

O telefone deve ser tratado como dado pessoal, e o sistema deve evitar armazenamento desnecessário de informações, além de controlar acesso por perfil. Essas diretrizes são fundamentais porque o CRM lida diretamente com dados de clientes e histórico de contato.

## 16.3 Segurança

Entre as orientações de segurança, destacam-se:

* armazenamento de chaves em variáveis de ambiente
* validação da origem do webhook, quando disponível
* sanitização das entradas recebidas

Essas medidas são coerentes com o nível do projeto e formam boa base para um MVP tecnicamente responsável.

## 16.4 Importância estratégica

Em uma grande empresa, observabilidade, auditoria, privacidade e segurança não são complementos. Elas são parte da confiabilidade do sistema. Sem esses pilares, a aplicação até pode funcionar, mas não sustenta operação séria, expansão de uso ou confiança institucional.

# 17. Entregáveis e critérios de aceite

## 17.1 Entregáveis previstos

Os entregáveis principais do projeto são:

* interface web em React
* API do CRM em Express com Swagger
* banco de dados PostgreSQL com migrations
* integração com Evolution API para webhook e envio
* microserviço de IA em FastAPI
* testes básicos de API e interface

## 17.2 Critérios de aceite

Os critérios de aceite do sistema são:

* mensagem inbound deve criar lead automaticamente quando ele não existir
* o kanban deve exibir leads por etapa e permitir movimentação
* a timeline deve exibir histórico de mensagens
* o envio de mensagem pelo CRM deve funcionar pela integração
* a IA deve retornar sugestão de resposta em modo assistido

## 17.3 Leitura corporativa dos critérios de aceite

Para uma empresa maior, critérios de aceite têm papel importante porque transformam expectativa funcional em verificação objetiva. Eles definem o que precisa estar operacional para que o sistema seja considerado apto ao uso. Em outras palavras, ajudam a separar intenção de entrega real.
