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

Add triggers for the worker, e.g a route trigger:

- Navigate to the worker and click on the `Triggers` tab.

- Scroll down to Routes and click `Add Route`.

- Enter a route, e.g `*.example.com` and choose the related zone, 
  then click `Save`.

When requests are made to the routes you setup, the worker will be triggered and you will see the logs delivered to your Axiom dataset.
