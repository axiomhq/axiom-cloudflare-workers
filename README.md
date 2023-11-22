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

- Create a new Workers application: `npm create cloudflare@latest`
- Select `"Hello World" Worker`
- Select `yes` when prompted to use TypeScript
- Replace the contents of `src/index.ts` with the contents of `src/index.ts` from this repository
- Copy `src/axiom.ts` from this repository into your project
- Update the AxiomLogger constructor in `src/index.ts` with your dataset and token:
- Upload your Axiom token as a [Workers secret](https://developers.cloudflare.com/workers/configuration/secrets/): `npx wrangler secret put AXIOM_TOKEN`

Update the dataset in `src/index.ts` with Axiom your dataset name:

```typescript
const logger = new AxiomLogger({
  ...
  dataset: 'my-dataset', // Your axiom dataset
})
```

Deploy your worker: `npm run deploy`

Your worker will now be available on a `.workers.dev` domain. To add additional routes, see the [Cloudflare documentation](https://developers.cloudflare.com/workers/configuration/routing/routes/).

When requests are made to the routes you setup, the worker will be triggered and you will see the logs delivered to your Axiom dataset.
