import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Drizzle Query Gateway',
  description: 'A policy-enforced, type-safe query proxy for Drizzle ORM',
  base: '/drizzle-query-gateway/',

  head: [
    ['meta', { name: 'theme-color', content: '#4f9c5a' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/define-policy' },
      { text: 'Examples', link: '/examples/basic-crud' },
      { text: 'GitHub', link: 'https://github.com/jbeck018/drizzle-query-gateway' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Security Model', link: '/guide/security-model' },
          { text: 'Architecture', link: '/guide/architecture' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'definePolicy', link: '/api/define-policy' },
          { text: 'createGatewayHandler', link: '/api/create-gateway-handler' },
          { text: 'createAuthMiddleware', link: '/api/create-auth-middleware' },
          { text: 'createGatewayClient', link: '/api/create-gateway-client' },
        ],
      },
      {
        text: 'Examples',
        items: [
          { text: 'Basic CRUD', link: '/examples/basic-crud' },
          { text: 'Multi-Tenant', link: '/examples/multi-tenant' },
          { text: 'Role-Based Access', link: '/examples/role-based-access' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jbeck018/drizzle-query-gateway' },
    ],

    footer: {
      message: 'Released under the MIT License.',
    },
  },
});
