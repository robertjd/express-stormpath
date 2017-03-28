'use strict';

var async = require('async');

/**
 * Creates the necessary data structure in Okta, so that you can begin playing
 * with the 4.0.0 branch.  This script will do the following:
 *
 * 1. Attempt to bootstrap itself with the following environment variables:
 *
 *   OKTA_APITOKEN
 *   OKTA_APPLICATION_ID
 *   OKTA_ORG
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



function getClient(next) {
  var client = new stormpath.Client();
  client.on('ready', next.bind(null, null));
  client.on('err', next);
}

function getAuthorizationServers(client, next) {
  var uri;
  client.getResource(uri, next);
}

function parseAuthorizationServers(collection, next) {

}

var testAuthorizationServer = {
  defaultResourceUri: 'https://api.resource.com',
  description: 'Authorization Server Description',
  name: 'Test AS for express-stormpath 4.0.0'
};

function createAuthorizationServer(client, next) {
  client.createResource('/as', testAuthorizationServer, next);
}

function getApplication(client, next) {
  client.getApplications(ne);
}

function resolveAuthorizationServer(client, next) {

  async.waterfall([
    getAuthorizationServers,
    parseAuthorizationServers
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

function exit(err) {
  console.error(err);
  process.exit(1);
}

function resolveApplication(client, next) {
  async.waterfall([
    resolveAuthorizationServer.bind(null, client),
    client.getApplications.bind(client),
    parseApplications
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

async.parallel({
  authorizationServer: resolveAuthorizationServer,
  application: resolveApplication
}, function (err, results) {

});
