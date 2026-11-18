// `npm start`: renders the Article demo and prints the Markdown.
import { render } from "./renderer";
import { Article } from "./demo";

const container = { output: "" };
render(<Article />, container);
console.log(container.output);
