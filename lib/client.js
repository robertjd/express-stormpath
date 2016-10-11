'use strict';

var path = require('path');
var stormpath = require('stormpath');
var stormpathConfig = require('stormpath-config');
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

module.exports = function (config) {
  var configLoader = stormpath.configLoader(config);

  // Load our integration config.
  configLoader.prepend(new configStrategy.LoadFileConfigStrategy(path.join(__dirname, '/config.yml'), true));
  configLoader.add(new configStrategy.EnrichClientFromRemoteConfigStrategy(ClientFactory));
  configLoader.add(new configStrategy.EnrichIntegrationFromRemoteConfigStrategy(ClientFactory));

  // TODO Multi-Tenancy: we need to determine if multi-tenancy is enabled by web.stormpath.mulitTenancy = true
  //
  // If it is enabled, we need to create an instance of DefaultOrganizationResolver
  // and attach it to `stormpathClient` as `organizationResolver`
  //
  // The developer should be able to provide their own resolver, like this:
  //
  // var myOrgResolver= function(req, res, next){
  //   // do stuff
  //   // organization can be:
  //
  //   {
  //     nameKey: 'my-org'
  //   }
  //
  //   or
  //
  //   {
  //     href: '//href of organization resource'
  //   }
  //
  //
  //   next(err, organization);
  // }
  //
  // app.use(stormpath.init(app, {
  //   organizationResolver = myOrgResolver
  // }))
  //

  return new stormpath.Client(configLoader);
};