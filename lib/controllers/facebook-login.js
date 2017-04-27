'use strict';

var helpers = require('../helpers');
var oauth = require('../oauth');

/**
 * This controller logs in an existing user with Facebook OAuth.
 *
 * When a user logs in with Facebook, all of the authentication happens on the
 * client side with Javascript.  Since all authentication happens with
 * Javascript, we *need* to force a newly created and / or logged in Facebook
 * user to redirect to this controller.
 *
 * What this controller does is:
 *
 *  - Grabs the user's Facebook access token from the query string.
 *  - Once we have the user's access token, we send it to Stormpath, so that
 *    we can either create (or update) the user on Stormpath's side.
 *  - Then we retrieve the Stormpath account object for the user, and log
 *    them in using our normal session support.
 *
 * The URL this controller is bound to, and the view used to render this page
 * can all be controlled via express-stormpath settings.
 *
 * @method
 *
 * @param {Object} req - The http request.
 * @param {Object} res - The http response.
 */
module.exports = function (req, res) {
  var application = req.app.get('stormpathApplication');
  var config = req.app.get('stormpathConfig');
  var logger = req.app.get('stormpathLogger');
  var loginHandler = config.postLoginHandler;
  var registrationHandler = config.postRegistrationHandler;

  var provider = config.web.social.facebook;
  var authUrl = 'https://graph.facebook.com/oauth/access_token';
  var baseUrl = config.web.baseUrl || req.protocol + '://' + helpers.getHost(req);

  var code = req.query.code;

  var requestExecutor = require('../okta/request-executor');

  var oauthStateToken = req.cookies.oauthStateToken;
  function codeGrant(config, callback) {

    var req = {
      url: config.org + 'oauth2/' + config.authorizationServerId + '/v1/token',
      method: 'POST',
      json: true,
      form: {
        client_id: config.authorizationServerClientId,
        client_secret: config.authorizationServerClientSecret,
        grant_type: 'authorization_code',
        redirect_uri: baseUrl + config.web.social.facebook.uri,
        state: oauthStateToken,
        code: code
      }
    };

    requestExecutor(req, callback);
  }

  function loginWithAccessToken(accessToken) {
    if (!accessToken) {
      logger.info('A user attempted to log in via Facebook OAuth without specifying an OAuth token.');
      return oauth.errorResponder(req, res, new Error('Access token parameter required.'));
    }

    codeGrant(config, function (err, result) {
      console.log(err, result)
      res.json([err,result]);
    });
    return


    var userData = {
      providerData: {
        accessToken: accessToken,
        providerId: 'facebook'
      }
    };

    application.getAccount(userData, function (err, resp) {
      if (err) {
        logger.info('During a Facebook OAuth login attempt, we were unable to fetch the user\'s social account from Stormpath.');
        return oauth.errorResponder(req, res, err);
      }

      helpers.expandAccount(resp.account, config.expand, logger, function (err, expandedAccount) {
        if (err) {
          logger.info('During a Facebook OAuth login attempt, we were unable to fetch the user\'s social account from Stormpath.');
          return oauth.errorResponder(req, res, err);
        }

        res.locals.user = expandedAccount;
        req.user = expandedAccount;

        helpers.createStormpathSession(req.user, req, res, function (err) {
          if (err) {
            logger.info('During a Facebook OAuth login attempt, we were unable to create a Stormpath session.');
            return oauth.errorResponder(req, res, err);
          }

          var nextUrl = oauth.common.consumeRedirectUri(req, res);

          if (!nextUrl) {
            nextUrl = resp.created ? config.web.register.nextUri : config.web.login.nextUri;
          }

          if (resp.created && registrationHandler) {
            registrationHandler(req.user, req, res, function () {
              res.redirect(302, nextUrl);
            });
          } else if (loginHandler) {
            loginHandler(req.user, req, res, function () {
              res.redirect(302, nextUrl);
            });
          } else {
            res.redirect(302, nextUrl);
          }
        });
      });
    });
  }




  if (req.query.code) {

    oauth.common.exchangeAuthCodeForAccessToken(config, req.query.code, req.cookies.oauthStateToken, baseUrl, provider, function (err, oauthAccessTokenResult) {
      if (err) {
        logger.info('During a Facebook OAuth login attempt, we were unable to exchange the authentication code for an access token.');
        return oauth.errorResponder(req, res, err);
      }

      var AccessTokenAuthenticator = require('../okta/access-token-authenticator');

      var createSession = require('../helpers/create-session');

      var client = req.app.get('stormpathClient');

      var issuer = config.org + '/oauth2/' + config.authorizationServerId;

      var accessTokenAuthenticator = new AccessTokenAuthenticator(client).forIssuer(issuer).withLocalValidation();

      accessTokenAuthenticator.authenticate(oauthAccessTokenResult.access_token, function (err, authenticationResult) {

        if (err) {
          logger.info(err);
          return oauth.errorResponder(req, res, err);
        }

        authenticationResult.getAccount(function (err, user) {
          if (err) {
            logger.info(err);
            return oauth.errorResponder(req, res, err);
          }

          createSession(oauthAccessTokenResult, user, req, res);

          if (config.postLoginHandler) {
            return config.postLoginHandler(user, req, res, function (err) {
              if (err) {
                logger.info('Error when trying to execute the postLoginHandler after authenticating the user.');
                return oauth.errorResponder(req, res, err);
              }

              res.redirect('/');
            });
          }

          res.redirect('/');
        });

      });

      // loginWithAccessToken(accessToken);
    });
  } else if (req.query.access_token) {
    loginWithAccessToken(req.query.access_token);
  } else if (req.query.error) {
    return oauth.errorResponder(req, res, new Error(req.query.error_description || req.query.error));
  } else {
    return oauth.errorResponder(req, res, new Error('Callback did not contain a code parameter.'));
  }
};
