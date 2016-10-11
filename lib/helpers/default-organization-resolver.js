function DefaultOrganizationResolver(req,res ){

}

DefaultOrganizationResolver.prototype.getOrganization = function getOrganization(callback) {
  // Do this workflow in order:
  //
  // 1. If the request contains an access token (form cookie or auth header), determine if the token body has an `org` field
  //    1.a if it does have an `org` field, and if useSubdomain is true, assert that token org matches the org identified by the subdomain.  Fail otherwise
  //    1.b if 1.a passes, fetch the organization resouce that is identified by the token and return it
  //
  // 2. If useSubdomain is true, and we have a subdomain on the request, fetch the organization resource (by name key) and return it
  //
  //

};