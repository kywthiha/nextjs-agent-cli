# Next.js Fullstack Agent CLI

Gemini 3 Hackathon Entry 2026

**Gemini Next.js Agent CLI** is an autonomous, tool-driven developer agent that transforms natural language into verified, production-ready Next.js fullstack applications.

The agent plans tasks, executes real commands, verifies results, attempts repairs, and asks for manual input only when automation is unsafe.

---

## Overview

This CLI is designed to behave like a real developer inside a real project environment.

Instead of only generating code, the agent:
- Creates and modifies files directly
- Runs installs and builds
- Verifies results through execution
- Attempts automated fixes when failures occur
- Pauses for human input when decisions require clarity

The focus is reliability, correctness, and real execution.

---

## Features

- Runtime: Node.js
- Language: TypeScript
- CLI Framework: Commander, Inquirer
- Agent: Gemini-powered agentic workflow
- Planning before execution
- Real filesystem operations
- Build and runtime verification
- Targeted self-repair for failures

---

## Requirements

Before installing, ensure you have:

- Node.js 18 or later
- npm or pnpm
- PostgreSQL (optional, only required if your project uses a database)
- A Gemini API key

---

## Installation (Step by Step)

1. Clone the repository
```bash
git clone https://github.com/kywthiha/nextjs-agent-cli.git
```
2. Move into the project directory


```bash
cd nextjs-agent-cli
```
3. Install dependencies


```bash
npm install
```
4. Configure environment variables


```bash
cp .env.example .env
```
Add your Gemini API key to the .env file:
```bash
GEMINI_API_KEY=your_api_key_here

```
---

Running the CLI

Start the CLI in development mode:
```bash
npm run dev
```
The agent will launch an interactive session in your terminal.


---

Interactive Workflow

1. Project Creation

Choose where the Next.js project should be created.

? Where should the project be created? (./my-app)


---

2. Model Selection

Select the Gemini model for the agent.

gemini-3-flash-preview

gemini-3-pro-preview



---

3. Database Configuration (Optional)

If your project requires a database, configure PostgreSQL:

--- PostgreSQL Configuration ---
? Host: localhost
? Port: 5432
? Username: postgres
? Password: [HIDDEN]

The agent will:

Verify the connection

Create the database if it does not exist

Handle schema setup when required



---

4. Define Your Goal

Describe what you want to build using natural language.

? What do you want to build or modify?
> Build inventory management for a mobile shop with POS and user management

The agent will then:

Generate an implementation plan (plan.md)

Generate a task checklist (task.md)

Execute tasks step by step

Verify builds and runtime behavior

Attempt fixes if errors occur



---

Testing and Verification

Verification is a core part of the agent’s workflow.

During execution, the agent may:

Run dependency installs

Run builds

Detect runtime or build failures

Attempt automated fixes

Re-run verification steps


If a failure requires a business or architectural decision, the agent will pause and request manual input instead of guessing.


---

Manual Testing (Optional)

After the agent finishes, you can manually verify the generated project:

cd my-app
npm run dev

Open the browser at:

http://localhost:3000


---

Limitations

Some runtime issues require human decisions

Complex architecture changes may need guidance

The agent prioritizes safety and correctness over aggressive automation


These constraints are intentional.


---

License

MIT License
