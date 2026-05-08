# DevTools Platform

An open-source AI-powered developer tools platform. Translate code between 27 languages, validate Railway configs, estimate Railway costs, and generate database migration guides — all in one place.

**Live hosted version:** [transpiler.us](https://transpiler.us) · [railwaydevtools.com](https://railwaydevtools.com)

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Tools

### Dev Tools
- **Code Translator** — AI-powered translation across 27 languages (Python, Rust, Go, TypeScript, Java, and more)
- **JSON / YAML Formatter** — Format and convert between JSON and YAML
- **Regex Tester** — Test and debug regular expressions
- **Code Review** — AI-powered code review and suggestions

### Railway DevTools
- **Config Validator** — Validate `railway.json`, `railway.toml`, Dockerfiles, `nixpacks.toml`, Railpack, and Procfiles
- **Cost Calculator** — Estimate your monthly Railway infrastructure cost
- **DB Migration Assistant** — Step-by-step guide to migrate your database to Railway

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL (via Prisma ORM) |
| Auth | JWT |
| AI | Anthropic Claude API |
| Payments | Stripe + Solana Pay (USDC) |
| Hosting | Vercel (web) + Railway (API) |

---

## Self-Hosting

You can run the full stack yourself. You'll need your own API keys.

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Anthropic API key
- Stripe account (for card payments)
- Solana wallet (for USDC payments, optional)

### 1. Clone the repo

```bash
git clone https://github.com/Jeah84/devtools-platform.git
cd devtools-platform
```

### 2. Set up the API

```bash
cd api
npm install
cp .env.example .env
# Fill in your values in .env
npx prisma migrate deploy
npm run dev
```

### 3. Set up the web frontend

```bash
cd ../web
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:4000/api
npm run dev
```

### Environment variables

**`api/.env`**
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_MERCHANT_WALLET=your-wallet-address
FRONTEND_URL=http://localhost:5173
```

**`web/.env`**
```env
VITE_API_URL=http://localhost:4000/api
```

---

## Hosted Version

The hosted version at [transpiler.us](https://transpiler.us) includes:
- Managed infrastructure (no setup required)
- Stripe and Solana USDC payment processing
- Credit-based access to Railway DevTools (1 credit per use)
- Pro plan for unlimited access

Free tier: code translator, JSON/YAML, and regex tester are always free.

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

## License

MIT — see [LICENSE](LICENSE)
