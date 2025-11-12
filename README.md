## Technologies

- **Next.js**: React framework for server-side rendering and static site generation.
- **TypeScript**: Strongly typed JavaScript for better developer experience.
- **ESLint**: Linting for consistent code.
- **Ollama Integration**: Scripts for managing Ollama services.

## Prerequisites

- **Ollama**: This project requires the Ollama CLI to be installed and running locally.
  Downloads are available at https://ollama.com/download. After installation, you should sign up https://signin.ollama.com/, create the API key, set it as NextJS public environmental variable.

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd olla
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Scripts

- **Development**: Start the development server:

  ```bash
  npm run dev
  ```

- **Build**: Create a production build:

  ```bash
  npm run build
  ```

- **Start**: Run the production server:

  ```bash
  npm run start
  ```

- **Lint**: Check for linting errors:

  ```bash
  npm run lint
  ```

- **Type Check**: Run TypeScript type checks:

  ```bash
  npm run tsc
  ```

## Configuration

- **Environment Variables**:
  - Create a `.env` file in the root directory (or rename `.example.env`)
  - Define the required variables: `BASE_URL`, `OLLAMA_API_KEY`.

## Pages

- **/compare** — An interactive page for side-by-side comparison of model outputs. It provides two chat panels so you can run the same prompt (or different prompts) against two model selections and compare results visually and functionally.

  - How it works: the UI component (`/compare`) calls the server API route at `/api/compare/` to run the models and stream the outputs.

- **/clash** — An interactive page to run two models against each other. It provides controls to pick Model A and Model B, choose or edit a system prompt (competitive or collaborative modes), and start (or stop) multi-round AI-to-AI conversation.

  - How it works: the page (`/clash`) composes a system prompt and a user prompt, then the server route at `/api/clash/` streams alternating responses from the selected models. The route returns events as newline-delimited JSON so the UI can render streaming deltas.

- **/judge** — Evaluate a finished conversation between two models and produce numeric scores and feedback. The judge itself is an AI model that you can select in the UI. The `/judge` page reads the conversation from sessionStorage, sends it to the `/api/judge/` route, and renders a scored breakdown and textual feedback.

  - Scoring format: the judge expects each metric to be a numeric score on a 1–10 scale. The UI displays each metric as `N.N/10` and shows an overall winner and a short written critique.

  - How it works: the page (`app/judge`) posts the dialogue and prompts to the server route at `/api/judge/`. That route runs the judge model, enforces the JSON schema, validates the response, and returns a JSON object containing `modelA`, `modelB` (each a breakdown of metrics), `winner`, and `text_feedback`.

## Note

It is not necessary to have the models loaded locally before starting. Every model will be pulled if necessary and then unloaded from memory during the cleanup process.

## Screenshot

Although this application is fully responsive, we'll place here desktop screenshots only.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
