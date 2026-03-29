Guia de Arquitetura e Boas Práticas Frontend (Vite/React Factory)

Este guia define a arquitetura, padrões e responsabilidades do Frontend (Vite/React + TanStack Query) para a Fábrica de MicroSaaS.

1. Arquitetura Base e Responsabilidades

Nossa arquitetura é focada na separação estrita de responsabilidades: Componentes de UI (O visual), Camada de Dados (A comunicação com a API) e Lógica de Fluxo (As páginas).

1.1 Estrutura de Diretórios (O Mínimo para o MVP)

src/
├── api/                   # Camada de Dados (Hooks e Funções de Requisição)
│   ├── queryKeys.js       # Chaves de cache do TanStack Query (ÚNICO ponto de verdade)
│   ├── axiosClient.js     # Configuração do Axios (baseURL, interceptors, etc.)
│   └── hooks/             # Todos os hooks (useLogin, useProjects, useCreateTask)
│
├── components/            # Componentes Reutilizáveis
│   ├── core/              # Design System (Button, Input, Typography, Layout)
│   ├── modules/           # Fluxos de App (ProjectSwitcher, BillingManager, Notificações)
│   └── features/          # Componentes específicos do MicroSaaS (Ex: TaskBoard)
│
├── contexts/              # Contextos leves (Zustand, ThemeProvider)
├── pages/                 # Roteamento (Arquivos que o React Router lê)
├── styles/                # Arquivos CSS (tailwind.css, variáveis globais)
├── utils/                 # Funções Puras (formatações, validação local)
└── main.jsx


1.2 Onde o Novo Código Vai (A Regra da Fábrica)

Para a sua fábrica, a regra de ouro é: Mantenha o core/ e modules/ intactos.

Tipo de Alteração	Onde o Código DEVE ser Adicionado	Responsabilidade

Nova Feature de Venda	components/features/	Visual e Comportamento específico do produto.
Endpoints de Feature	api/hooks/useFeatureData.js	Requisição, Caching, Mutação (TanStack Query).
Nova Rota	pages/ e src/urls.js	Definição da URL e qual componente de features/ será renderizado.
Ajuste na Cor Primária	tailwind.config.js	Design System. NÃO altere core/Button.jsx


2. Padrões de Dados e Estado (O Coração da Performance)

DO: Use TanStack Query para Dados do Servidor

* Regra: Todo dado que depende de uma chamada ao Django (GET, POST, etc.) deve ser gerenciado por um hook customizado (useQuery ou useMutation).
* Objetivo: Aproveitar o cache, o refetch automático e a gestão de estado de loading e error.

DO: Use queryKeys.js

* Regra: Todas as chaves de cache (ex: ['projects'], ['user']) devem ser exportadas de um único arquivo (api/queryKeys.js).
* Benefício: Evita que um desenvolvedor chame a lista de projetos com ['projectList'] e outro com ['projects'], quebrando o cache global.

DO: Isolar Estado da UI com Zustand

* Regra: Use Zustand apenas para estado global que não tem relação com o servidor.
* Exemplos: isSidebarOpen, currentTheme, modalState.
* EVITE: Mover a lista de projetos do TanStack Query para o Zustand. Deixe o TanStack ser o dono do estado do servidor.

DONT: Misturar Fetching na Lógica do Componente

* O que nunca deve ter: Nenhuma chamada direta a fetch ou axios.get deve aparecer em um componente.
* O correto: O componente deve chamar um hook encapsulado: const { data, isLoading } = useProjects.js().

3. Boas Práticas de Componentes e Estilo

DO: Componentes Puros e Composable

* Regra: Os componentes de core/ devem ser puros (receber props e retornar UI, sem lógica de dados).
* Exemplo: O <Button> só deve saber como se parecer, não deve saber como fazer login. A lógica de onClick={loginMutation} fica na page/ ou module/.
* Storybook: Todos os componentes de core/ e modules/ devem ser documentados no Storybook, com exemplos de uso e variações.

DO: Tailwind CSS (Apenas Utility Classes)

