# OPINNE - Frontend

Frontend da plataforma OPINNE - Automação de coleta de feedback e gestão de reputação online via WhatsApp.

## Sobre o Projeto

OPINNE transforma clientes satisfeitos em avaliações 5 estrelas no Google. O sistema coleta feedback pós-compra via WhatsApp, faz triagem inteligente das respostas e direciona clientes felizes para avaliar seu negócio no Google, enquanto alerta sobre feedbacks negativos antes que virem reclamações públicas.

### Funcionalidades Principais

- Pesquisa NPS via WhatsApp
- Triagem automática de respostas (promotores, passivos, detratores)
- Direcionamento para Google Reviews
- Alertas de feedback negativo em tempo real
- Dashboard de métricas e relatórios
- Coleta de depoimentos
- Suporte a múltiplos negócios

## Tech Stack

### Core
- **Framework**: [Vite](https://vitejs.dev/) + [React 18](https://react.dev/)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Roteamento**: [React Router DOM v7](https://reactrouter.com/)

### UI & Styling
- **CSS Framework**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Componentes**: [shadcn/ui](https://ui.shadcn.com/)
- **Ícones**: [Lucide React](https://lucide.dev/)

### State & Data
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query/latest)
- **Formulários**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **HTTP Client**: [Axios](https://axios-http.com/)

### Utilities
- **Internacionalização**: [i18next](https://www.i18next.com/)
- **Notificações**: [React Hot Toast](https://react-hot-toast.com/)

## Início Rápido

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
VITE_API_URL=http://localhost:8000
VITE_MOCK_AUTH=false
```

### 3. Iniciar Servidor de Desenvolvimento
```bash
npm run dev
```

A aplicação estará disponível em [http://localhost:3000](http://localhost:3000)

## Estrutura do Projeto

```
src/
├── api/                   # Camada de dados (hooks, queryClient)
├── components/
│   ├── ui/                # Componentes shadcn/ui
│   ├── core/              # Componentes genéricos (Logo, etc.)
│   ├── modules/           # Módulos (Sidebar, Modals)
│   └── features/          # Componentes de domínio
├── contexts/              # Estado global (authStore)
├── hooks/                 # Custom hooks
├── lib/                   # Utilitários
├── locales/               # Traduções (pt-BR, en, es)
├── pages/                 # Páginas (Landing, Dashboard, Login, Register)
├── styles/                # CSS global e temas
├── App.tsx                # Router principal
└── main.tsx               # Entry point
```

## Scripts Disponíveis

```bash
npm run dev       # Servidor de desenvolvimento
npm run build     # Build de produção
npm run preview   # Preview do build
npm run lint      # ESLint
```

## Configuração de Ambiente

### Variáveis de Ambiente (`.env`)

```env
# URL da API backend
VITE_API_URL=http://localhost:8000

# Modo de autenticação mock (desenvolvimento)
VITE_MOCK_AUTH=false
```

## Cores da Marca

- **Primary (Verde Confiança)**: `#00B37E`
- **Secondary (Azul Blindagem)**: `#12263F`
- **Accent (Dourado Estrela)**: `#FFB800`

## Backend

O backend da aplicação está em [oppine_back](https://github.com/angulartec/oppine_back).

---

**OPINNE** - Blindagem de reputação e aceleração de visibilidade no piloto automático.
