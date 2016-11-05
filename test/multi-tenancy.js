'use strict';

var assert = require('assert');


var request = require('supertest');

var SubdomainMultiTenancyFixture = require('./fixtures/subdomain-multi-tenancy');

describe('Subdomain-based Multi Tenancy (when enabled)', function () {

  var fixture = new SubdomainMultiTenancyFixture();

  before(function (done) {
    fixture.before(done);
  });

  after(function (done) {
    fixture.after(done);
  });

  // describe('Login Feature', function () {


  //   it('Should persist the organization in the token if I login through a subdomain', function (done) {
  //     request(fixture.expressApp)
  //       .post('/login')
  //       .type('json')
  //       .set('Host', fixture.organization.nameKey + '.' + fixture.config.web.domainName)
  //       .send({
  //         login: fixture.account.email,
  //         password: fixture.account.password
  //       })
  //       .expect('Set-Cookie', /access_token=[^;]+/)
  //       .end(function (err, res) {
  //         if (err) {
  //           return done(err);
  //         }
  //         var token = res.headers['set-cookie'].join('').match(/access_token=([^;]+)/)[1];
  //         var jwt = njwt.verify(token, fixture.config.client.apiKey.secret);
  //         assert.equal(jwt.body.org, fixture.organization.href);
  //         done();
  //       });
  //   });

  //   it.skip('Should show me the organization selection form when I visit the registration view on the parent domain', function (done) {
  //     request(fixture.expressApp)
  //       .get('/login')
  //       .set('Host', fixture.config.web.domainName)
  //       .end(function (err, res) {
  //         if (err) {
  //           return done(err);
  //         }
  //         var $ = cheerio.load(res.text);

  //         // Assert that the form was rendered.
  //         assert.equal($('input[name="organizationNameKey"]').length, 1);
  //         done(err);
  //       });
  //   });

  //   it.skip('Should error if I provide an invalid organizationNameKey at the parent domain', function (done) {

  //   });

  //   it.skip('Should redirect me to the subdomain if I provide a valid organizationNameKey at the parent domain', function (done) {
  //     request(fixture.expressApp)
  //       .post('/login')
  //       .type('json')
  //       .set('Host', fixture.config.web.domainName)
  //       .send({
  //         organizationNameKey: fixture.organization.nameKey
  //       })
  //       .expect('Location', fixture.organization.nameKey + '.' + fixture.config.web.domainName)
  //       .end(done);
  //   });

  //   it.skip('Should redirect me to the login view on the parent domain if I visit an invalid subdomain', function (done) {

  //   });
  // });

  describe('Login Workflow', function () {

    describe('If I visit /login on an invalid subdomain', function () {

      it('Should redirect me to /login on the parent domain', function (done) {
        request(fixture.expressApp)
          .get('/login')
          .set('Host', 'foo.' + fixture.config.web.domainName)
          .expect('Location', 'http://' + fixture.config.web.domainName + '/login')
          .end(done);
      });

    });

    describe('If I visit /login on the parent domain', function () {

      it('should present the organization selection form', function (done) {
        request(fixture.expressApp)
          .get('/login')
          .set('Host', fixture.config.web.domainName)
          .end(fixture.assertOrganizationSelectForm.bind(fixture, done));
      });

      it('should redirect me to <subdomain>/login when I submit a valid organization', function (done) {
        request(fixture.expressApp)
          .post('/login')
          .set('Host', fixture.config.web.domainName)
          .send({
            organizationNameKey: fixture.organization.nameKey
          })
          .expect('Location', 'http://' + fixture.organization.nameKey + '.' + fixture.config.web.domainName + '/login')
          .end(done);
      });

    });

    describe('If I login on a valid subdomain', function () {

      it('Should persist the organization in the access token', function (done) {
        request(fixture.expressApp)
          .post('/login')
          .type('json')
          .set('Host', fixture.organization.nameKey + '.' + fixture.config.web.domainName)
          .send({
            login: fixture.account.email,
            password: fixture.account.password
          })
          .expect('Set-Cookie', /access_token=[^;]+/)
          .end(fixture.assertTokenContainsOrg.bind(fixture, done));
      });

    });

  });

  describe('Registration Workflow', function () {

    describe('If I visit /register on an invalid subdomain', function () {

      it('Should redirect me to /register on the parent domain', function (done) {

        request(fixture.expressApp)
          .get('/register')
          .set('Host', 'foo.' + fixture.config.web.domainName)
          .expect('Location', 'http://' + fixture.config.web.domainName + '/register')
          .end(done);

      });

    });

    describe('If I visit /register on the parent domain', function () {

      it.only('should present the organization selection form', function (done) {

        request(fixture.expressApp)
          .get('/register')
          .set('Host', fixture.config.web.domainName)
          .end(fixture.assertOrganizationSelectForm.bind(fixture, done));
      });

      it('should redirect me to <subdomain>/register when I submit a valid organization', function () {

      });

    });

    describe('If I register on a valid subdomain, and autoLogin is enabled', function () {

      it('Should persist the organization in the access token', function () {

      });

    });

  });

  describe('Password Reset Workflow', function () {
    describe('If I visit /change?sptoken=<token> on the parent domain', function () {
      it('should present the organization selection form', function () {

      });

      it('should redirect me to <subdomain>/change?sptoken=<token> when I submit a valid organization', function () {

      });
    });

    describe('If I visit /forgot on the parent domain', function () {
      it('should present the organization selection form', function () {

      });

      it('should redirect me to <subdomain>/forgot when I submit a valid organization', function () {

      });
    });

    describe('If I change my password on a valid subdomain, and autoLogin is enabled', function () {

      it('Should persist the organization in the access token', function () {

      });

    });
  });

  describe('Email Verification Workflow', function () {
    describe('If I visit /verify?sptoken=<token> on the parent domain', function () {
      it('should present the organization selection form', function () {

      });

      it('should redirect me to <subdomain>/verify?sptoken=<token> when I submit a valid organization', function () {

      });
    });

    describe('If I visit /verify on the parent domain', function () {
      it('should present the organization selection form', function () {

      });

      it('should redirect me to <subdomain>/verify when I submit a valid organization', function () {

      });
    });
  });

});