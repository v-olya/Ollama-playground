## Technologies

- **Next.js**: React framework for server-side rendering and static site generation.
- **TypeScript**: Strongly typed JavaScript for better developer experience.
- **ESLint**: Linting for consistent code.
- **Ollama Integration**: Scripts for managing Ollama services.

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

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
