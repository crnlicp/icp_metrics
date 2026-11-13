# ICP Pulse

Live dashboard for Internet Computer cycle burn, ICP burn/mint and inflation, served from an ICP canister
(`@dfinity/static-site` recipe). Pure static frontend; data comes straight from the public
[IC API](https://ic-api.internetcomputer.org/api/v3/swagger) and
[Ledger API](https://ledger-api.internetcomputer.org/swagger-ui/) (both CORS-enabled).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for all calculations (src/lib/metrics.test.ts)
npm run build
```

## Deploy locally

```bash
icp network start -d                 # gateway on port 8010 (see icp.yaml)
icp deploy --identity anonymous
# → http://frontend.local.localhost:8010/
icp network stop
```

## Deploy to mainnet

```bash
icp deploy -e ic --identity <your-identity>   # needs cycles; commit .icp/data/ afterwards
```

## Layout

- `src/lib/api.ts`: API client
- `src/lib/metrics.ts`: all burn / mint / inflation math (pure, tested)
- `src/components/ParticleField.tsx`: canvas burn/mint simulation
- `public/_headers`, `public/_redirects`: CSP, caching and SPA routing for the certified-assets canister
