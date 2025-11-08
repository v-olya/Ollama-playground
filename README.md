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

  - How it works: the page uses the client UI components in `app/compare` (two-chat layout and chat panels) and calls the server API route at `/api/compare` to run and fetch model outputs.

  - Quick use: open `http://localhost:3000/compare` while the dev server is running, enter a prompt or prompts, choose models, then run to see results side-by-side.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
