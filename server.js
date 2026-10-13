const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const ollamaUrl = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 14_000_000) {
        reject(new Error('That image is too large. Please use an image under 10 MB.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('The request could not be read.'));
      }
    });
    request.on('error', reject);
  });
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/status') {
    try {
      const result = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
      if (!result.ok) throw new Error('Ollama is not responding.');
      const data = await result.json();
      const availableModels = await Promise.all((data.models || []).map(async (model) => {
        try {
          const details = await fetch(`${ollamaUrl}/api/show`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: model.name }),
            signal: AbortSignal.timeout(2500),
          });
          if (!details.ok) return /gemma3|llava|qwen.*vl|moondream|bakllava|vision/i.test(model.name);
          const info = await details.json();
          return info.capabilities?.includes('vision')
            || /gemma3|llava|qwen.*vl|moondream|bakllava|vision/i.test(model.name);
        } catch {
          return /gemma3|llava|qwen.*vl|moondream|bakllava|vision/i.test(model.name);
        }
      }));
      const models = (data.models || []).filter((model, index) => availableModels[index]).map((model) => model.name);
      return sendJson(response, 200, { online: true, models });
    } catch {
      return sendJson(response, 200, { online: false, models: [] });
    }
  }

  if (request.method === 'POST' && pathname === '/api/extract') {
    let input;
    try {
      input = await readJson(request);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }

    if (!input.model || typeof input.image !== 'string' || !/^image\/(jpeg|png|webp)$/.test(input.type || '')) {
      return sendJson(response, 400, { error: 'Choose a vision model and a JPG, PNG, or WebP receipt image.' });
    }

    try {
      const result = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
          model: input.model,
          stream: false,
          format: 'json',
          messages: [{
            role: 'user',
            content: 'Read this receipt. Return a JSON object with vendor, date (YYYY-MM-DD when visible), amount (final total as a number), tax (number or null), currency (ISO code), category (one of Meals, Transport, Office, Software, Travel, Other), and payment (short label or empty string). Do not guess missing values: use an empty string for missing text and null for missing numbers. Return only the object.',
            images: [input.image],
          }],
        }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'The local model could not read this receipt.');
      return sendJson(response, 200, { result: JSON.parse(data.message?.content || '{}') });
    } catch (error) {
      const message = error.name === 'TimeoutError'
        ? 'The model took too long. Try a smaller image or a faster local model.'
        : error.message || 'Could not reach the local model. Check that Ollama is running.';
      return sendJson(response, 502, { error: message });
    }
  }

  return sendJson(response, 404, { error: 'Not found.' });
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname.startsWith('/api/')) return handleApi(request, response, pathname);

  const requestedPath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, 'index.html')) {
    response.writeHead(403);
    return response.end('Forbidden');
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      return response.end('Not found');
    }
    response.writeHead(200, { 'content-type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Slipstream is running at http://127.0.0.1:${port}`);
});