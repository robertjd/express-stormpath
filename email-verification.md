## Analysis of email verification workflow:

Tell me if I'm wrong about any of this:

- Okta doesn't have a user state that indicates if the user has verified their email address
- The Okta "activation" flow (use clicks on link, goes to a page on okta) is not about verifying you email, rather it is a mechanism to set your password if you don't already have one.
- As such, we can't leverage the activation token, we have to create our own token for email verification purposes

## Stories & Solutions

Common to both of the following stories:

- References to `config.*` are static configuration the developer provides to the framework integration, it is parsed when the web application is bootstrapping.
- When created, the user must be added to the Okta application that is provided in the config, so that the user can authenticate against the authorization server for the application.

#### Register new user, email verification not required:

- Create new user with password, using `{{url}}/api/v1/users?activate=true`, the user is now ACTIVATED
- Set `profile.emailVerificationStatus='UNVERIFIED'` on the okta user, and map this to `account.emailVerificationStatus` for the Stormpath account.
- The user can now login, either by manually using a login form, or with our `autoLogin` feature, as we still have the password in the request context.

#### Register new user, email verification IS required:

- Developer has declared that email verification is required, by specifying `config.web.register.emailVerificationRequired`
- Create new user with password, using `{{url}}/api/v1/users?activate=false`, the user is now STAGED (can't login)
- Create a GUID for the user on `profile.emailVerificationToken="GUID"`
- Set `profile.emailVerificationStatus='UNVERIFIED'` on the okta user, and map this to `account.emailVerificationStatus` for the Stormpath account.
- Map the `STAGED` status to `account.status="UNVERIFIED"`, if the account is read during this state.
- The developer is given the GUID, they must email it to the user
- The user clicks on the link, arrives on the developer's application with the GUID.  The Stormpath client verifies that this is the same guid as the on the user profile.
- If the GUID is valid, use POST `{{url}}/api/v1/users/{{userId}}/lifecycle/activate?sendEmail=false` to transition the user to the ACTIVATED state (this will work because they already have a password).  Null the GUID on the user profile so that it can't be used again.
- The user can now login, they must provide their password through a login form.

## Summary of breaking changes:

* The developer has to opt-in to email verification on an application-wide basis, rather than directory-level control.
* The developer must send the verification email.
