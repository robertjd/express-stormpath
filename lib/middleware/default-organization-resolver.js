'use strict';

var njwt = require('njwt');

// our getHost() middleware should be used to ensure that the correct
// host name is pulled from the request.
function parseHost(hostName) {
  var domainSegments = hostName.split('.', 2);

  return {
    domain: domainSegments.length === 2 ? domainSegments[1] : domainSegments[0],
    subDomain: domainSegments.length === 2 ? domainSegments[0] : null
  };
}

// Can we use the dataStore API to create a new caceh region for this data?
// While we did implemented this in-process for the view model code, it's a
// hack and we really should leverage the data store to manage this.
var organizationCache = {};
var organizationNameToHrefMap = {};

/**
 * Returns the cached model if it's not older than `ttl`.
 * Else it returns null.
 *
 * @method
 *
 * @param {string} href - Href of the organization to retrieve from cache.
 */
function getCachedOrganization(href) {
  var cacheItem = organizationCache[href];

  if (!cacheItem) {
    return null;
  }

  return cacheItem.organization;
}

/**
 * Cache an organization.
 *
 * @method
 *
 * @param {Object} organization - The organization to cache.
 */
function setCachedOrganization(organization, ttl) {
  var href = organization.href;

  var cacheTimeoutId = setTimeout(function () {
    delete organizationCache[href];
  }, ttl);

  organizationCache[href] = {
    organization: organization,
    cacheTimeoutId: cacheTimeoutId
  };
}

function defaultOrganizationResolver(req, res, next) {
  var client = req.app.get('stormpathClient');
  var config = req.app.get('stormpathConfig');
  var web = config.web;

  var cacheTtl = config.cacheOptions && config.cacheOptions.ttl !== undefined ? config.cacheOptions.ttl : config.client.cacheManager.defaultTtl;

  function resolveOrganizationByHref(client, href, callback) {
    var organization = getCachedOrganization(href);

    if (organization) {
      return callback(null, organization);
    }

    client.getOrganization(href, function (err, organization) {
      if (err) {
        return callback(err);
      }

      setCachedOrganization(organization, cacheTtl * 1000);

      callback(null, organization);
    });
  }

  function resolveOrganizationByName(client, name, callback) {
    var organizationHref = organizationNameToHrefMap[name];

    if (organizationHref) {
      return resolveOrganizationByHref(client, organizationHref, callback);
    }

    client.getOrganizations({ nameKey: name }, function (err, collection) {
      if (err) {
        return callback(err);
      }

      var organization = collection.items[0];

      if (organization) {
        organizationNameToHrefMap[name] = organization.href;
      }

      callback(null, organization);
    });
  }

  function continueWithOrganization(organization) {
    req.organization = organization;
    next();
  }

  // Strategy which tries to resolve the organization from the request's POST body 'organizationNameKey' field.
  // If this strategy fails to resolve an organization then the request just continues.
  function continueWithPostBodyStrategy() {
    if (req.method === 'POST' && req.body && req.body.organizationNameKey) {
      return resolveOrganizationByName(client, req.body.organizationNameKey, function (err, organization) {
        if (err) {
          return next(err);
        }

        continueWithOrganization(organization);
      });
    }

    next();
  }

  // Strategy which tries to resolve an organization from an access token cookie 'org' claim.
  // If this strategy fails then it falls back to resolving the organization from the request body.
  function continueWithAccessTokenStrategy() {
    if (req.cookies && req.cookies[web.accessTokenCookie.name]) {

      // can we use JwtAuthenticator for this?
      var jwtSigningKey = config.client.apiKey.secret;
      var accessTokenCookie = req.cookies[web.accessTokenCookie.name];

      return njwt.verify(accessTokenCookie, jwtSigningKey, function (err, verifiedJwt) {
        if (err) {
          return next(err);
        }

        if (verifiedJwt.body.org) {
          return resolveOrganizationByHref(client, verifiedJwt.body.org, function (err, organization) {
            if (err) {
              return next(err);
            }

            var currentHost = parseHost(req.headers.host);

            if (web.multiTenancy.useSubdomain && organization.nameKey !== currentHost.subDomain) {
              res.status(401);
              res.end();
              return;
            }

            continueWithOrganization(organization);
          });
        }

        continueWithPostBodyStrategy();
      });
    }

    continueWithPostBodyStrategy();
  }

  // Strategy which tries to resolve an organization from a sub domain.
  // If this step fails then it falls back to resolving an organization from an access token cookie.
  function continueWithSubDomainStrategy() {
    if (web.multiTenancy.useSubdomain && web.domainName) {
      var currentHost = parseHost(req.headers.host);

      // why the web.domainName check? it seems this should go in the parseHost() method

      if (currentHost.domain === web.domainName && currentHost.subDomain) {
        return resolveOrganizationByName(client, currentHost.subDomain, function (err, organization) {
          if (err) {
            return next(err);
          }

          continueWithOrganization(organization);
        });
      }
    }

    continueWithAccessTokenStrategy();
  }

  continueWithSubDomainStrategy();
}

module.exports = defaultOrganizationResolver;