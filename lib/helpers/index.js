'use strict';

var url = require('url');

module.exports = {
  authenticate: require('./authenticate'),
  collectFormErrors: require('./collect-form-errors'),
  exchangeStormpathToken: require('./exchange-stormpath-token'),
  createStormpathSession: require('./create-stormpath-session'),
  createSession: require('./create-session'),
  expandAccount: require('./expand-account'),
  getHost: require('./get-host'),
  getRequiredRegistrationFields: require('./get-required-registration-fields'),
  getAppModuleVersion: require('./get-app-module-version'),
  handleAcceptRequest: require('./handle-accept-request'),
  writeJsonError: require('./write-json-error'),
  writeFormError: require('./write-form-error'),
  loginResponder: require('./login-responder'),
  loginWithOAuthProvider: require('./login-with-oauth-provider'),
  prepAccountData: require('./prep-account-data'),
  render: require('./render'),
  bodyParser: require('./body-parser'),
  sanitizeFormData: require('./sanitize-form-data'),
  setTempCookie: require('./set-temp-cookie'),
  validateAccount: require('./validate-account'),
  xsrfValidator: require('./xsrf-validator'),
  revokeToken: require('./revoke-token'),
  getFormViewModel: require('./get-form-view-model').default,
  strippedAccountResponse: require('./stripped-account-response'),
  toggleMultiTenancyFields: require('./toggle-multi-tenancy-fields'),
  requiresOrganizationResolution: function requiresOrganizationResolution(config, req) {
    return config.web.multiTenancy.enabled
      && config.web.multiTenancy.strategy === 'subdomain'
      && config.web.domainName
      && require('./get-host')(req, true) !== config.web.domainName
      && !req.organization;
  },
  parentDomainRedirect: function (req, res, config) {
    var parsedUrl = url.parse(req.protocol + '://' + require('./get-host')(req));
    var port = parsedUrl.port ? ':' + parsedUrl.port : '';
    res.redirect(req.protocol + '://' + config.web.domainName + port + url.parse(req.url).pathname);
  }
};
