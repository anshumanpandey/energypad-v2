import helmet from 'helmet';

const AppHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'", 'example.com'],
    },
  },
});

export default AppHelmet;
