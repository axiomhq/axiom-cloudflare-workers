# cloudflare

send logs from cloudflare to axiom

:warning: this is the first iteration of this tool, it is not yet ready for production use.

## Usage

- Copy the contents of `src/worker.js` into a new worker on cloudflare.

- Update the authentication variables to corresponding dataset and token:

```ts
const axiomDataset = "my-dataset" // Your Axiom dataset
const axiomToken = "xapt-xxx" // Your Axiom API token
```
