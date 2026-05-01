/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

export interface EnvTemplateField {
  varName: string
  label: string
  required: boolean
  placeholder?: string
  description?: string
}

export interface EnvTemplate {
  service: string
  label: string
  category: 'api_key' | 'mcp_config' | 'integration' | 'preference'
  helpUrl: string
  description: string
  fields: EnvTemplateField[]
}

export const ENV_TEMPLATES: readonly EnvTemplate[] = [
  // ── AI / LLM ──
  {
    service: 'anthropic',
    label: 'Anthropic (Claude)',
    category: 'api_key',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Claude API for direct SDK calls',
    fields: [
      { varName: 'ANTHROPIC_API_KEY', label: 'API Key', required: true, placeholder: 'sk-ant-...' },
    ],
  },
  {
    service: 'openai',
    label: 'OpenAI',
    category: 'api_key',
    helpUrl: 'https://platform.openai.com/api-keys',
    description: 'OpenAI API (GPT, DALL-E, Whisper)',
    fields: [
      { varName: 'OPENAI_API_KEY', label: 'API Key', required: true, placeholder: 'sk-...' },
      { varName: 'OPENAI_ORG_ID', label: 'Organization ID', required: false, placeholder: 'org-...' },
    ],
  },
  {
    service: 'google-ai',
    label: 'Google AI Studio',
    category: 'api_key',
    helpUrl: 'https://aistudio.google.com/app/apikey',
    description: 'Gemini API key',
    fields: [
      { varName: 'GOOGLE_AI_API_KEY', label: 'API Key', required: true, placeholder: 'AI...' },
    ],
  },
  {
    service: 'replicate',
    label: 'Replicate',
    category: 'api_key',
    helpUrl: 'https://replicate.com/account/api-tokens',
    description: 'Run open-source models via API',
    fields: [
      { varName: 'REPLICATE_API_TOKEN', label: 'API Token', required: true, placeholder: 'r8_...' },
    ],
  },
  {
    service: 'huggingface',
    label: 'Hugging Face',
    category: 'api_key',
    helpUrl: 'https://huggingface.co/settings/tokens',
    description: 'HF Inference API & model hub',
    fields: [
      { varName: 'HUGGINGFACE_TOKEN', label: 'Access Token', required: true, placeholder: 'hf_...' },
    ],
  },
  {
    service: 'elevenlabs',
    label: 'ElevenLabs',
    category: 'api_key',
    helpUrl: 'https://elevenlabs.io/app/settings/api-keys',
    description: 'Text-to-speech & voice cloning',
    fields: [
      { varName: 'ELEVENLABS_API_KEY', label: 'API Key', required: true },
    ],
  },
  {
    service: 'deepgram',
    label: 'Deepgram',
    category: 'api_key',
    helpUrl: 'https://console.deepgram.com/',
    description: 'Speech-to-text API',
    fields: [
      { varName: 'DEEPGRAM_API_KEY', label: 'API Key', required: true },
    ],
  },

  // ── Code & DevOps ──
  {
    service: 'github',
    label: 'GitHub',
    category: 'api_key',
    helpUrl: 'https://github.com/settings/tokens',
    description: 'Personal access token (repo scope)',
    fields: [
      { varName: 'GITHUB_TOKEN', label: 'Personal Access Token', required: true, placeholder: 'ghp_...' },
    ],
  },
  {
    service: 'vercel',
    label: 'Vercel',
    category: 'api_key',
    helpUrl: 'https://vercel.com/account/tokens',
    description: 'Vercel CLI & deployments API',
    fields: [
      { varName: 'VERCEL_TOKEN', label: 'API Token', required: true },
      { varName: 'VERCEL_ORG_ID', label: 'Organization ID', required: false, placeholder: 'team_...' },
      { varName: 'VERCEL_PROJECT_ID', label: 'Project ID', required: false, placeholder: 'prj_...' },
    ],
  },
  {
    service: 'coolify',
    label: 'Coolify',
    category: 'api_key',
    helpUrl: 'https://coolify.io',
    description: 'Self-hosted PaaS API',
    fields: [
      { varName: 'COOLIFY_API_TOKEN', label: 'API Token', required: true },
      { varName: 'COOLIFY_BASE_URL', label: 'Base URL', required: false, placeholder: 'https://coolify.example.com', description: 'Your Coolify instance URL' },
    ],
  },
  {
    service: 'sentry',
    label: 'Sentry',
    category: 'integration',
    helpUrl: 'https://sentry.io/settings/account/api/auth-tokens/',
    description: 'Error tracking & performance monitoring',
    fields: [
      { varName: 'SENTRY_DSN', label: 'DSN', required: true, placeholder: 'https://...@sentry.io/...' },
      { varName: 'SENTRY_AUTH_TOKEN', label: 'Auth Token', required: false, description: 'For source maps upload & release management' },
      { varName: 'SENTRY_ORG', label: 'Organization Slug', required: false },
      { varName: 'SENTRY_PROJECT', label: 'Project Slug', required: false },
    ],
  },

  // ── Cloud & Infrastructure ──
  {
    service: 'aws',
    label: 'AWS / S3',
    category: 'api_key',
    helpUrl: 'https://console.aws.amazon.com/iam/home#/security_credentials',
    description: 'AWS services (S3, SES, Lambda, etc.)',
    fields: [
      { varName: 'AWS_ACCESS_KEY_ID', label: 'Access Key ID', required: true, placeholder: 'AKIA...' },
      { varName: 'AWS_SECRET_ACCESS_KEY', label: 'Secret Access Key', required: true },
      { varName: 'AWS_REGION', label: 'Region', required: false, placeholder: 'eu-central-1' },
      { varName: 'AWS_S3_BUCKET', label: 'Default S3 Bucket', required: false },
    ],
  },
  {
    service: 'cloudflare',
    label: 'Cloudflare',
    category: 'api_key',
    helpUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    description: 'DNS, Workers, Pages, R2',
    fields: [
      { varName: 'CLOUDFLARE_API_TOKEN', label: 'API Token', required: true, description: 'Scoped token (workers/pages/dns)' },
      { varName: 'CLOUDFLARE_ACCOUNT_ID', label: 'Account ID', required: false, description: 'Required for Workers/R2' },
      { varName: 'CLOUDFLARE_ZONE_ID', label: 'Zone ID', required: false, description: 'For DNS-specific operations' },
    ],
  },
  {
    service: 'supabase',
    label: 'Supabase',
    category: 'api_key',
    helpUrl: 'https://supabase.com/dashboard/account/tokens',
    description: 'Database, Auth, Storage, Edge Functions',
    fields: [
      { varName: 'SUPABASE_ACCESS_TOKEN', label: 'Personal Access Token', required: true, description: 'For Supabase CLI & Management API' },
      { varName: 'SUPABASE_URL', label: 'Project URL', required: false, placeholder: 'https://xxx.supabase.co' },
      { varName: 'SUPABASE_ANON_KEY', label: 'Anon Key', required: false, description: 'Client-side key (public)' },
      { varName: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', required: false, description: 'Server-side key (secret — bypasses RLS)' },
    ],
  },
  {
    service: 'firebase',
    label: 'Firebase',
    category: 'api_key',
    helpUrl: 'https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk',
    description: 'Firebase / Google Cloud project',
    fields: [
      { varName: 'FIREBASE_PROJECT_ID', label: 'Project ID', required: true },
      { varName: 'FIREBASE_API_KEY', label: 'Web API Key', required: false, description: 'Client-side key from project settings' },
      { varName: 'FIREBASE_SERVICE_ACCOUNT', label: 'Service Account JSON', required: false, description: 'Paste the full JSON or base64-encode it' },
    ],
  },

  // ── Auth (OAuth) ──
  {
    service: 'google-oauth',
    label: 'Google OAuth',
    category: 'integration',
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
    description: 'Google Sign-In & OAuth 2.0',
    fields: [
      { varName: 'GOOGLE_CLIENT_ID', label: 'Client ID', required: true, placeholder: '...apps.googleusercontent.com' },
      { varName: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret', required: true },
      { varName: 'GOOGLE_PROJECT_ID', label: 'Project ID', required: false },
    ],
  },

  // ── Payments ──
  {
    service: 'stripe',
    label: 'Stripe',
    category: 'api_key',
    helpUrl: 'https://dashboard.stripe.com/apikeys',
    description: 'Payments, subscriptions, billing',
    fields: [
      { varName: 'STRIPE_SECRET_KEY', label: 'Secret Key', required: true, placeholder: 'sk_live_... or sk_test_...' },
      { varName: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable Key', required: false, placeholder: 'pk_live_... or pk_test_...', description: 'Client-side key for Stripe.js' },
      { varName: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Secret', required: false, placeholder: 'whsec_...', description: 'For verifying webhook signatures' },
    ],
  },

  // ── Email & Communication ──
  {
    service: 'resend',
    label: 'Resend',
    category: 'api_key',
    helpUrl: 'https://resend.com/api-keys',
    description: 'Transactional email API',
    fields: [
      { varName: 'RESEND_API_KEY', label: 'API Key', required: true, placeholder: 're_...' },
    ],
  },
  {
    service: 'sendgrid',
    label: 'SendGrid',
    category: 'api_key',
    helpUrl: 'https://app.sendgrid.com/settings/api_keys',
    description: 'Email delivery & marketing',
    fields: [
      { varName: 'SENDGRID_API_KEY', label: 'API Key', required: true, placeholder: 'SG...' },
      { varName: 'SENDGRID_FROM_EMAIL', label: 'Default From Email', required: false, placeholder: 'noreply@example.com' },
    ],
  },
  {
    service: 'smtp',
    label: 'SMTP (Generic)',
    category: 'integration',
    helpUrl: '',
    description: 'Any SMTP server for sending email',
    fields: [
      { varName: 'SMTP_HOST', label: 'Host', required: true, placeholder: 'smtp.gmail.com' },
      { varName: 'SMTP_PORT', label: 'Port', required: true, placeholder: '587' },
      { varName: 'SMTP_USER', label: 'Username', required: true },
      { varName: 'SMTP_PASS', label: 'Password', required: true },
      { varName: 'SMTP_FROM', label: 'From Address', required: false, placeholder: 'Name <noreply@example.com>' },
    ],
  },
  {
    service: 'twilio',
    label: 'Twilio',
    category: 'api_key',
    helpUrl: 'https://console.twilio.com/',
    description: 'SMS, voice, WhatsApp',
    fields: [
      { varName: 'TWILIO_ACCOUNT_SID', label: 'Account SID', required: true, placeholder: 'AC...' },
      { varName: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', required: true },
      { varName: 'TWILIO_PHONE_NUMBER', label: 'Phone Number', required: false, placeholder: '+1234567890', description: 'Default sender number' },
    ],
  },

  // ── Design ──
  {
    service: 'figma',
    label: 'Figma',
    category: 'api_key',
    helpUrl: 'https://www.figma.com/developers/api#access-tokens',
    description: 'Figma design API',
    fields: [
      { varName: 'FIGMA_TOKEN', label: 'Personal Access Token', required: true },
    ],
  },

  // ── Media & Images ──
  {
    service: 'unsplash',
    label: 'Unsplash',
    category: 'api_key',
    helpUrl: 'https://unsplash.com/oauth/applications',
    description: 'Free high-res photos API',
    fields: [
      { varName: 'UNSPLASH_ACCESS_KEY', label: 'Access Key', required: true, description: 'Public key for API requests' },
      { varName: 'UNSPLASH_SECRET_KEY', label: 'Secret Key', required: true, description: 'Private key for OAuth flows' },
      { varName: 'UNSPLASH_APP_ID', label: 'Application ID', required: false, description: 'Numeric app ID from the dashboard' },
    ],
  },
  {
    service: 'pexels',
    label: 'Pexels',
    category: 'api_key',
    helpUrl: 'https://www.pexels.com/api/',
    description: 'Free stock photos & videos',
    fields: [
      { varName: 'PEXELS_API_KEY', label: 'API Key', required: true },
    ],
  },
  {
    service: 'pixabay',
    label: 'Pixabay',
    category: 'api_key',
    helpUrl: 'https://pixabay.com/api/docs/',
    description: 'Free images, illustrations, vectors',
    fields: [
      { varName: 'PIXABAY_API_KEY', label: 'API Key', required: true },
    ],
  },

  // ── Video & AI Generation ──
  {
    service: 'kling',
    label: 'Kling AI',
    category: 'api_key',
    helpUrl: 'https://platform.klingai.com/',
    description: 'AI video generation',
    fields: [
      { varName: 'KLING_ACCESS_KEY', label: 'Access Key', required: true },
      { varName: 'KLING_SECRET_KEY', label: 'Secret Key', required: true },
    ],
  },

  // ── CRM & Business ──
  {
    service: 'odoo',
    label: 'Odoo CRM',
    category: 'integration',
    helpUrl: 'https://fl1.cz/odoo',
    description: 'Odoo ERP/CRM integration',
    fields: [
      { varName: 'ODOO_API_KEY', label: 'API Key', required: true },
      { varName: 'ODOO_URL', label: 'Instance URL', required: false, placeholder: 'https://fl1.cz/odoo' },
      { varName: 'ODOO_DB', label: 'Database Name', required: false },
      { varName: 'ODOO_USERNAME', label: 'Username', required: false },
    ],
  },

  // ── Automation ──
  {
    service: 'n8n',
    label: 'n8n',
    category: 'integration',
    helpUrl: 'https://docs.n8n.io/api/',
    description: 'Workflow automation (self-hosted)',
    fields: [
      { varName: 'N8N_API_KEY', label: 'API Key', required: true },
      { varName: 'N8N_BASE_URL', label: 'Base URL', required: false, placeholder: 'https://n8n.example.com' },
      { varName: 'N8N_WEBHOOK_URL', label: 'Webhook Base URL', required: false, placeholder: 'https://n8n.example.com/webhook' },
    ],
  },

  // ── Analytics ──
  {
    service: 'plausible',
    label: 'Plausible Analytics',
    category: 'api_key',
    helpUrl: 'https://plausible.io/settings',
    description: 'Privacy-friendly analytics',
    fields: [
      { varName: 'PLAUSIBLE_API_KEY', label: 'API Key', required: true },
      { varName: 'PLAUSIBLE_SITE_ID', label: 'Site ID / Domain', required: false, placeholder: 'example.com' },
      { varName: 'PLAUSIBLE_HOST', label: 'Host URL', required: false, placeholder: 'https://plausible.io', description: 'For self-hosted instances' },
    ],
  },
  {
    service: 'posthog',
    label: 'PostHog',
    category: 'api_key',
    helpUrl: 'https://app.posthog.com/project/settings',
    description: 'Product analytics & feature flags',
    fields: [
      { varName: 'POSTHOG_API_KEY', label: 'Project API Key', required: true, placeholder: 'phc_...' },
      { varName: 'POSTHOG_HOST', label: 'Host URL', required: false, placeholder: 'https://app.posthog.com', description: 'For self-hosted or EU instances' },
      { varName: 'POSTHOG_PERSONAL_API_KEY', label: 'Personal API Key', required: false, description: 'For management API calls' },
    ],
  },
] as const
