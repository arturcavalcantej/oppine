# Oppine Backend API

**Oppine** - Sistema de coleta e triagem de feedback pos-compra via WhatsApp para potencializar avaliacoes publicas positivas e mitigar negativas.

## Indice

1. [Visao Geral](#visao-geral)
2. [Stack Tecnologica](#stack-tecnologica)
3. [Arquitetura](#arquitetura)
4. [Instalacao](#instalacao)
5. [Configuracao](#configuracao)
6. [Modelos de Dados](#modelos-de-dados)
7. [API Endpoints](#api-endpoints)
8. [Servicos](#servicos)
9. [Integracao WhatsApp](#integracao-whatsapp)
10. [Integracao Angular Hub](#integracao-angular-hub)
11. [Fluxos de Negocio](#fluxos-de-negocio)
12. [Tarefas Agendadas](#tarefas-agendadas)
13. [Planos e Limites](#planos-e-limites)

---

## Visao Geral

O Oppine automatiza a coleta de feedback de clientes apos uma compra, usando o WhatsApp como canal principal. O sistema usa triagem inteligente baseada em NPS (Net Promoter Score):

- **Promotores (9-10)**: Redirecionados para avaliar no Google Meu Negocio
- **Passivos (7-8)**: Recebem agradecimento e pedido de comentario
- **Detratores (0-6)**: Alerta enviado ao proprietario para intervencao

### Problema que Resolve

- Dificuldade em conseguir avaliacoes genuinas no Google
- Perda de tempo pedindo feedback manualmente
- Avaliacoes negativas sem chance de intervencao previa
- Baixa visibilidade nos resultados de busca local

---

## Stack Tecnologica

| Componente | Tecnologia |
|------------|------------|
| Linguagem | Python 3.11+ |
| Framework | FastAPI |
| Servidor | Uvicorn |
| ORM | SQLAlchemy |
| Migracoes | Alembic |
| Banco de Dados | PostgreSQL (prod) / SQLite (dev) |
| Autenticacao | JWT (HS256, 7 dias) + Angular Hub SSO |
| Pagamentos | Stripe via Angular Hub |
| WhatsApp | Evolution API / Meta Cloud API / Mock |
| Scheduler | APScheduler (AsyncIOScheduler) |
| Monitoramento | Sentry |
| Storage | Local ou AWS S3 |

---

## Arquitetura

```
oppine_back/
├── main.py                    # Entrada da aplicacao FastAPI (CORS, lifespan, routers)
├── config.py                  # Configuracoes com Pydantic Settings
├── database.py                # Setup SQLAlchemy (engine, session factory)
├── auth.py                    # JWT criacao/verificacao, dependency get_current_user
├── models.py                  # Modelos SQLAlchemy (15+ entidades)
├── users.py                   # Endpoints de usuarios e projetos
├── scheduler.py               # APScheduler (resumo semanal, follow-ups, expiracao)
├── stripe_products.json       # Configuracao de planos e precos
│
├── routers/
│   ├── hub.py                 # Angular Hub SSO, assinaturas, billing (Stripe)
│   ├── businesses.py          # CRUD negocios + templates + webhook config
│   ├── feedback.py            # Feedback requests/responses, dashboard, webhook WhatsApp
│   ├── inbound_webhook.py     # Webhook para integracoes externas (POS/CRM)
│   ├── stats.py               # Estatisticas de uso e limites do plano
│   └── scheduled_tasks.py     # Status do scheduler
│
├── services/
│   ├── whatsapp_service.py        # Abstracao WhatsApp (Mock/Evolution/Cloud)
│   ├── angular_hub_service.py     # Cliente API do Angular Hub (SSO, assinaturas)
│   ├── nps_conversation_service.py # Fluxo conversacional NPS (parsing de nota, classificacao)
│   ├── notification_service.py    # Resumos diarios e semanais (metricas + envio)
│   └── follow_up_service.py       # Follow-up para clientes que nao responderam
│
├── alembic/                   # Migracoes de banco
│   ├── env.py
│   └── versions/              # 9 versoes de migracao
│
├── docs/
│   └── WEBHOOK_INTEGRATION.md # Documentacao completa do webhook inbound
│
├── requirements.txt
├── Dockerfile
└── .env.example
```

---

## Instalacao

### Pre-requisitos

- Python 3.11+
- PostgreSQL (producao) ou SQLite (desenvolvimento)
- Conta no Angular Hub (para SSO e pagamentos)

### Passos

```bash
# Clonar repositorio
git clone <repo-url>
cd oppine_back

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt

# Copiar arquivo de ambiente
cp .env.example .env

# Configurar variaveis de ambiente (ver secao Configuracao)

# Rodar migracoes
alembic upgrade head

# Iniciar servidor
uvicorn main:app --reload --port 8000
```

### Docker

```bash
docker build -t oppine-backend .
docker run -p 8000:8000 --env-file .env oppine-backend
```

---

## Configuracao

### Variaveis de Ambiente (.env)

```env
# ==========================================
# DATABASE
# ==========================================
DATABASE_URL=sqlite:///./oppine.db
# Producao: DATABASE_URL=postgresql://user:pass@host:5432/oppine

# ==========================================
# JWT / AUTENTICACAO
# ==========================================
JWT_SECRET_KEY=sua-chave-secreta-aqui

# ==========================================
# ANGULAR HUB (SSO + PAGAMENTOS)
# ==========================================
ANGULAR_HUB_ENABLED=true
ANGULAR_HUB_API_URL=https://api.angularhub.com.br
ANGULAR_HUB_SAAS_SLUG=oppine
ANGULAR_HUB_SAAS_ID=uuid-do-saas-no-hub
ANGULAR_HUB_API_KEY=sua-api-key
ANGULAR_HUB_JWT_SECRET=jwt-secret-do-hub
ANGULAR_HUB_WEBHOOK_SECRET=webhook-secret

# ==========================================
# WHATSAPP
# ==========================================
WHATSAPP_PROVIDER=mock  # mock, evolution, cloud

# Evolution API (self-hosted)
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-api-key

# WhatsApp Cloud API (Meta)
WHATSAPP_ACCESS_TOKEN=token-do-meta
WHATSAPP_PHONE_NUMBER_ID=phone-number-id

# ==========================================
# APP
# ==========================================
APP_DOMAIN=https://app.oppine.com.br
CORS_ORIGINS=["http://localhost:3000"]

# ==========================================
# SCHEDULER
# ==========================================
SCHEDULER_DISABLED=false  # true para desativar jobs em background

# ==========================================
# STORAGE (para audios de depoimentos)
# ==========================================
STORAGE_MODE=local  # local ou s3
LOCAL_MEDIA_PATH=media

# AWS S3 (se STORAGE_MODE=s3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_REGION=us-east-1

# ==========================================
# SENTRY (opcional)
# ==========================================
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Modelos de Dados

### Hierarquia Principal

```
User → Project → Business → FeedbackRequest → FeedbackResponse
                         └→ FeedbackTemplate (nivel do projeto)
```

### User
Usuario do sistema, vinculado ao Angular Hub via SSO.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| uid | String (PK) | UUID do usuario |
| email | String | Email (unico) |
| name | String | Nome completo |
| password_hash | String | Hash da senha (vazio para SSO) |
| language | String | Idioma (pt-BR, en, es) |
| notify_whatsapp | Boolean | Notificacoes via WhatsApp |
| notify_email | Boolean | Notificacoes via email |
| notify_daily_summary | Boolean | Resumo diario ativo |
| notify_weekly_summary | Boolean | Resumo semanal ativo |
| created_at | DateTime | Data de criacao |

### Project
Projeto/workspace do usuario.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (PK) | UUID do projeto |
| name | String | Nome do projeto |
| owner_id | String (FK) | Usuario proprietario |
| subscription_status | String | Status da assinatura |
| plan_id | String | ID do plano no Stripe |

### Business
Negocio local que coleta feedback.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (PK) | UUID do negocio |
| project_id | String (FK) | Projeto associado |
| name | String | Nome do negocio |
| google_place_id | String | ID do Google Places |
| google_review_url | String | URL para avaliar no Google |
| whatsapp_phone | String | Telefone do WhatsApp |
| whatsapp_instance_id | String | ID da instancia WhatsApp |
| alert_phone | String | Telefone para alertas |
| alert_email | String | Email para alertas |
| promoter_threshold | Integer | Nota minima para promotor (default: 9) |
| detractor_threshold | Integer | Nota maxima para detrator (default: 6) |
| is_active | Boolean | Negocio ativo |
| webhook_token | String | Token para webhook inbound |

### FeedbackTemplate (Nivel do Projeto)
Template de mensagem para WhatsApp. Templates sao associados ao projeto, nao ao negocio individual.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (PK) | UUID do template |
| project_id | String (FK) | Projeto associado |
| name | String | Nome do template |
| initial_message | Text | Mensagem inicial (com placeholders) |
| nps_message | Text | Mensagem de solicitacao de nota |
| thank_you_promoter | Text | Agradecimento para promotores |
| thank_you_passive | Text | Agradecimento para passivos |
| thank_you_detractor | Text | Agradecimento para detratores |
| is_default | Boolean | Se e o template padrao |

**Placeholders disponveis:**
- `{customer_name}` — Nome do cliente
- `{business_name}` — Nome do negocio
- `{feedback_link}` — Link do formulario publico

### FeedbackRequest
Solicitacao de feedback enviada ao cliente.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (PK) | UUID da solicitacao |
| business_id | String (FK) | Negocio associado |
| template_id | String (FK) | Template utilizado |
| customer_name | String | Nome do cliente |
| customer_phone | String | WhatsApp do cliente |
| customer_email | String | Email do cliente |
| status | Enum | pending, sent, delivered, read, responded, expired, failed |
| conversation_state | String | awaiting_score, awaiting_comment, completed |
| whatsapp_message_id | String | ID da mensagem no WhatsApp |
| whatsapp_remote_jid | String | JID do contato |
| whatsapp_lid | String | LID do contato (formato @lid) |
| response_channel | String | whatsapp ou web |
| follow_up_count | Integer | Tentativas (1=inicial, 2=1o follow-up, 3=2o) |
| next_follow_up_at | DateTime | Proximo follow-up agendado |
| last_follow_up_at | DateTime | Ultimo follow-up enviado |
| sent_at | DateTime | Quando foi enviada |
| expires_at | DateTime | Quando expira |
| last_interaction_at | DateTime | Ultima interacao |

### FeedbackResponse
Resposta do cliente ao feedback.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (PK) | UUID da resposta |
| request_id | String (FK) | Solicitacao associada |
| score | Integer | Nota 0-10 |
| classification | Enum | promoter, passive, detractor |
| comment | Text | Comentario do cliente |
| testimonial_text | Text | Depoimento em texto |
| testimonial_audio_url | String | URL do audio do depoimento |
| google_review_clicked | Boolean | Se clicou no link do Google |
| alert_sent | Boolean | Se alerta foi enviado |
| issue_resolved | Boolean | Se problema foi resolvido |
| responded_at | DateTime | Quando respondeu |

### AlertNotification
Registro de alertas enviados para feedback negativo.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (PK) | UUID do alerta |
| response_id | String (FK) | Resposta associada |
| channel | String | whatsapp ou email |
| sent_at | DateTime | Quando foi enviado |
| delivered | Boolean | Se foi entregue |

---

## API Endpoints

### Autenticacao

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| POST | `/auth/register` | Nao | Registrar (local) |
| POST | `/auth/login` | Nao | Login (local) |
| GET | `/auth/me` | Sim | Dados do usuario logado |
| PATCH | `/auth/me` | Sim | Atualizar preferencias |

### Angular Hub (SSO + Pagamentos)

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| POST | `/hub/auth/login` | Nao | Login via Angular Hub |
| POST | `/hub/auth/register` | Nao | Registrar via Angular Hub |
| GET | `/hub/me/subscription` | Sim | Info da assinatura |
| POST | `/hub/me/subscription/refresh` | Sim | Forcar atualizacao |
| GET | `/hub/billing/plans` | Sim | Planos disponiveis |
| GET | `/hub/billing/price-preview` | Sim | Preview de preco com cupom |
| POST | `/hub/billing/checkout` | Sim | Criar checkout Stripe |
| POST | `/hub/billing/portal` | Sim | Portal de gerenciamento |
| POST | `/hub/webhook` | Webhook* | Webhook de assinaturas |

### Projetos

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| GET | `/projects` | Sim | Listar projetos do usuario |
| POST | `/projects` | Sim | Criar projeto |
| GET | `/projects/{id}` | Sim | Detalhes do projeto |
| GET | `/projects/{id}/stats` | Sim | Estatisticas e uso |

### Negocios

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| GET | `/businesses?project_id=` | Sim | Listar negocios |
| POST | `/businesses` | Sim | Criar negocio |
| GET | `/businesses/{id}` | Sim | Detalhes do negocio |
| PATCH | `/businesses/{id}` | Sim | Atualizar negocio |
| DELETE | `/businesses/{id}` | Sim | Excluir negocio |
| GET | `/businesses/{id}/webhook` | Sim | Info do webhook |
| POST | `/businesses/{id}/webhook/regenerate` | Sim | Regenerar token |
| GET | `/businesses/{id}/webhook/config` | Sim | Config de mapeamento |
| PATCH | `/businesses/{id}/webhook/config` | Sim | Atualizar mapeamento |
| POST | `/businesses/{id}/webhook/test` | Sim | Testar extracao |

### Templates (Nivel do Projeto)

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| GET | `/businesses/{id}/templates` | Sim | Listar templates |
| POST | `/businesses/{id}/templates` | Sim | Criar template |
| PATCH | `/businesses/{id}/templates/{tid}` | Sim | Atualizar template |
| DELETE | `/businesses/{id}/templates/{tid}` | Sim | Excluir template |

### Feedback

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| POST | `/feedback/requests` | Sim | Criar solicitacao |
| POST | `/feedback/requests/bulk` | Sim | Criar varias solicitacoes |
| GET | `/feedback/requests?business_id=` | Sim | Listar solicitacoes |
| POST | `/feedback/requests/{id}/send` | Sim | Enviar manualmente |
| GET | `/feedback/responses?business_id=` | Sim | Listar respostas |
| PATCH | `/feedback/responses/{id}/resolve` | Sim | Marcar como resolvido |
| GET | `/feedback/dashboard/{business_id}` | Sim | Dashboard de metricas |

### Endpoints Publicos (sem autenticacao)

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| GET | `/feedback/public/{request_id}` | Nao | Info para formulario |
| POST | `/feedback/public/{request_id}/respond` | Nao | Enviar resposta |

### Webhook WhatsApp

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| POST | `/feedback/webhook/whatsapp` | Nao* | Receber eventos do WhatsApp |

### Webhook Inbound (Integracoes Externas)

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| POST | `/api/v1/inbound/{token}` | Token | Receber dados de sistemas externos |
| GET | `/api/v1/inbound/{token}/config` | Token | Obter configuracao do webhook |
| PATCH | `/api/v1/inbound/{token}/config` | Token | Atualizar configuracao |
| POST | `/api/v1/inbound/{token}/test` | Token | Testar extracao de payload |

> **Documentacao completa**: [docs/WEBHOOK_INTEGRATION.md](docs/WEBHOOK_INTEGRATION.md)

### Scheduler

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| GET | `/scheduler/status` | Sim | Status dos jobs agendados |

---

## Servicos

### WhatsApp Service (`services/whatsapp_service.py`)
Abstracao para envio de mensagens WhatsApp. Suporta 3 providers:

- **MockService**: Simula envio (desenvolvimento)
- **EvolutionService**: Evolution API self-hosted
- **CloudService**: WhatsApp Cloud API (Meta)

```python
from services.whatsapp_service import get_service

whatsapp = get_service()
result = await whatsapp.send_message(
    to="5511999999999",
    message="Ola! Como foi sua experiencia?",
    instance_id="minha-instancia"
)
```

### NPS Conversation Service (`services/nps_conversation_service.py`)
Gerencia o fluxo conversacional de coleta de NPS via WhatsApp:

1. **Parsing de nota**: Reconhece "9", "nota 9", "9/10", "dez", "minha nota e 9"
2. **Classificacao**: promoter (≥9), passive (7-8), detractor (≤6) — thresholds configuraveis
3. **Estado da conversa**: awaiting_score → awaiting_comment → completed
4. **Respostas adaptativas**: mensagem diferente por classificacao, com template customizavel

### Notification Service (`services/notification_service.py`)
Gera e envia resumos periodicos para donos de negocios:

- **Resumo Semanal**: NPS score, tendencias, breakdown por classificacao, comparacao com semana anterior
- **Resumo Diario**: Metricas do dia vs ontem (atualmente desativado)
- Mensagens adaptativas baseadas na performance (tom positivo vs alerta)

### Follow-up Service (`services/follow_up_service.py`)
Gerencia reenvio de pesquisa para clientes que nao responderam:

- **Maximo 3 tentativas**: 1 inicial + 2 follow-ups
- **Intervalos**: 24h apos envio inicial → 48h apos 1o follow-up
- **Expiracao**: 72h apos ultima tentativa sem resposta → marca como expired
- Mensagens diferentes para cada tentativa

### Angular Hub Service (`services/angular_hub_service.py`)
Cliente da API do Angular Hub para SSO e gerenciamento de assinaturas:

- Login/registro via Hub
- Cache de assinatura local (`SubscriptionCache`)
- Verificacao de planos e limites

---

## Integracao WhatsApp

### 1. Mock (Desenvolvimento)
```env
WHATSAPP_PROVIDER=mock
```
Simula envio de mensagens sem realmente enviar.

### 2. Evolution API (Self-hosted)
```env
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-api-key
```
Requer instancia propria do Evolution API.

### 3. WhatsApp Cloud API (Meta)
```env
WHATSAPP_PROVIDER=cloud
WHATSAPP_ACCESS_TOKEN=token-do-meta
WHATSAPP_PHONE_NUMBER_ID=phone-number-id
```
API oficial do Meta, requer aprovacao.

---

## Integracao Angular Hub

O Angular Hub gerencia SSO e pagamentos centralizados.

### Fluxo de Login

```
1. Usuario envia email/senha
2. Backend faz POST para Angular Hub /api/auth/login/
3. Hub valida e retorna tokens + dados do usuario
4. Backend cria/vincula usuario local (HubUserLink)
5. Gera token JWT local (7 dias) para uso na API
```

### Fluxo de Pagamento

```
1. Usuario seleciona plano no frontend
2. POST /hub/billing/checkout com plan_slug
3. Backend obtem URL do Stripe via Hub
4. Usuario completa pagamento no Stripe
5. Hub recebe webhook do Stripe e notifica backend
6. Backend atualiza SubscriptionCache local
```

### Configurar no Angular Hub Admin

1. Criar SaaS "Oppine" com slug `oppine`
2. Criar planos:
   - `oppine-free` (R$ 0)
   - `oppine-basico-monthly` (R$ 97)
   - `oppine-basico-yearly` (R$ 970)
   - `oppine-ilimitado-monthly` (R$ 197)
   - `oppine-ilimitado-yearly` (R$ 1.970)

---

## Fluxos de Negocio

### Fluxo Completo de Feedback

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Negocio   │     │    Oppine    │     │   Cliente   │
└─────────────┘     └──────────────┘     └─────────────┘
      │                    │                    │
      │ Cria solicitacao   │                    │
      │───────────────────>│                    │
      │                    │                    │
      │                    │ Envia WhatsApp     │
      │                    │ (mensagem inicial) │
      │                    │───────────────────>│
      │                    │                    │
      │                    │   Responde nota    │
      │                    │<───────────────────│
      │                    │                    │
      │                    │ Classifica (NPS)   │
      │                    │                    │
      │                    ├── Promotor (9-10)  │
      │                    │   └> Link Google   │
      │                    │   └> COMPLETED     │
      │                    │                    │
      │                    ├── Passivo (7-8)    │
      │                    │   └> Pede comentario│
      │                    │   └> AWAITING_COMMENT│
      │                    │                    │
      │                    ├── Detrator (0-6)   │
      │   Alerta agendado  │   └> Pede comentario│
      │<───────────────────┤   └> AWAITING_COMMENT│
      │                    │                    │
      │                    │   Envia comentario │
      │                    │<───────────────────│
      │   Alerta + comentario                   │
      │<───────────────────┤   └> COMPLETED     │
```

### Fluxo de Follow-up

```
Envio inicial (count=1)
    └── Sem resposta em 24h → 1o follow-up (count=2)
        └── Sem resposta em 48h → 2o follow-up (count=3)
            └── Sem resposta em 72h → marca como EXPIRED
```

### Triagem NPS

| Nota | Classificacao | Acao Automatica |
|------|---------------|-----------------|
| 9-10 | Promotor | Agradecimento + link Google Review |
| 7-8 | Passivo | Agradecimento + pede comentario |
| 0-6 | Detrator | Pede comentario + alerta ao proprietario |

---

## Tarefas Agendadas

O scheduler usa APScheduler (AsyncIOScheduler) e roda dentro do processo FastAPI.

| Job | Horario | Descricao |
|-----|---------|-----------|
| Resumo Semanal | Segunda 09:00 | Envia resumo NPS da semana para donos de negocio |
| NPS Follow-up | A cada hora | Processa follow-ups pendentes e expira solicitacoes antigas |
| Resumo Diario | 20:00 (desativado) | Envia metricas do dia |

### Desativar Scheduler

```env
SCHEDULER_DISABLED=true
```

Util para testes ou quando rodando multiplas instancias.

---

## Planos e Limites

### Plano Free
- 50 mensagens WhatsApp/mes
- 50 solicitacoes de feedback/mes
- 1 negocio
- 1 template

### Plano Basico (R$ 97/mes)
- 500 mensagens WhatsApp/mes
- 500 solicitacoes de feedback/mes
- 3 negocios
- 3 templates

### Plano Ilimitado (R$ 197/mes)
- Mensagens ilimitadas
- Solicitacoes ilimitadas
- Negocios ilimitados
- Templates ilimitados
- Suporte prioritario

### Verificar Limites

O endpoint `GET /projects/{id}/stats` retorna:

```json
{
  "usage": {
    "messages": {"current": 45, "limit": 50},
    "feedback_requests": {"current": 32, "limit": 50},
    "businesses": {"current": 1, "limit": 1}
  },
  "totals": {
    "businesses": 1,
    "feedback_requests": 156,
    "feedback_responses": 89,
    "positive_reviews": 67,
    "negative_alerts": 12
  },
  "subscription": {
    "tier": "free",
    "plan_slug": "oppine-free",
    "plan_name": "Free"
  }
}
```

Quando o limite e excedido, a API retorna `402 Payment Required`.

---

## Desenvolvimento

### Rodar Testes

```bash
pytest tests/
```

### Criar Migracao

```bash
alembic revision --autogenerate -m "descricao"
alembic upgrade head
```

### Logs

```python
import logging
logger = logging.getLogger(__name__)
logger.info("Mensagem de log")
```

---

## Licenca

Proprietario - Todos os direitos reservados.
