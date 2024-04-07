//
// Copyright (c) Microsoft.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//

import bodyParser from 'body-parser';
import compression from 'compression';
import path from 'path';
import { Express } from 'express';
import passport from 'passport';

import Debug from 'debug';
const debug = Debug.debug('startup');

export * from './react';
export * from './business/links';
export * from './business';
export * from './jsonError';

import { hasStaticReactClientApp, stripDistFolderName } from '../lib/transitional';
import { StaticClientApp } from './staticClientApp';
import { StaticReactClientApp } from './staticClientApp2';
import { StaticSiteFavIcon, StaticSiteAssets } from './staticSiteAssets';
import connectSession from './session';
import passportConfig from './passportConfig';
import onboard from './onboarding';
import viewServices from '../lib/pugViewServices';

import campaign from './campaign';
import officeHyperlinks from './officeHyperlinks';
import rawBodyParser from './rawBodyParser';

import routeScrubbedUrl from './scrubbedUrl';
import routeLogger from './logger';
import routeLocals from './locals';
import routePassport from './passport-routes';

import routeApi from '../api';

import type { IProviders, IReposApplication, SiteConfiguration } from '../interfaces';
import { codespacesDevAssistant } from './codespaces';
import { ExpressWithStatic } from './types';

export default async function initMiddleware(
  app: IReposApplication,
  express: Express,
  providers: IProviders,
  config: SiteConfiguration,
  dirname: string,
  hasCustomRoutes: boolean,
  initializationError: Error
) {
  config = config || ({} as SiteConfiguration);
  const appDirectory =
    config && config.typescript && config.typescript.appDirectory
      ? config.typescript.appDirectory
      : stripDistFolderName(dirname);
  const applicationProfile = providers.applicationProfile;
  if (initializationError) {
    providers.healthCheck.healthy = false;
  }

  app.set('views', path.join(appDirectory, 'views'));
  app.set('view engine', 'pug');

  app.set('view cache', config.node.isProduction);
  app.disable('x-powered-by');

  app.set('viewServices', viewServices);

  providers.viewServices = viewServices;
  if (applicationProfile.webServer) {
    StaticSiteFavIcon(app);
    app.use(rawBodyParser);
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(compression());
    if (!config.node.isProduction && config.github.codespaces.connected) {
      app.use(codespacesDevAssistant);
    }
    if (applicationProfile.serveStaticAssets) {
      StaticSiteAssets(app, express);
    }
    const expressWithStatic = express as ExpressWithStatic;
    if (hasStaticReactClientApp()) {
      StaticReactClientApp(app, expressWithStatic, config);
    }
    if (applicationProfile.serveClientAssets) {
      StaticClientApp(app, expressWithStatic);
    }
    providers.campaign = campaign(app);
    let passport: passport.PassportStatic;
    if (!initializationError) {
      if (config.containers && config.containers.deployment) {
        app.enable('trust proxy');
        debug('proxy: trusting reverse proxy');
      }
      if (!hasCustomRoutes) {
        app.use('/api', routeApi);
      }
      if (applicationProfile.sessions) {
        app.use(await connectSession(app, config, providers));
        try {
          passport = passportConfig(app, config);
        } catch (passportError) {
          initializationError = passportError;
        }
      }
    }
    app.use(routeScrubbedUrl);
    app.use(routeLogger(config));
    app.use(routeLocals);
    if (!initializationError) {
      if (applicationProfile.sessions) {
        routePassport(app, passport, config);
        if (config?.github?.organizations?.onboarding?.length > 0) {
          debug('Onboarding helper loaded');
          onboard(app, config);
        }
      }
      app.use(officeHyperlinks);
    }
  }
  if (initializationError) {
    providers.healthCheck.healthy = false;
    throw initializationError;
  } else {
    // Ready to accept traffic
    providers.healthCheck.ready = true;
  }
}
