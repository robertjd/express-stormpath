'use strict';

var async = require('async');
var stormpath = require('stormpath');

/**
 * TODO:
 *
 * more hepful console output
 * update express sample app readme to show how to use this
 * look at changes in this lib and node sdk to see if they agree
 * update issue with this information
 */

/**
 * Creates the necessary data structure in Okta, so that you can begin playing
 * with the 4.0.0 branch.  This script will do the following:
 *
 * 1. Attempt to bootstrap itself with the following environment variables:
 *
 *   OKTA_APITOKEN=<api token created from your org's admin dashboard>
 *   OKTA_ORG=https://dev-<your-org>.oktapreview.com
 *
 * 2. Look to see if an authorization server has been created, with the name
 *   "Test AS for express-stormpath 4.0.0".  If this server has already been created
 *   the script will exit
 *
 * 3. Create an Application with the name "Test Application for Express-Stormpath 4.0.0"
 *
 * 4. Assign the application an OAuth client of the AS
 *
 * 5. Store the AS ID on the application's `settings.notifications.vpn.message` property (
 *    this is a workaround we have used to create an association between the application and the AS).
 *
 * 6. Create a test user, and assign it to the test application.  The password for
 *    this user will be PasswordAbc123.
 */


function exit(err) {
  throw err;
}


var testAuthorizationServer = {
  defaultResourceUri: 'https://okta.com',
  description: 'Created by okta-test-data.js, for migration testing purposes only',
  name: 'Test AS for express-stormpath 4.0.0'
};

var testApplication = {
  name: 'oidc_client',
  label: 'Test Application for Express-Stormpath 4.0.0',
  signOnMode: 'OPENID_CONNECT',
  settings: {
    app: {
      url: 'https://okta.com',
      passwordField: 'txtbox-password',
      usernameField: 'txtbox-username'
    }
  }
};

var testOAuthClient = {
  client_name: testApplication.label,
  client_uri: null,
  logo_uri: null,
  redirect_uris: [
    'https://okta.com'
  ],
  response_types: [
    'code',
    'token',
    'id_token'
  ],
  grant_types: [
    'refresh_token',
    'password',
    'authorization_code',
    'implicit'
  ],
  token_endpoint_auth_method: 'client_secret_basic',
  application_type: 'web'
};

var testUser = {
  profile: {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    login: 'test@example.com'
  },
  credentials: {
    password: {
      value: 'PasswordAbc1234'
    }
  }
};

var accessPolicy = {
  type: 'RESOURCE_ACCESS',
  status: 'ACTIVE',
  name: 'Default rule',
  system: false,
  conditions: {
    people: {
      users: {
        include: [],
        exclude: []
      },
      groups: {
        include: [
          'EVERYONE'
        ],
        exclude: []
      }
    },
    grantTypes: {
      'include': [
        'password'
      ]
    }
  },
  actions: {
    scopes: {
      include: [{
        name: '*',
        access: 'ALLOW'
      }]
    },
    token: {
      accessTokenLifetimeMinutes: 60,
      refreshTokenLifetimeMinutes: 0,
      refreshTokenWindowMinutes: 10080
    }
  }
};

function findAuthorizationServer(collection, next) {
  next(null, collection.items.filter(function (authorizationServer) {
    return authorizationServer.name === testAuthorizationServer.name;
  })[0]);
}

function findApplication(collection, next) {
  next(null, collection.items.filter(function (application) {
    return application.label === testApplication.label;
  })[0]);
}


function createAuthorizationPolicy(client, authorizationServer, next) {

  var data = {
    type: 'OAUTH_AUTHORIZATION_POLICY',
    status: 'ACTIVE',
    name: 'Default Policy',
    description: 'Default policy description',
    priority: 1,
    system: false,
    conditions: {
      clients: {
        include: []
      }
    }
  };

  client.getResource(authorizationServer._links.resources.href, function (err, resources) {
    if (err) {
      return next(err);
    }
    client.createResource(resources.items[0]._links.policies.href, data, next);
  });
}

function createAuthorizationServer(client, next) {
  client.createResource('/as', testAuthorizationServer, function (err, authorizationServer) {
    if (err) {
      return next(err);
    }
    createAuthorizationPolicy(client, authorizationServer, function (err) {
      next(err ? err : null, authorizationServer);
    });
  });
}


