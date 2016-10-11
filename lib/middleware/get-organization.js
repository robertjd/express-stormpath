//
// The developer would use this like so:
//
//
// app.get('/public', function(req, res){
//   if (req.organization) {
//     return res.json({
//       message: 'The resolved organization is ' + req.organization.name;
//     })
//   }
//
//   res.json({
//     message: 'This request does not have an organization context';
//   })
//
// });
//
// app.get('/protected', function(req, res){
//   if (req.organization) {
//     return res.json({
//       message: 'You authenticated against ' + req.organization.name
//     });
//   }
//
//   res.json({
//     message: 'You are not authenticated against a specific organization.';
//   })
//
// });

function applyOrganizationMiddleware(organizationResolver) {
  return function applyOrganizationMiddlewareProxy(req, res, next) {

    organizationResolver(req, res, function (err, organization) {
      if (err) {
        // log the error and continue without attaching the organization
      }
      if (organization) {
        req.organization = organization;
      }
      next();
    });
  };
}

module.exports = applyOrganizationMiddleware;