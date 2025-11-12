## Technologies

- **Next.js**: React framework for server-side rendering and static site generation.
- **TypeScript**: Strongly typed JavaScript for better developer experience.
- **ESLint**: Linting for consistent code.
- **Ollama Integration**: Scripts for managing Ollama services.

## Prerequisites

**Ollama**: This project requires the Ollama CLI to be installed and running locally.
Downloads are available at https://ollama.com/download. After installation, you should sign up https://signin.ollama.com/, create the API key, set it as NextJS public environmental variable.

## Configuration

- Create a `.env` file in the root directory (or rename `.example.env`)
- Define the required variables: `BASE_URL`, `OLLAMA_API_KEY`.

## Pages

- **/compare** — An interactive page for side-by-side comparison of model outputs. It provides two chat panels so you can run the same (or different) prompts against two models and compare the results.

The UI component (`/compare`) calls the API route `/api/compare/` to run the models and stream the outputs.

![Compare - running](https://github.com/v-olya/Ollama-playground/blob/master/public/screenshots/Compare-running.png)

- **/clash** — An interactive page to run two models against each other. It provides controls to pick Model A and Model B, choose or edit a system prompt (competitive or collaborative modes), and start (or stop) multi-round AI-to-AI conversation.

The (`/clash`) page composes a system prompt and a user prompt, then the server route at `/api/clash/` streams alternating responses from the selected models. The route returns events as newline-delimited JSON so the UI can render streaming deltas.

![AI-to-AI dialogue](https://github.com/v-olya/Ollama-playground/blob/master/public/screenshots/Compete-or-Collaborate.png)
![Call the judge action](https://github.com/v-olya/Ollama-playground/blob/master/public/screenshots/Call-the-judge.png)

- **/judge** — Evaluate a finished conversation between two models and produce numeric scores and feedback. The judge itself is an AI model that you can select in the UI. The `/judge` page reads the conversation from sessionStorage, sends it to the `/api/judge/` route, and renders a scored breakdown and textual feedback.

The (`app/judge`) page posts the dialogue and prompts to the server route at `/api/judge/`. That route runs the judge model, enforces the JSON schema, validates the response, and returns a JSON object containing `modelA`, `modelB` (each a breakdown of metrics), `winner`, and `text_feedback`.

Scoring format: the judge expects each metric to be a numeric score on a 1–10 scale. The UI displays each metric as `N.N/10` and shows an overall winner and a short written critique.

![Judge - thinking](https://github.com/v-olya/Ollama-playground/blob/master/public/screenshots/Judge-thinking.png)
![Judge's verdict](https://github.com/v-olya/Ollama-playground/blob/master/public/screenshots/Judge%27s-verdict.png)

- **/home** — Just a minimal layout with two teasers for the Compare and Clash pages. The Judge page is accessible through the navbar too and reads the last debate (if any) from the sessionStorage.

  ![Home](https://github.com/v-olya/Ollama-playground/blob/master/public/screenshots/Home.png)

## Notes

- It is not necessary to have the models loaded locally before starting. Every model will be pulled if necessary and then unloaded from memory during the cleanup process.

- Although this application is fully responsive, we'll place here desktop screenshots only. All the images are served from /public/screenshots; raw URLs used to render images on GitHub.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