function createApplication(client, next) {

  client.createResource(client.config.org + '/oauth2/v1/clients', testOAuthClient, function (err, oAuthClient) {
    if (err) {
      return next(err);
    }
    client.getApplication(oAuthClient._links.app.href, next);
  });

}

function resolveAuthorizationServer(client, next) {

  async.waterfall([
    client.getResource.bind(client, '/as'),
    findAuthorizationServer
  ], function (err, authorizationServer) {

    if (err) {
      return next(err);
    }

    if (authorizationServer) {
      return next(null, authorizationServer);
    }

    createAuthorizationServer(client, next);
  });
}


function resolveApplication(client, next) {
  async.waterfall([
    client.getApplications.bind(client),
    findApplication
  ], function (err, application) {
    if (err) {
      return next(err);
    }
    if (application) {
      return next(null, application);
    }
    createApplication(client, next);
  });
}


function getAuthorizationServerOAuthPolicy(client, authorizationServer, next) {
  client.getResource(authorizationServer._links.resources.href, function (err, resources) {
    if (err) {
      return next(err);
    }
    client.getResource(resources.items[0]._links.policies.href, function (err, policies) {
      if (err) {
        return next(err);
      }
      var policy = policies.items.filter(function (policy) {
        return policy.type === 'OAUTH_AUTHORIZATION_POLICY';
      })[0];

      if (policy) {
        policy.href = authorizationServer.href + '/resources/' + resources[0].id + '/policies/' + policy.id;
      }

      next(policy ? null : 'OAUTH_AUTHORIZATION_POLICY not found for authorizationServer ' + authorizationServer.id, policy);

    });
  });
}

function main(client) {

  client = client || new stormpath.Client({
    application: {
      id: 'none'
    }
  });

  client.on('err', exit);

  client.on('ready', function () {

    async.parallel({
      authorizationServer: resolveAuthorizationServer.bind(null, client),
      application: resolveApplication.bind(null, client),
      users: client.getResource.bind(client, '/users/', { filter: 'profile.email eq "' + testUser.profile.email + '"' })
    }, function (err, results) {
      if (err) {
        return exit(err);
      }

      var application = results.application;
      var authorizationServer = results.authorizationServer;
      var users = results.users;
      var user;

      var applicationCredentialsResourceUrl = '/internal/apps/' + application.id + '/settings/clientcreds';

      var nextTasks = {
        clientCredentials: client.getResource.bind(client, applicationCredentialsResourceUrl),
        oauthPolicy: getAuthorizationServerOAuthPolicy.bind(null, client, authorizationServer)
      };

      if (users.items.length !== 1) {
        nextTasks.newUser = client.createResource.bind(client, '/users', { activate: true}, testUser);
      } else {
        user = users.items[0];
      }

      async.parallel(nextTasks, function (err, results) {
        if (err) {
          return exit(err);
        }

        var clientCredentials = results.clientCredentials;
        var oauthPolicy = results.oauthPolicy;
        var newUser = results.newUser;

        var tasks = [];

        if (application.settings.notifications.vpn.message !== authorizationServer.id) {
          application.settings.notifications.vpn.message = authorizationServer.id;
          tasks.push(application.save.bind(application));
        }

        if (oauthPolicy.conditions.clients.include.indexOf(clientCredentials.client_id) === -1) {
          oauthPolicy.conditions.clients.include.push(clientCredentials.client_id);
          tasks.push(oauthPolicy.save.bind(oauthPolicy));
        }

        tasks.push(client.createResource.bind(client, application.href + '/users', {
          id: (newUser || user).id,
          scope: 'USER',
          credentials: {
            userName: (newUser || user).profile.email
          }
        }));

        var rulesUri = oauthPolicy.href + '/rules';

        client.getResource(rulesUri, function (err, rules) {
          if (err) {
            return exit(err);
          }

          if (rules.items.length === 0) {
            tasks.push(client.createResource.bind(client, rulesUri, accessPolicy));
          }

          async.parallel(tasks, function (err) {
            if (err) {
              return exit(err);
            }
            console.log('Data created!');
            console.log('export OKTA_APPLICATION_ID='+application.id);
          });

        });

      });
    });
  });
}

if (require.main === module) {
  return main();
}

module.exports = main;