* Regra: Prefira usar classes Tailwind diretamente no JSX em vez de criar classes CSS customizadas (.custom-card).
* Exceções: Classes globais de reset ou para o PWA.
* Flexibilidade: Use Tailwind Merge para garantir que você possa sobrescrever classes de core/ sem problemas.

DONT: Estilo Hardcoded (Cores e Fontes)

* Regra: Nunca use valores hexadecimais (#FF0000) ou pixel fixo (width: 300px) diretamente no código.
* O correto: Use as variáveis de design do Tailwind (text-red-500, w-full, p-4). Isso garante que a customização do White-Label (se vendida) e a transição entre temas seja instantânea.

4. Segurança e Integração com Django

DO: Captura de Erros e Logging (Sentry)

* Regra: O SDK do Sentry deve ser inicializado no main.jsx e configurado para capturar erros.
* Integração: Adicione o ID do usuário (userId ou organizationId) ao escopo do Sentry. Isso permite rastrear: "O erro afetou o Projeto X do Cliente Y".

DO: Lidar com Autenticação de Forma Centralizada

* Regra: O Client do Axios (axiosClient.js) deve ter um Interceptor que automaticamente anexa o token JWT do usuário (localStorage ou cookies) em toda requisição enviada ao Backend Django.
* O Correto: Se a API retornar erro 401 Unauthorized, o Interceptor deve limpar o token e redirecionar o usuário para a página de /login.

DONT: Armazenar Dados Críticos

* Regra: Nunca armazene o token de acesso (JWT) no localStorage sem criptografia. Prefira usar Cookies HTTP Only (solução do Django/DRF) ou mecanismos de in-memory state.

5. Qualidade do Código (DX - Developer Experience)

DO: Tipagem Rigorosa (TypeScript/Zod)

* Regra: Se estiver usando TypeScript (fortemente recomendado), defina as interfaces para todos os dados que vêm do Django (Ex: interface Project { id: string; name: string; }).
* Validação: Use Zod para validar o formato dos dados recebidos do servidor antes de serem passados para o componente.

DO: Testes End-to-End (E2E)

* Regra: O repositório base deve ter testes E2E (Cypress/Playwright) para o fluxo de MVP.
* O que testar: 1. Registro, 2. Login, 3. Criação de Projeto, 4. Acesso ao Dashboard.
* Motivação: Se esses 4 testes passarem, você garante que o seu Template Master (API + Frontend) está pronto para o próximo MicroSaaS.



6. Commitment de Stack: Ferramentas Exclusivas

Esta seção define as ferramentas que compõem o nosso Design System e a nossa Arquitetura de Estado. Apenas as bibliotecas listadas como 'Escolha' devem ser usadas.

Funcionalidade	Escolha Única (DO)	Proibido (DON'T)	Justificativa de Fábrica

Gerenciamento de Estado Global	Zustand	Context API Pura, Redux, MobX, Jotai.	Zustand é minimalista e não tem boilerplate. Redux/Context Pura causariam re-renders e lentidão.
Estilização Principal	Tailwind CSS	CSS Modules, Styled Components, Emotion, Sass/Less.	Tailwind garante o Design System da Fábrica e a máxima velocidade de design.
Requisição & Cache	TanStack Query + Axios	Fetch API pura, SWR, GraphQL Clients (Apollo/Relay).	TanStack Query é a base da nossa performance e gerencia o estado do servidor.
Roteamento	React Router DOM	Next.js Router (na SPA), Reach Router.	É o padrão de mercado para SPAs (Single Page Applications) e evita o overhead do Next.js no nosso App.
Validação de Formulário	React Hook Form + Zod	Formik, Yup, Joi.	Esta combinação é a mais performática e utiliza a mesma tipagem (Zod) para o Backend e Frontend.
Notificações (Toasts)	React Hot Toast	React-Toastify, Componentes customizados complexos.	Leve, simples de configurar e entrega UX profissional sem complexidade.
Manipulação de Data	Date-fns	Moment.js, Day.js.	Date-fns é modular e tem melhor suporte a tree-shaking (apenas o código que você usa é importado), mantendo o bundle leve.


Regra Final: Se uma biblioteca não está na coluna 'Escolha Única' e duplica uma funcionalidade existente, ela deve ser rejeitada em qualquer Pull Request.

