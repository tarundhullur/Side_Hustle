# Slipstream

**A private receipt desk for freelancers.** Slipstream turns receipt photos into organized expenses using an open vision model running locally with [Ollama](https://ollama.com/). It stores expense records in your browser, keeps source photos only in memory while they are analyzed, and exports a spreadsheet-ready CSV.

## Run it

Requirements: Node.js 20 or later. No npm packages or cloud account are needed.

```sh
node server.js
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Manual expense entry, filtering, editing, and CSV export work without Ollama.

## Deploy a demo to Render

Create a **Web Service** for this repository and use:

- Language: `Node`
- Branch: `main`
- Build command: `npm install`
- Start command: `npm start`
- Environment variable: `HOST` = `0.0.0.0`

Choose an available region and the Free instance for a demo. Leave `OLLAMA_URL` unset unless you have deliberately configured a protected, reachable Ollama service. A standard Render instance cannot reach Ollama running on your laptop, so receipt scanning will show as offline; manual entry and CSV export still work. Do not upload real or sensitive receipts to this public demo. Run the app locally with Ollama for private AI receipt processing.

To enable photo scanning, install [Ollama](https://ollama.com/download), start it, then download an open vision model:

```sh
ollama pull gemma3:4b
```

Refresh Slipstream and choose the installed vision model in the local model panel. Other Ollama vision models can be selected from the same list. For Ollama hosted at a different local address, set `OLLAMA_URL` before starting the app, for example `OLLAMA_URL=http://127.0.0.1:11434 node server.js`.

## Privacy and model choice

Receipt images are sent only from the browser to this local Node process, then to the Ollama service at `OLLAMA_URL` (localhost by default). They are not written to disk or stored in the browser. Extracted expense fields are saved in `localStorage` on the current browser profile; CSV export is initiated only when you request it. The model weights are open and run on your machine, so you can inspect, replace, and run them without a per-receipt API bill. Download the model once; receipt extraction can then run without internet access.

The privacy benefit depends on where you run the app: run Node and Ollama on the computer holding the receipts. A forwarded port from Codespaces, another remote dev container, or a hosted server processes photos on that remote machine instead; do not use a remote-hosted instance for sensitive receipts.

## Notes

- Supported receipt images: JPG, PNG, and WebP, up to 10 MB each.
- Receipt extraction quality depends on the selected vision model and image clarity. Review extracted amounts and dates before using them for bookkeeping.
- The initial inbox contains clearly labeled sample entries. They are replaced by your own saved records when you add or edit an expense.
- Expense data is local to this browser. Clearing browser site data also removes saved expenses; use CSV export for a separate copy.