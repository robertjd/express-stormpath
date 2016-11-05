'use strict';

var _ = require('lodash');
var extend = require('deep-extend');
var url = require('url');

var forms = require('../forms');
var helpers = require('../helpers');
var oauth = require('../oauth');

/**
 * Set the account store in the provided data object.
 *
 * @function
 *
 * @param {Object} data - Data object to set account store in.
 * @param {Object} accountStore - Account store to retrieve href from.
 */
function setAccountStoreByHref(data, accountStore) {
  return data.accountStore = accountStore.href;
}

function isRootDomainMultiTenantRequest(stormpathConfig, req) {
  var domain = helpers.getHost(req, true);

  return stormpathConfig.web.multiTenancy.enabled
    && stormpathConfig.web.multiTenancy.strategy === 'subdomain'
    && stormpathConfig.web.domainName
    && domain === stormpathConfig.web.domainName;
}
/**
 * This controller logs in an existing user.  If there are any errors, an
 * error page is rendered.  If the process succeeds, the user will be logged in
 * and redirected.
 *
 * @method
 *
 * @param {Object} req - The HTTP request.
 * @param {Object} res - The HTTP response.
 * @param {function} next - The next function.
 */
module.exports = function (req, res, next) {
  var config = req.app.get('stormpathConfig');

  res.locals.status = req.query.status;

  helpers.getFormViewModel('login', config, function (err, viewModel) {
    if (err) {
      return helpers.writeJsonError(res, err);
    }

    // helpers.toggleMultiTenancyFields(req, viewModel);

    helpers.handleAcceptRequest(req, res, {
      'application/json': function () {
        switch (req.method) {
          case 'GET':
            res.json(viewModel);
            break;

          case 'POST':
            if (!req.body) {
              return helpers.writeJsonError(res, new Error('Request requires that there is a body.'));
            }

            // Social login
            if (req.body.providerData) {
              return helpers.loginWithOAuthProvider(req.body, req, res);
            }

            if (config.web.multiTenancy.enabled && req.organization) {
              setAccountStoreByHref(req.body, req.organization);
            }

            helpers.authenticate(req.body, req, res, function (err) {
              if (err) {
                if (err.code === 2014) {
                  err.message = err.userMessage = 'Invalid Username, Password, or Organization';
                }

                return helpers.writeJsonError(res, err);
              }

              helpers.loginResponder(req, res);
            });
            break;

          default:
            next();
        }
      },
      'text/html': function () {
        var nextUri = url.parse(req.query.next || '').path;
        var formActionUri = (config.web.login.uri + (nextUri ? ('?next=' + nextUri) : ''));

        if (req.user && config.web.login.enabled) {
          var nextUrl = nextUri || config.web.login.nextUri;
          return res.redirect(302, nextUrl);
        }

        var organizationSelectFormModel = {
          fields: [{
            name: 'organizationNameKey',
            enabled: null,
            visible: true,
            label: config.web.organizationSelect.form.fields.organizationNameKey.label,
            placeholder: config.web.organizationSelect.form.fields.organizationNameKey.placeholder,
            required: true,
            type: 'text'
          }]
        };

        function redirectToOrganization(req, res, organization) {
          res.redirect(req.protocol + '://' + organization.nameKey + '.' + helpers.getHost(req) + url.parse(req.url).pathname);
        }

        function requiresOrganizationResolution(config, req) {
          return config.web.multiTenancy.enabled
            && config.web.multiTenancy.strategy === 'subdomain'
            && config.web.domainName
            && helpers.getHost(req, true) !== config.web.domainName
            && !req.organization;
        }

        var stormpathClient = req.app.get('stormpathClient');

        if (requiresOrganizationResolution(config, req)) {
          return res.redirect(req.protocol + '://' + config.web.domainName + url.parse(req.url).pathname);
        }

        if (isRootDomainMultiTenantRequest(config, req)) {

          if (req.method === 'GET') {
            return helpers.render(req, res, 'organization-select', {
              form: forms.organizationSelectForm,
              formActionUri: formActionUri,
              formModel: organizationSelectFormModel
            });
          }

          return forms.organizationSelectForm.handle(req, {
            success: function (form) {
              stormpathClient.getOrganizations({nameKey: form.data.organizationNameKey}, function (err, collection) {
                if (err) {
                  return res.json(err);
                }
                if (collection.items.length !== 1) {
                  return helpers.render(req, res, config.web.organizationSelect.view, {
                    form: form,
                    formActionUri: formActionUri,
                    formModel: organizationSelectFormModel,
                    error: 'Organization could not be bound'
                  });
                }
                var organization = collection.items[0];
                redirectToOrganization(req, res, organization);
              });
            },
            // If we get here, it means the user didn't supply required form fields.
            error: function (form) {
              helpers.render(req, res, 'organization-select', {
                form: form,
                formActionUri: formActionUri,
                formModel: organizationSelectFormModel,
                formErrors: helpers.collectFormErrors(form)
              });
            },
            // If we get here, it means the user is doing a simple GET request, so we
            // should just render the login template.
            empty: function (form) {
              helpers.render(req, res, 'organization-select', {
                form: form,
                formActionUri: formActionUri,
                formModel: organizationSelectFormModel
              });
            }
          });
        }

        function renderForm(form, options) {
          if (options === undefined) {
            options = {};
          }

          var view = config.web.login.view;
          var oauthStateToken = oauth.common.resolveStateToken(req, res);


          var hasSocialProviders = _.some(config.web.social, function (socialProvider) {
            return socialProvider.enabled;
          });

          extend(options, {
            form: form,
            formActionUri: formActionUri,
            oauthStateToken: oauthStateToken,
            hasSocialProviders: hasSocialProviders,
            formModel: viewModel.form,
            organization: req.organization
          });

          helpers.render(req, res, view, options);
        }

        helpers.setTempCookie(res, 'oauthRedirectUri', req.originalUrl);

        forms.loginForm.handle(req, {
          // If we get here, it means the user is submitting a login request, so we
          // should attempt to log the user into their account.
          success: function (form) {
            if (config.web.multiTenancy.enabled && req.organization) {
              setAccountStoreByHref(form.data, req.organization);
            } else {
              /**
               * Delete this form field, it's automatically added by the
               * forms library.  If we don't delete it, we submit a null
               * name key to the REST API and we get an error.
               */
              delete form.data.organizationNameKey;
            }

            helpers.authenticate(form.data, req, res, function (err) {
              if (err) {
                if (err.code === 2014) {
                  err.message = err.userMessage = 'Invalid Username, Password, or Organization';
                }

                return renderForm(form, { error: err.userMessage || err.message });
              }

              helpers.loginResponder(req, res);
            });
          },
          // If we get here, it means the user didn't supply required form fields.
          error: function (form) {
            // Special case: if the user is being redirected to this page for the
            // first time, don't display any error.
            if (form.data && !form.data.login && !form.data.password) {
              return renderForm(form);
            }

            renderForm(form, { formErrors: helpers.collectFormErrors(form) });
          },
          // If we get here, it means the user is doing a simple GET request, so we
          // should just render the login template.
          empty: function (form) {
            renderForm(form);
          }
        });
      }
    }, next);
  });
};
