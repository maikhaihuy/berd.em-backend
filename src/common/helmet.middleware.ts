import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

const strictHelmet = helmet();
const docsHelmet = helmet({ contentSecurityPolicy: false });

/**
 * Swagger UI at /docs serves an HTML page with an inline-script bundle, which
 * helmet's default Content-Security-Policy blocks. Express runs every
 * matching `app.use` middleware regardless of path specificity, and the last
 * one to set a given header wins - so the CSP exception for /docs can't be a
 * separately-mounted middleware; it has to branch inside one.
 */
export function configureHelmet() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/docs')) {
      return docsHelmet(req, res, next);
    }
    return strictHelmet(req, res, next);
  };
}
