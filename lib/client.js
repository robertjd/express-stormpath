'use strict';

var async = require('async');
var path = require('path');
var stormpath = require('stormpath');
var stormpathConfig = require('stormpath-config');
var uuid = require('uuid');
var configStrategy = stormpathConfig.strategy;

// Factory method to create a client using a configuration only.
// The configuration provided to this factory is the final configuration.
function ClientFactory(config) {
  return new stormpath.Client(
    new stormpathConfig.Loader([
      new configStrategy.ExtendConfigStrategy(config)
    ])
  );
}
/**
 * Fetches authorization server and client configuration from Okta, requires
 * an already defined okta.org and okta.applicationId
 */
function OktaConfigurationStrategy() {

}
OktaConfigurationStrategy.prototype.process = function process(config, callback) {
  var client = new ClientFactory(config);
  var applicationCredentialsResourceUrl = '/internal/apps/' + config.application.id + '/settings/clientcreds';

  async.parallel({
    applicationResource: client.getApplication.bind(client, '/apps/' + config.application.id),
    applicationCredentialsResource: client.getResource.bind(client, applicationCredentialsResourceUrl),
    idps: client.getResource.bind(client, '/idps')
  }, function (err, results) {

    if (err) {
      return callback(err);
    }

    config.authorizationServerId = results.applicationResource.settings.notifications.vpn.message;
    config.authorizationServerClientId = results.applicationCredentialsResource.client_id;
    config.authorizationServerClientSecret = results.applicationCredentialsResource.client_secret;

    var idps = results.idps.items.filter(function (idp) {
      return ['LINKEDIN', 'FACEBOOK', 'GOOGLE'].indexOf(idp.type) > -1;
    });

    // "https://dev-447143.oktapreview.com/oauth2/v1/authorize?idp=0oaa9s7xvp3EvKZba0h7&client_id={clientId}&response_type={responseType}&response_mode={responseMode}&scope={scopes}&redirect_uri={redirectUri}&state={state}&nonce={nonce}",

    var idpConfiguration = idps.reduce(function (idpConfiguration, idp) {
      var id = idp.type.toLowerCase();
      var providedConfig = config.web.social[id] || {};

      var clientId = idp.protocol.credentials.client.client_id;

      // https://dev-259824.oktapreview.com/oauth2/ausa6s6adq0M2Ahmv0h7/v1/authorize?response_type=code&response_mode=query&client_id=Zl8aj7gyXZQ8HcjrkuKQ&scope=profile+email+openid&idp=0oaa2xuwch3dp6hLQ0h7&state=none&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fcallbacks%2Fokta

      var redirectUri = '/callbacks/' + id;

      var scope = providedConfig.scope || idp.protocol.scopes.join(' ');

      var idpParams = {
        clientId: config.authorizationServerClientId,
        responseType: 'code',
        responseMode: 'query',
        scopes: scope,
        redirectUri: '{redirectUri}',
        nonce: uuid.v4(),
        state: '{state}' // Leave this here for now, will be replaced when a view is requested
      };

      var authorizeUri = idp._links.authorize.href.match(/{([^}]+)}/g).reduce(function (authorizeUri, variable) {
        var key = variable.replace(/[{}]/g, '');
        return authorizeUri.replace(variable, idpParams[key]);
      }, idp._links.authorize.href).replace('oauth2/v1', 'oauth2/' + config.authorizationServerId + '/v1');

      idpConfiguration[id] = {
        clientId: clientId,
        clientSecret: idp.protocol.credentials.client.client_secret,
        enabled: idp.status === 'ACTIVE',
        providerId: id,
        providerType: id,
        scope: scope,
        uri: redirectUri, // uri is back compat
        redirectUri: redirectUri,
        authorizeUri: authorizeUri
      };

      return idpConfiguration;
    }, {});

    config.web.social = idpConfiguration;

    callback(null, config);

  });
};

module.exports = function (config) {
  var configLoader = stormpath.configLoader(config);

  // Load our integration config.
  configLoader.prepend(new configStrategy.LoadFileConfigStrategy(path.join(__dirname, '/config.yml'), true));
  configLoader.add(new OktaConfigurationStrategy(ClientFactory));

  return new stormpath.Client(configLoader);
};
