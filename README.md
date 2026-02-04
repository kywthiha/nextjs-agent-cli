# Next.js Fullstack Agent CLI

🚀 **AI-powered CLI to build production-ready Next.js fullstack applications using natural language**

[![npm version](https://img.shields.io/npm/v/kyawthiha-nextjs-agent-cli.svg)](https://www.npmjs.com/package/kyawthiha-nextjs-agent-cli)
[![GitHub](https://img.shields.io/github/stars/kywthiha/nextjs-agent-cli?style=social)](https://github.com/kywthiha/nextjs-agent-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

- 🤖 **AI-Powered Development** - Describe what you want, the agent builds it
- 📁 **Real File Operations** - Creates and modifies files directly in your project
- 🔧 **Automated Setup** - Installs dependencies, runs builds, handles database setup
- ✅ **Self-Verification** - Detects errors and attempts automatic fixes
- 🔐 **Secure API Key Storage** - Credentials stored locally at `~/.nextjs-agent-cli/cred.json`
- 🎨 **Beautiful CLI** - Interactive prompts with colorful output

---

## 📋 Requirements

- **Node.js** 18 or later
- **npm** or **pnpm**
- **Gemini API Key** - Get one from [Google AI Studio](https://aistudio.google.com/)
- **PostgreSQL** (optional) - Only if your project uses a database

### Search Tools (Recommended)

For enhanced code search capabilities, install these CLI tools:

| Tool | Description | Install Guide |
| ---- | ----------- | ------------- |
| **ripgrep (rg)** | Fast regex search | [Installation Guide](https://github.com/BurntSushi/ripgrep#installation) |
| **fd** | Fast file finder | [Installation Guide](https://github.com/sharkdp/fd#installation) |

**Quick Install:**

```bash
# Windows (winget)
winget install BurntSushi.ripgrep.MSVC
winget install sharkdp.fd

# macOS (Homebrew)
brew install ripgrep fd

# Ubuntu/Debian
sudo apt install ripgrep fd-find
```

---

## 🚀 Quick Start

### Install Globally

```bash
npm install -g kyawthiha-nextjs-agent-cli
```

### Set Your API Key (One Time)

```bash
next-agent config set-api-key
```

### Start Building

```bash
next-agent start
```

---

## 📖 Commands

| Command | Description |
|---------|-------------|
| `next-agent start` | Start the AI agent to build a new project |
| `next-agent config set-api-key` | Set or update your Gemini API key |
| `next-agent config show` | Show current configuration |
| `next-agent --help` | Display all available commands |

### Start Command Options

```bash
next-agent start [options]

Options:
  -n, --project-name <name>    Project name (created in current directory)
  -m, --max-iterations <num>   Maximum agent iterations (default: 500)
  --skip-db                    Skip PostgreSQL configuration
  --no-verbose                 Disable verbose logging
```

---

## 🎯 Interactive Workflow

### 1. Project Setup

```
╔═══════════════════════════════════════════════════════════╗
║     🚀 Next.js Fullstack Agent CLI                        ║
║     Build full-stack apps with AI assistance              ║
╚═══════════════════════════════════════════════════════════╝

✔ Ready to build!

? What is your project name? my-app
```

### 2. API Key (First Time Only)

```
? Please enter your Gemini API Key: ********
? Save API key for future sessions? Yes
✔ API key saved to C:\Users\User\.nextjs-agent-cli\cred.json
```

### 3. Model Selection

```
? Select Gemini Model:
  ❯ gemini-3-flash-preview
    gemini-3-pro-preview
```

### 4. Database Configuration (Optional)

```
--- PostgreSQL Configuration ---
? Host: localhost
? Port: 5432
? Username: postgres
? Password: postgres
? Database Name: my-app
```

Use `--skip-db` to skip this step for static sites.

### 5. Describe Your App

```
? What do you want to build or modify?
> Build a todo app with user authentication and task categories
```

The agent will:
- 📝 Create an implementation plan
- ✅ Execute tasks step by step
- 🔍 Verify builds and runtime
- 🔧 Auto-fix errors when possible

---

## 🗂️ Project Structure

After the agent runs, your project will have:

```
my-app/
├── .agent/
│   ├── plan1.md              # Implementation plan
│   └── task1.md              # Task checklist
├── src/
│   ├── app/                  # Next.js app router
│   ├── components/           # React components
│   └── lib/                  # Utilities
├── prisma/                   # Database schema (if using DB)
├── package.json
└── ...
```

---

## ⚙️ Configuration

### API Key Storage

API keys are stored securely at:
- **Windows**: `C:\Users\<User>\.nextjs-agent-cli\cred.json`
- **macOS/Linux**: `~/.nextjs-agent-cli/cred.json`

### Environment Variables

You can also set your API key via environment variable:

```bash
export GEMINI_API_KEY=your_api_key_here
```

Priority: Environment variable > Credential store > Interactive prompt

---

## 🧪 After Generation

Once the agent finishes, run your project:

```bash
cd my-app
npm run dev
```

Open http://localhost:3000 in your browser.

---

## 🛠️ Development

### Clone and Build

```bash
git clone https://github.com/kywthiha/nextjs-agent-cli.git
cd nextjs-agent-cli
npm install
npm run build
```

### Run Locally

```bash
npm run dev
```

---

## 📝 Examples

### Create a Todo App

```bash
next-agent start -n my-todo-app
# Then enter: "Build a todo app with categories and due dates"
```

### Create an E-commerce Site

```bash
next-agent start -n my-shop
# Then enter: "Build a product catalog with shopping cart and checkout"
```

### Static Landing Page (No Database)

```bash
next-agent start -n landing --skip-db
# Then enter: "Build a modern landing page for a SaaS product"
```

---

## ⚠️ Limitations

- Complex architecture decisions may need guidance
- Some runtime issues require manual intervention
- The agent prioritizes safety over aggressive automation

---

## 📄 License

MIT License

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

## 🎬 Demo

### 📦 Inventory & POS Application

- **GitHub**: [https://github.com/kywthiha/my-inv-pos](https://github.com/kywthiha/my-inv-pos)
- **Live Demo**: [https://my-inv-pos.vercel.app/](https://my-inv-pos.vercel.app/)

### Demo Video

[![YouTube Demo](https://img.shields.io/badge/YouTube-Demo-red?style=for-the-badge&logo=youtube)](https://youtu.be/I-c4XH_nCEM)

▶️ [Watch the Demo on YouTube](https://youtu.be/I-c4XH_nCEM)

---

**Made with ❤️ for the Gemini 3 Hackathon 2026**
