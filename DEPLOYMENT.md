# Deploying CodeLens to Production

CodeLens is designed to be easily deployable to any cloud provider. It runs as a **single Node.js monolithic service**. When `NODE_ENV=production`, the Express API natively serves the compiled React frontend from `client/dist`.

This allows for incredibly simple containerized deployments. 

---

## Prerequisites
Before deploying, make sure you configure your chosen LLM provider API keys as Environment Variables in your hosting platform:
*   `GROQ_API_KEY`
*   `GEMINI_API_KEY`
*   `OPENAI_API_KEY`
*   `ANTHROPIC_API_KEY`

---

## 🚀 Option 1: PaaS (Render, Railway, Heroku)

Deploying to modern PaaS platforms is highly recommended and requires zero Docker knowledge.

### Render.com
1. Connect your GitHub repository to Render.
2. Create a new **Web Service**.
3. **Build Command:** `cd client && npm run build && cd .. && npm ci --omit=dev`
4. **Start Command:** `node server/index.js`
5. **Environment Variables:**
   - `NODE_ENV` = `production`
   - `PORT` = `3001` (Render will auto-detect but it's good practice)
   - Add your chosen API keys.

### Railway.app
Railway automatically detects Dockerfiles. Simply connect the repository, input your API keys into the Variables tab, and Railway will automatically build the `Dockerfile` we provided and expose the port.

---

## 🐳 Option 2: Docker & Docker Compose (VPS, DigitalOcean, EC2)

For traditional VPS hosting with complete control, use the provided Docker manifests.

**1. Clone the repo to your server:**
```bash
git clone https://github.com/your-username/codelens.git && cd codelens
```

**2. Configure your environment:**
You can either edit `docker-compose.yml` to inject environment variables, or create a `.env` file in the root directory:
```bash
echo "GROQ_API_KEY=gsk_your_key_here" > .env
```

**3. Launch the stack:**
```bash
docker compose up -d --build
```

The application will now be running on `http://YOUR_SERVER_IP:3001`. You can route a domain to it using an Nginx reverse proxy.

### Logs
CodeLens utilizes a highly optimized native asynchronous structured logger. 
If you simply run the docker container, you can view the live formatted output via:
```bash
docker logs -f codelens_prod
```

If you configured the volume mounts in `docker-compose.yml`, persistent logs will also be streamed continuously to `/codelens-server.log` on your host machine.
