# World Wide Webb - Tilt Development Configuration
# Single-command dev environment with live reload

# Load extensions
load('ext://dotenv', 'dotenv')

# Load environment variables from .env.local if it exists
# The dotenv extension will silently skip if the file doesn't exist
dotenv('.env.local')

# =============================================================================
# Configuration
# =============================================================================

# Set up Tilt settings
update_settings(
    max_parallel_updates=3,
    k8s_upsert_timeout_secs=60,
)

# =============================================================================
# 1. Mailpit - Email Testing (Docker)
# =============================================================================

# Build Mailpit image
docker_build(
    'mailpit-local',
    context='.',
    dockerfile_contents='''
FROM axllent/mailpit:latest
''',
)

# Generate Kubernetes-style YAML for Tilt to manage
mailpit_yaml = blob('''
apiVersion: v1
kind: Service
metadata:
  name: mailpit
  labels:
    app: mailpit
spec:
  ports:
  - name: smtp
    port: 1025
    targetPort: 1025
  - name: http
    port: 8025
    targetPort: 8025
  selector:
    app: mailpit
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mailpit
  labels:
    app: mailpit
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mailpit
  template:
    metadata:
      labels:
        app: mailpit
    spec:
      containers:
      - name: mailpit
        image: mailpit-local
        ports:
        - containerPort: 1025
          name: smtp
        - containerPort: 8025
          name: http
        env:
        - name: MP_MAX_MESSAGES
          value: "500"
        - name: MP_DATA_FILE
          value: /data/mailpit.db
        volumeMounts:
        - name: mailpit-data
          mountPath: /data
      volumes:
      - name: mailpit-data
        hostPath:
          path: /tmp/world-wide-webb-mailpit
          type: DirectoryOrCreate
''')

k8s_yaml(mailpit_yaml)

# Configure Mailpit resource
k8s_resource(
    'mailpit',
    port_forwards=['1025:1025', '8025:8025'],
    labels=['infrastructure'],
    links=[
        link('http://localhost:8025', 'Mailpit UI'),
    ],
)

# =============================================================================
# 2. Database Migrations (Local)
# =============================================================================

local_resource(
    'migrations',
    cmd='pnpm db:migrate',
    deps=[
        'drizzle/',
        'scripts/migrate.ts',
        'src/lib/db/schema.ts',
        'drizzle.config.ts',
    ],
    labels=['infrastructure'],
    resource_deps=['mailpit'],
    allow_parallel=True,
)

# =============================================================================
# 3. Admin User Seeding (Manual Trigger)
# =============================================================================

local_resource(
    'seed-admin',
    cmd='pnpm db:seed',
    resource_deps=['migrations'],
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['infrastructure'],
)

# =============================================================================
# 4. Next.js Dev Server (Local with HMR)
# =============================================================================

local_resource(
    'nextjs',
    serve_cmd='pnpm dev',
    serve_env={
        'NODE_ENV': 'development',
        'SMTP_HOST': 'localhost',
        'SMTP_PORT': '1025',
        'EMAIL_PROVIDER': 'mailpit',
        'NEXT_PUBLIC_APP_URL': 'http://localhost:3000',
        'BETTER_AUTH_URL': 'http://localhost:3000',
    },
    deps=[
        'src/',
        'package.json',
        'next.config.mjs',
        'tsconfig.json',
        'tailwind.config.ts',
        'postcss.config.mjs',
    ],
    resource_deps=['mailpit', 'migrations'],
    readiness_probe=probe(
        period_secs=5,
        http_get=http_get_action(port=3000, path='/'),
    ),
    labels=['application'],
    links=[
        link('http://localhost:3000', 'App'),
    ],
)

# =============================================================================
# UI Customization
# =============================================================================

# Print helpful startup message
print("""
╔══════════════════════════════════════════════════════════════╗
║  World Wide Webb - Development Environment                   ║
╚══════════════════════════════════════════════════════════════╝

🚀 Starting services:
  • Mailpit (Docker)     - Email testing
  • Migrations (Local)   - Database setup
  • Next.js (Local)      - Dev server with HMR

📊 Tilt Dashboard: http://localhost:10350

🔗 Quick Links:
  • App:        http://localhost:3000
  • Mailpit UI: http://localhost:8025

💡 Tips:
  - Edit code → instant reload (no rebuild)
  - Click "seed-admin" button to create admin user
  - All logs searchable in Tilt UI
  - Data persists across restarts

""")
