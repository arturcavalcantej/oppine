# Integracao Webhook - Oppine

Guia completo para integrar sistemas externos (POS, CRM, e-commerce) com o Oppine via webhook.

## Indice

1. [Visao Geral](#visao-geral)
2. [Como Funciona](#como-funciona)
3. [Configuracao](#configuracao)
4. [Mapeamento de Campos](#mapeamento-de-campos)
5. [Exemplos de Payload](#exemplos-de-payload)
6. [Endpoint de Teste](#endpoint-de-teste)
7. [Tratamento de Erros](#tratamento-de-erros)
8. [Boas Praticas](#boas-praticas)

---

## Visao Geral

O webhook do Oppine permite que sistemas externos (PDVs, CRMs, plataformas de e-commerce) disparem automaticamente solicitacoes de feedback NPS apos uma venda ou atendimento.

### Beneficios

- **Automacao total**: Sem intervencao manual
- **Flexibilidade**: Aceita diversos formatos de payload
- **Extracao inteligente**: Reconhece campos em portugues e ingles
- **Teste antes de produzir**: Endpoint de simulacao disponivel

---

## Como Funciona

```
┌──────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Sistema Externo │     │  Oppine Backend │     │   WhatsApp      │
│  (POS/CRM/etc)   │     │                 │     │                 │
└────────┬─────────┘     └────────┬────────┘     └────────┬────────┘
         │                        │                       │
         │  POST /api/v1/inbound/{token}                  │
         │  {"phone": "...", "name": "..."}               │
         │───────────────────────>│                       │
         │                        │                       │
         │                        │ Extrai campos         │
         │                        │ Valida telefone       │
         │                        │ Cria FeedbackRequest  │
         │                        │                       │
         │                        │ Envia mensagem NPS    │
         │                        │──────────────────────>│
         │                        │                       │
         │   202 Accepted         │                       │
         │<───────────────────────│                       │
```

---

## Configuracao

### Obter Token do Webhook

1. Acesse o dashboard do Oppine
2. Selecione o negocio
3. Va em "Enviar NPS" > aba "Webhook"
4. Copie o token e URL gerados

### URL do Webhook

```
POST https://api.oppine.com.br/api/v1/inbound/{webhook_token}
```

### Headers Requeridos

```
Content-Type: application/json
```

---

## Mapeamento de Campos

O sistema tenta extrair automaticamente os dados do payload recebido. Campos podem estar no nivel raiz ou aninhados (usando notacao com ponto).

### Campo: Telefone (Obrigatorio)

O sistema procura pelo telefone nos seguintes campos, na ordem:

| Campo Configurado | Alternativas Automaticas |
|-------------------|--------------------------|
| `phone` (padrao)  | - |

**Campos alternativos pesquisados automaticamente:**

1. `telefone`
2. `celular`
3. `whatsapp`
4. `mobile`
5. `cell`
6. `customer.phone`
7. `cliente.telefone`
8. `cliente.celular`
9. `contact.phone`
10. `contato.telefone`
11. `data.phone`
12. `data.telefone`

**Normalizacao automatica:**
- Remove caracteres nao-numericos
- Adiciona codigo do pais (55) se ausente
- Adiciona DDD (11) se ausente
- Valida formato brasileiro

**Exemplos aceitos:**
```
"11999998888"
"+55 11 99999-8888"
"(11) 99999-8888"
"55 11 999998888"
```

### Campo: Nome (Opcional)

| Campo Configurado | Alternativas Automaticas |
|-------------------|--------------------------|
| `name` (padrao)   | - |

**Campos alternativos pesquisados automaticamente:**

1. `nome`
2. `customer_name`
3. `cliente_nome`
4. `customer.name`
5. `cliente.nome`
6. `contact.name`
7. `contato.nome`
8. `first_name`
9. `full_name`

### Campo: Email (Opcional)

| Campo Configurado | Alternativas Automaticas |
|-------------------|--------------------------|
| `email` (padrao)  | - |

**Campos alternativos pesquisados automaticamente:**

1. `e-mail`
2. `customer.email`
3. `cliente.email`
4. `contact.email`
5. `contato.email`

### Metadados (Extraidos Automaticamente)

Campos adicionais sao extraidos automaticamente se presentes:

| Campo | Descricao |
|-------|-----------|
| `order_id` | ID do pedido |
| `pedido_id` | ID do pedido (PT) |
| `transaction_id` | ID da transacao |
| `product` | Nome do produto |
| `produto` | Nome do produto (PT) |
| `value` | Valor da compra |
| `valor` | Valor da compra (PT) |

Todos os metadados sao armazenados no `FeedbackRequest` para referencia futura.

---

## Exemplos de Payload

### Exemplo 1: Payload Simples

```json
{
  "phone": "11999998888",
  "name": "Joao Silva"
}
```

### Exemplo 2: Payload com Metadados

```json
{
  "phone": "+55 11 99999-8888",
  "name": "Maria Santos",
  "email": "maria@email.com",
  "order_id": "PED-12345",
  "value": 299.90,
  "product": "Corte de cabelo"
}
```

### Exemplo 3: Payload em Portugues

```json
{
  "telefone": "(11) 99999-8888",
  "nome": "Carlos Oliveira",
  "pedido_id": "1234",
  "valor": 150.00
}
```

### Exemplo 4: Payload Aninhado (Estilo E-commerce)

```json
{
  "order": {
    "id": "ORD-001",
    "total": 450.00
  },
  "customer": {
    "name": "Ana Paula",
    "phone": "11988887777",
    "email": "ana@email.com"
  },
  "items": [
    {"product": "Produto A", "qty": 2}
  ]
}
```

O sistema extrai automaticamente:
- `customer.phone` -> telefone
- `customer.name` -> nome
- `customer.email` -> email

### Exemplo 5: Payload de CRM

```json
{
  "contato": {
    "nome": "Pedro Souza",
    "telefone": "21999997777"
  },
  "atendimento": {
    "tipo": "Venda",
    "valor": 1500.00
  }
}
```

O sistema extrai:
- `contato.telefone` -> telefone
- `contato.nome` -> nome

### Exemplo 6: Payload de PDV

```json
{
  "cliente_nome": "Fernanda Lima",
  "celular": "31988886666",
  "transaction_id": "TXN-789456",
  "valor": 89.90
}
```

---

## Endpoint de Teste

Antes de configurar a integracao em producao, use o endpoint de teste para validar seu payload.

### Testar Extracao

```
POST https://api.oppine.com.br/api/v1/inbound/{webhook_token}/test
Content-Type: application/json

{
  "payload": {
    "telefone": "11999998888",
    "nome": "Teste Cliente"
  }
}
```

### Resposta de Teste

```json
{
  "success": true,
  "extracted_data": {
    "phone": "5511999998888",
    "phone_raw": "11999998888",
    "name": "Teste Cliente",
    "email": null,
    "metadata": {}
  },
  "extraction_log": [
    "Procurando campo principal: phone",
    "Campo nao encontrado, tentando alternativas",
    "Encontrado valor em: telefone",
    "Telefone normalizado: 5511999998888"
  ],
  "would_create_request": true,
  "message": "Dados extraidos com sucesso. Em producao, uma solicitacao de feedback seria criada."
}
```

### Resposta de Erro

```json
{
  "success": false,
  "extracted_data": {
    "phone": null,
    "phone_raw": null,
    "name": null,
    "email": null,
    "metadata": {}
  },
  "extraction_log": [
    "Procurando campo principal: phone",
    "Campo nao encontrado, tentando alternativas",
    "Nenhum campo de telefone encontrado"
  ],
  "would_create_request": false,
  "message": "Telefone nao encontrado no payload"
}
```

---

## Tratamento de Erros

### Codigos de Resposta

| Codigo | Significado |
|--------|-------------|
| `202 Accepted` | Webhook recebido, solicitacao sera processada |
| `400 Bad Request` | Payload invalido ou telefone nao encontrado |
| `401 Unauthorized` | Token invalido ou expirado |
| `403 Forbidden` | Webhook desativado ou negocio inativo |
| `422 Unprocessable Entity` | Telefone invalido apos normalizacao |
| `429 Too Many Requests` | Limite de requisicoes excedido |

### Exemplo de Erro 400

```json
{
  "detail": "Telefone nao encontrado no payload",
  "extraction_log": ["..."]
}
```

### Retry e Idempotencia

- **Retry**: Recomendado em caso de erro 5xx
- **Idempotencia**: O sistema ignora duplicatas pelo mesmo telefone dentro de 24h

---

## Boas Praticas

### 1. Validar Antes de Enviar

Use o endpoint `/test` para validar o formato do seu payload antes de configurar a integracao.

### 2. Incluir Metadados Relevantes

Envie dados como `order_id` e `value` para melhor rastreabilidade.

### 3. Tratar Respostas

```javascript
// Exemplo em Node.js
const response = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

if (response.status === 202) {
  console.log('Feedback solicitado com sucesso');
} else {
  const error = await response.json();
  console.error('Erro:', error.detail);
}
```

### 4. Logar Respostas

Mantenha logs das respostas do webhook para debug.

### 5. Usar HTTPS

Sempre use HTTPS em producao.

---

## Limites

| Plano | Limite de Webhooks/dia |
|-------|------------------------|
| Free | 50 |
| Basico | 500 |
| Ilimitado | Sem limite |

---

## Suporte

- **Documentacao**: https://docs.oppine.com.br
- **Email**: suporte@oppine.com.br
- **Status da API**: https://status.oppine.com.br
