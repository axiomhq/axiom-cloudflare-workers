![axiom-cloudflare: Send logs from Cloudflare Workers to Axiom](.github/images/banner-dark.svg#gh-dark-mode-only)
![axiom-cloudflare: Send logs from Cloudflare Workers to Axiom](.github/images/banner-light.svg#gh-light-mode-only)

[Axiom](https://axiom.co) unlocks observability at any scale.

- **Ingest with ease, store without limits:** Axiom’s next-generation datastore
  enables ingesting petabytes of data with ultimate efficiency. Ship logs from
  Kubernetes, AWS, Azure, Google Cloud, DigitalOcean, Nomad, and others.
- **Query everything, all the time:** Whether DevOps, SecOps, or EverythingOps,
  query all your data no matter its age. No provisioning, no moving data from
  cold/archive to “hot”, and no worrying about slow queries. All your data, all.
  the. time.
- **Powerful dashboards, for continuous observability:** Build dashboards to
  collect related queries and present information that’s quick and easy to
  digest for you and your team. Dashboards can be kept private or shared with
  others, and are the perfect way to bring together data from different sources.

For more information, check out the [official documentation](https://axiom.co/docs)
and our [community Discord](https://axiom.co/discord).

---

This worker script can send logs from Cloudflare to Axiom.

## Quickstart 

 Clone the  the repository to your local macchine

Update the authentication variables to corresponding dataset and token in your `wrangler.toml` file:
```shell
 AXIOM_DATASET = "my-dataset" // Your Axiom dataset
 AXIOM_TOKEN = "xapt-xxx" // Your Axiom API token
```
run the following command
```shell 
   npm install
   npx wrangler login
   npx wrangler deploy
```

## Using the deploy button

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/axiomhq/axiom-cloudflare-workers)

 1. Click the button and follow the instructions, you should end up with  a clone of this repository
 2. Navigate to your new **GitHub repository &gt; Settings &gt; Secrets** and add the following secrets:
 ```yaml
     - Name: CF_API_TOKEN (should be added automatically)

     - Name: CF_ACCOUNT_ID (should be added automatically)

     - Name: AXIOM_TOKEN (required)
     - Name: AXIOM_DATASET (required)
 ```
3. Navigate to the **Actions** settings in your repository and enable them

Add triggers for the worker, e.g a route trigger:
  - Navigate to the worker and click on the `Triggers` tab.
  - Scroll down to Routes and click `Add Route`.
  - Enter a route, e.g `*.example.com` and choose the related zone, 
    then click `Save`.

When requests are made to the routes you setup, the worker will be triggered and you will see the logs delivered to your Axiom dataset.




